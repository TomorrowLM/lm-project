$modulePath = Join-Path $PSScriptRoot '..\WallpaperCache.psm1'

Describe 'Wallpaper cache' {
    BeforeAll {
        $script:testRoot = Join-Path $env:TEMP ('WallpaperGuiTests_' + [guid]::NewGuid())
        New-Item -ItemType Directory -Force -Path $script:testRoot | Out-Null
    }

    AfterAll {
        Remove-Item -LiteralPath $script:testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    It 'provides the cache module' {
        Test-Path -LiteralPath $modulePath | Should Be $true
    }

    It 'uses Bing official date as the cache key and folder' {
        Import-Module $modulePath -Force
        $image = [pscustomobject]@{ Source = 'Bing'; Date = '20260908'; Title = '印度西海岸的生活'; Url = 'https://example.test/bing.jpg' }

        (Get-ImageCacheKey -Image $image) | Should Be 'Bing|20260908'
        (Get-ImageCacheFilePath -CacheRoot $script:testRoot -Image $image) | Should Match ([regex]::Escape('Bing\20260908\'))
    }

    It 'uses Spotlight content hash rather than download date as the cache key' {
        Import-Module $modulePath -Force
        $image = [pscustomobject]@{ Source = 'Windows 聚焦'; Date = '20260909'; Title = '瑞士，图根堡'; Url = 'https://example.test/spotlight.jpg'; Hash = 'abc123' }

        (Get-ImageCacheKey -Image $image) | Should Be 'Spotlight|abc123'
        (Get-ImageCacheFilePath -CacheRoot $script:testRoot -Image $image) | Should Match ([regex]::Escape('Spotlight\abc123.jpg'))
    }

    It 'converts a base64 Spotlight hash to a safe file name' {
        Import-Module $modulePath -Force
        $image = [pscustomobject]@{ Source = 'Windows 聚焦'; Date = '20260909'; Title = '测试'; Url = 'https://example.test/spotlight.jpg'; Hash = 'ab/c+=' }

        (Split-Path -Leaf (Get-ImageCacheFilePath -CacheRoot $script:testRoot -Image $image)) | Should Be 'ab_c.jpg'
    }

    It 'only returns indexed images whose local file still exists' {
        Import-Module $modulePath -Force
        $existing = Join-Path $script:testRoot 'existing.jpg'
        [IO.File]::WriteAllBytes($existing, [byte[]](1,2,3))
        $present = [pscustomobject]@{ CacheKey = 'Bing|20260908'; Source = 'Bing'; Date = '20260908'; Title = '保留'; Url = 'https://example.test/a.jpg'; File = $existing; CachedAt = '2026-09-08T00:00:00Z' }
        $missing = [pscustomobject]@{ CacheKey = 'Bing|20260907'; Source = 'Bing'; Date = '20260907'; Title = '缺失'; Url = 'https://example.test/b.jpg'; File = (Join-Path $script:testRoot 'missing.jpg'); CachedAt = '2026-09-07T00:00:00Z' }
        $lines = @(
            ($present | ConvertTo-Json -Compress)
            ($missing | ConvertTo-Json -Compress)
        )
        [IO.File]::WriteAllLines((Get-ImageCacheIndexPath -CacheRoot $script:testRoot), [string[]]$lines)

        $cached = @(Get-CachedImages -CacheRoot $script:testRoot)
        $cached.Count | Should Be 1
        $cached[0].Title | Should Be '保留'
    }

    It 'recognizes an existing cache record without applying the display limit' {
        Import-Module $modulePath -Force
        $image = [pscustomobject]@{ Source = 'Bing'; Date = '20260906'; Title = '命中'; Url = 'https://example.test/c.jpg'; File = (Join-Path $script:testRoot 'hit.jpg') }
        [IO.File]::WriteAllBytes($image.File, [byte[]](1,2,3))
        Add-ImageCacheRecord -CacheRoot $script:testRoot -Image $image | Out-Null

        (Test-ImageCached -CacheRoot $script:testRoot -Image $image) | Should Be $true
    }

    It 'imports a legacy Bing cache file using its date-prefixed name' {
        Import-Module $modulePath -Force
        $legacy = Join-Path $script:testRoot '20260905_旧缓存.jpg'
        [IO.File]::WriteAllBytes($legacy, [byte[]](1,2,3))

        $imported = @(Import-LegacyImageCache -CacheRoot $script:testRoot)
        $imported.Count | Should Be 1
        $imported[0].CacheKey | Should Be 'Bing|20260905'
        @(Get-CachedImages -CacheRoot $script:testRoot -Limit 0 | Where-Object { $_.CacheKey -eq 'Bing|20260905' }).Count | Should Be 1
    }

    It 'invokes the virtual-desktop command in the loader scope' {
        Import-Module $modulePath -Force
        $global:wallpaperSyncTestPath = $null
        $loader = {
            param([string]$Path)
            function Set-AllDesktopWallpapers {
                param([string]$Path)
                $global:wallpaperSyncTestPath = $Path
            }
            Set-AllDesktopWallpapers -Path $Path
        }

        Invoke-VirtualDesktopWallpaperSync -Path 'C:\Test\current.jpg' -LoadCommands $loader
        $global:wallpaperSyncTestPath | Should Be 'C:\Test\current.jpg'
        Remove-Variable -Name wallpaperSyncTestPath -Scope Global -ErrorAction SilentlyContinue
    }

    It 'selects the first available current-wallpaper path' {
        Import-Module $modulePath -Force
        $wallpaper = Join-Path $script:testRoot 'current.jpg'
        [IO.File]::WriteAllBytes($wallpaper, [byte[]](1,2,3))

        (Select-ExistingWallpaperPath -Candidates @((Join-Path $script:testRoot 'absent.jpg'), $wallpaper)) | Should Be $wallpaper
    }
}
