Set-StrictMode -Version Latest

function ConvertTo-CacheSafeName {
    param([string]$Value)

    $safe = ($Value -replace '[^\w\-.一-龥]', '_').Trim('_')
    if ([string]::IsNullOrWhiteSpace($safe)) { return 'wallpaper' }
    return $safe
}

function Get-StringSha256 {
    param([Parameter(Mandatory)][string]$Value)

    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    $hash = [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    return -join ($hash | ForEach-Object { $_.ToString('x2') })
}

function Get-OptionalImageValue {
    param([Parameter(Mandatory)]$Image,[Parameter(Mandatory)][string]$Name)

    $property = $Image.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return [string]$property.Value
}

function Get-ImageCacheIndexPath {
    param([Parameter(Mandatory)][string]$CacheRoot)

    return (Join-Path $CacheRoot 'images.jsonl')
}

function Get-ImageCacheKey {
    param([Parameter(Mandatory)]$Image)

    if ($Image.Source -eq 'Bing') {
        if ([string]::IsNullOrWhiteSpace($Image.Date)) { throw 'Bing 壁纸缺少发布日期。' }
        return "Bing|$($Image.Date)"
    }

    $hash = Get-OptionalImageValue -Image $Image -Name 'Hash'
    if ([string]::IsNullOrWhiteSpace($hash)) { $hash = Get-StringSha256 -Value ([string]$Image.Url) }
    return "Spotlight|$hash"
}

function Get-ImageCacheFilePath {
    param([Parameter(Mandatory)][string]$CacheRoot,[Parameter(Mandatory)]$Image)

    if ($Image.Source -eq 'Bing') {
        return (Join-Path (Join-Path (Join-Path $CacheRoot 'Bing') ([string]$Image.Date)) ((ConvertTo-CacheSafeName $Image.Title) + '.jpg'))
    }

    $hash = Get-OptionalImageValue -Image $Image -Name 'Hash'
    if ([string]::IsNullOrWhiteSpace($hash)) { $hash = Get-StringSha256 -Value ([string]$Image.Url) }
    return (Join-Path (Join-Path $CacheRoot 'Spotlight') ((ConvertTo-CacheSafeName $hash) + '.jpg'))
}

function Get-CachedImages {
    param([Parameter(Mandatory)][string]$CacheRoot,[int]$Limit = 30)

    $indexPath = Get-ImageCacheIndexPath -CacheRoot $CacheRoot
    if (-not (Test-Path -LiteralPath $indexPath)) { return @() }

    $seen = @{}
    $valid = foreach ($line in Get-Content -LiteralPath $indexPath -ErrorAction SilentlyContinue) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try { $image = $line | ConvertFrom-Json } catch { continue }
        if (-not $image.CacheKey -or -not $image.File -or -not (Test-Path -LiteralPath $image.File -PathType Leaf)) { continue }
        if ($seen.ContainsKey($image.CacheKey)) { continue }
        $seen[$image.CacheKey] = $true
        $image
    }

    $sorted = @($valid | Sort-Object { [datetime]$_.CachedAt } -Descending)
    if ($Limit -le 0) { return $sorted }
    return @($sorted | Select-Object -First $Limit)
}

function Test-ImageCached {
    param([Parameter(Mandatory)][string]$CacheRoot,[Parameter(Mandatory)]$Image)

    $cacheKey = Get-ImageCacheKey -Image $Image
    return @((Get-CachedImages -CacheRoot $CacheRoot -Limit 0) | Where-Object { $_.CacheKey -eq $cacheKey }).Count -gt 0
}

function Add-ImageCacheRecord {
    param([Parameter(Mandatory)][string]$CacheRoot,[Parameter(Mandatory)]$Image)

    $indexPath = Get-ImageCacheIndexPath -CacheRoot $CacheRoot
    $record = [ordered]@{
        CacheKey = Get-ImageCacheKey -Image $Image
        Source = [string]$Image.Source
        Date = [string]$Image.Date
        Title = [string]$Image.Title
        Url = [string]$Image.Url
        Hash = Get-OptionalImageValue -Image $Image -Name 'Hash'
        File = [string]$Image.File
        CachedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    $directory = Split-Path -Parent $indexPath
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    [IO.File]::AppendAllText($indexPath, (($record | ConvertTo-Json -Compress) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
    return [pscustomobject]$record
}

function Import-LegacyImageCache {
    param([Parameter(Mandatory)][string]$CacheRoot)

    if (-not (Test-Path -LiteralPath $CacheRoot -PathType Container)) { return @() }
    $knownKeys = @{}
    foreach ($cached in @(Get-CachedImages -CacheRoot $CacheRoot -Limit 0)) { $knownKeys[$cached.CacheKey] = $true }
    $imported = @()
    foreach ($file in Get-ChildItem -LiteralPath $CacheRoot -File -Filter '*.jpg' -ErrorAction SilentlyContinue) {
        $image = $null
        if ($file.BaseName -match '^(?<date>\d{8})_(?<title>.+)$') {
            $image = [pscustomobject]@{ Source='Bing'; Date=$Matches.date; Title=$Matches.title; Url=''; File=$file.FullName }
        } elseif ($file.BaseName -match '^Spotlight_') {
            $legacyHash = 'legacy-' + (Get-StringSha256 -Value $file.FullName)
            $image = [pscustomobject]@{ Source='Windows 聚焦'; Date=$file.LastWriteTime.ToString('yyyyMMdd'); Title=$file.BaseName; Url=''; Hash=$legacyHash; File=$file.FullName }
        }
        if ($null -eq $image) { continue }
        $cacheKey = Get-ImageCacheKey -Image $image
        if ($knownKeys.ContainsKey($cacheKey)) { continue }
        $record = Add-ImageCacheRecord -CacheRoot $CacheRoot -Image $image
        $knownKeys[$cacheKey] = $true
        $imported += $record
    }
    return $imported
}

function Select-ExistingWallpaperPath {
    param([string[]]$Candidates)

    foreach ($candidate in $Candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    return $null
}

function Get-CurrentWallpaperPath {
    $registryPath = $null
    try { $registryPath = (Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallPaper -ErrorAction Stop).WallPaper } catch { }
    $themePath = Join-Path $env:APPDATA 'Microsoft\Windows\Themes\TranscodedWallpaper'
    return (Select-ExistingWallpaperPath -Candidates @($registryPath, $themePath))
}

function Invoke-VirtualDesktopWallpaperSync {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][scriptblock]$LoadCommands
    )

    & $LoadCommands $Path
}

Export-ModuleMember -Function Get-ImageCacheIndexPath,Get-ImageCacheKey,Get-ImageCacheFilePath,Get-CachedImages,Test-ImageCached,Add-ImageCacheRecord,Import-LegacyImageCache,Select-ExistingWallpaperPath,Get-CurrentWallpaperPath,Invoke-VirtualDesktopWallpaperSync
