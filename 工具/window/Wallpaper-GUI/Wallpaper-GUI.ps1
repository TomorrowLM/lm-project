param([switch]$DownloadOnly,[int]$BingOffset=0,[string]$QueuePath='')
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:scriptPath = $MyInvocation.MyCommand.Path
$cache = Join-Path $root 'Cache'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
Import-Module (Join-Path $root 'WallpaperCache.psm1') -Force
$escapedRoot = $root.Replace("'", "''")
$script:virtualDesktopLoader = [scriptblock]::Create('param([string]$Path); . ''' + $escapedRoot + '\VirtualDesktop.ps1''; Set-AllDesktopWallpapers -Path $Path')

function Get-ImageBatch {
    param([int]$BingOffset=0,[int]$BingCount=5,[int]$SpotCount=5,[scriptblock]$OnImage)
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $result = @()
    $feed = Invoke-RestMethod "https://www.bing.com/HPImageArchive.aspx?format=js&idx=$BingOffset&n=$BingCount&mkt=zh-CN" -TimeoutSec 30
    foreach($item in @($feed.images)) {
        $url = "https://www.bing.com$($item.urlbase)_1920x1080.jpg"
        $one = [pscustomobject]@{Title=$item.title;Date=$item.startdate;Url=$url;Hash='';Source='Bing'}
        if(Test-ImageCached -CacheRoot $cache -Image $one) { continue }
        $one | Add-Member -NotePropertyName File -NotePropertyValue (Get-ImageCacheFilePath -CacheRoot $cache -Image $one)
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $one.File) | Out-Null
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $one.File -TimeoutSec 20
        $result += $one; if($OnImage){ & $OnImage $one }
    }

    $base = 'https://arc.msn.com/v3/Delivery/Placement?pid=209567&fmt=json&rafb=0&ua=WindowsShellClient%2F0&cdm=1&disphorzres=9999&dispvertres=9999&lo=80217&pl=zh-CN&lc=zh-CN&ctry=cn'
    $got = 0; $attempt = 0
    while($got -lt $SpotCount -and $attempt -lt ($SpotCount * 5)) {
        $attempt++
        try {
            $spot = Invoke-RestMethod ($base+'&uid='+([guid]::NewGuid().ToString())) -TimeoutSec 30
            $item = ($spot.batchrsp.items | Select-Object -First 1).item | ConvertFrom-Json
            $img = $item.ad.image_fullscreen_001_landscape
            $title = if($item.ad.title_text -is [string]){$item.ad.title_text}else{$item.ad.title_text.tx}
            $one = [pscustomobject]@{Title=$title;Date=(Get-Date -Format 'yyyyMMdd');Url=$img.u;Hash=$img.sha256;Source='Windows 聚焦'}
            if(-not $img.u -or (Test-ImageCached -CacheRoot $cache -Image $one)) { continue }
            $one | Add-Member -NotePropertyName File -NotePropertyValue (Get-ImageCacheFilePath -CacheRoot $cache -Image $one)
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $one.File) | Out-Null
            Invoke-WebRequest -UseBasicParsing -Uri $img.u -OutFile $one.File -TimeoutSec 20
            $result += $one; $got++; if($OnImage){ & $OnImage $one }
        } catch { }
    }
    return $result
}

if($DownloadOnly) {
    if($QueuePath){ [IO.File]::WriteAllText($QueuePath,'',(New-Object Text.UTF8Encoding($false))) }
    $null = Get-ImageBatch -BingOffset $BingOffset -BingCount 5 -SpotCount 5 -OnImage {
        param($img)
        if($QueuePath){ [IO.File]::AppendAllText($QueuePath,(($img | ConvertTo-Json -Compress)+[Environment]::NewLine),(New-Object Text.UTF8Encoding($false))) }
    }
    exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$bingSave = 'C:\Users\12032\Pictures\必应壁纸'
$spotSave = 'C:\Users\12032\Pictures\Windows 聚焦壁纸'
New-Item -ItemType Directory -Force -Path $bingSave,$spotSave | Out-Null

$form = New-Object Windows.Forms.Form
$form.Text = '在线壁纸 · 在线图库'; $form.Width = 1120; $form.Height = 760; $form.StartPosition = 'CenterScreen'; $form.BackColor = [Drawing.Color]::FromArgb(245,247,250)
$top = New-Object Windows.Forms.Panel; $top.Dock='Top'; $top.Height=76; $top.Padding='18,12,18,8'; $form.Controls.Add($top)
$title = New-Object Windows.Forms.Label; $title.Text='在线壁纸'; $title.Font=New-Object System.Drawing.Font -ArgumentList @('Microsoft YaHei UI',18,[Drawing.FontStyle]::Bold); $title.AutoSize=$true; $top.Controls.Add($title)
$hint = New-Object Windows.Forms.Label; $hint.Text='优先加载本地缓存；获取更多时后台下载 5 张 Bing + 5 张 Windows 聚焦'; $hint.Location='18,47'; $hint.AutoSize=$true; $hint.ForeColor=[Drawing.Color]::DimGray; $top.Controls.Add($hint)
$syncCurrent = New-Object Windows.Forms.Button; $syncCurrent.Text='同步当前桌面壁纸'; $syncCurrent.Width=170; $syncCurrent.Height=32; $syncCurrent.Location='662,20'; $syncCurrent.FlatStyle='Flat'; $syncCurrent.FlatAppearance.BorderSize=1; $syncCurrent.FlatAppearance.BorderColor=[Drawing.Color]::FromArgb(210,218,228); $syncCurrent.BackColor=[Drawing.Color]::White; $syncCurrent.ForeColor=[Drawing.Color]::FromArgb(70,78,90); $syncCurrent.Font=New-Object System.Drawing.Font -ArgumentList @('Microsoft YaHei UI',9); $top.Controls.Add($syncCurrent)
$clearCache = New-Object Windows.Forms.Button; $clearCache.Text='清理缓存'; $clearCache.Width=92; $clearCache.Height=32; $clearCache.Location='842,20'; $clearCache.FlatStyle='Flat'; $clearCache.FlatAppearance.BorderSize=1; $clearCache.FlatAppearance.BorderColor=[Drawing.Color]::FromArgb(210,218,228); $clearCache.BackColor=[Drawing.Color]::White; $clearCache.ForeColor=[Drawing.Color]::FromArgb(70,78,90); $clearCache.Font=New-Object System.Drawing.Font -ArgumentList @('Microsoft YaHei UI',9); $top.Controls.Add($clearCache)
$refresh = New-Object Windows.Forms.Button; $refresh.Text='获取更多'; $refresh.Width=130; $refresh.Height=32; $refresh.Location='945,20'; $refresh.FlatStyle='Flat'; $refresh.FlatAppearance.BorderSize=0; $refresh.BackColor=[Drawing.Color]::FromArgb(32,99,155); $refresh.ForeColor=[Drawing.Color]::White; $refresh.Font=New-Object System.Drawing.Font -ArgumentList @('Microsoft YaHei UI',9); $top.Controls.Add($refresh)
$status = New-Object Windows.Forms.Label; $status.Dock='Bottom'; $status.Height=34; $status.Padding='18,8,0,0'; $status.Text='准备就绪'; $status.ForeColor=[Drawing.Color]::DimGray; $form.Controls.Add($status)
$flow = New-Object Windows.Forms.FlowLayoutPanel; $flow.Dock='Fill'; $flow.Padding='18,8,18,8'; $flow.AutoScroll=$true; $flow.WrapContents=$true; $flow.BackColor=[Drawing.Color]::FromArgb(245,247,250); $form.Controls.Add($flow)

function Remove-ImageCard($card) {
    foreach($control in @($card.Controls)) { if($control -is [Windows.Forms.PictureBox] -and $control.Image) { $control.Image.Dispose(); $control.Image = $null } }
    $flow.Controls.Remove($card); $card.Dispose()
}

function Add-ImageCard($img) {
    if($flow.Controls.Count -ge 30) { Remove-ImageCard $flow.Controls[0] }
    $card=New-Object Windows.Forms.Panel; $card.Width=330; $card.Height=255; $card.Margin='8,8,8,8'; $card.BackColor=[Drawing.Color]::White
    $pic=New-Object Windows.Forms.PictureBox; $pic.Width=330; $pic.Height=185; $pic.SizeMode='Zoom'; $pic.Tag=$img
    try {
        $bytes=[IO.File]::ReadAllBytes($img.File); $stream=New-Object IO.MemoryStream(, $bytes); $loaded=[Drawing.Image]::FromStream($stream)
        $thumbnail=$loaded.GetThumbnailImage(660,370,$null,[IntPtr]::Zero); $pic.Image=New-Object Drawing.Bitmap($thumbnail)
        $thumbnail.Dispose(); $loaded.Dispose(); $stream.Dispose()
    } catch { $card.Dispose(); return }
    $card.Controls.Add($pic)
    $label=New-Object Windows.Forms.Label; $label.Text="[$($img.Source)] $($img.Date)  $($img.Title)"; $label.Location='10,192'; $label.Width=310; $label.Height=25; $label.AutoEllipsis=$true; $label.Font=New-Object System.Drawing.Font -ArgumentList @('Microsoft YaHei UI',9); $label.ForeColor=[Drawing.Color]::FromArgb(75,82,92); $card.Controls.Add($label)
    $apply=New-Object Windows.Forms.Button; $apply.Text='应用壁纸'; $apply.Width=96; $apply.Height=28; $apply.Location='224,220'; $apply.FlatStyle='Flat'; $apply.FlatAppearance.BorderSize=0; $apply.BackColor=[Drawing.Color]::FromArgb(232,242,253); $apply.ForeColor=[Drawing.Color]::FromArgb(24,74,120); $apply.Font=New-Object System.Drawing.Font -ArgumentList @('Microsoft YaHei UI',9); $apply.Tag=$img
    $apply.Add_Click({ Apply-Wallpaper $this.Tag }); $card.Controls.Add($apply); $flow.Controls.Add($card)
}

function Apply-Wallpaper($img) {
    try {
        $status.Text='正在同步全部虚拟桌面…'; $form.Refresh()
        $folder = if($img.Source -eq 'Windows 聚焦') { $spotSave } else { $bingSave }; $safeName = (($img.Source+'_'+$img.Date+'_'+$img.Title) -replace '[^\w\-.一-龥]','_') + '.jpg'; $saved = Join-Path $folder $safeName
        Copy-Item -LiteralPath $img.File -Destination $saved -Force
        Invoke-VirtualDesktopWallpaperSync -Path $saved -LoadCommands $script:virtualDesktopLoader
        $status.Text="已保存并应用：$($img.Source) · $($img.Date) $($img.Title)（全部桌面）"
    } catch { $status.Text="应用失败：$($_.Exception.Message)" }
}
function Sync-CurrentDesktopWallpaper {
    try {
        $status.Text='正在读取并同步当前桌面壁纸…'; $form.Refresh(); $currentWallpaper = Get-CurrentWallpaperPath
        if(-not $currentWallpaper) { throw '未找到当前 Windows 桌面壁纸文件。' }
        Invoke-VirtualDesktopWallpaperSync -Path $currentWallpaper -LoadCommands $script:virtualDesktopLoader
        $status.Text="已将当前桌面壁纸同步到全部虚拟桌面：$(Split-Path -Leaf $currentWallpaper)"
    } catch { $status.Text="同步失败：$($_.Exception.Message)" }
}

$script:bingOffset = 0; $script:isLoading = $false
$downloadTimer = New-Object Windows.Forms.Timer; $downloadTimer.Interval = 400
function Start-ImageDownload {
    if($script:isLoading) { return }
    $script:isLoading = $true; $refresh.Enabled = $false; $script:queuePath = Join-Path $cache ('queue_' + [guid]::NewGuid().ToString() + '.jsonl')
    $status.Text='正在后台下载图片…'; $form.Refresh()
    try {
        $script:downloadProcess = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$script:scriptPath,'-DownloadOnly','-BingOffset',$script:bingOffset,'-QueuePath',$script:queuePath) -WindowStyle Hidden -PassThru
        $downloadTimer.Start()
    } catch { $script:isLoading = $false; $refresh.Enabled = $true; $status.Text="无法启动下载任务：$($_.Exception.Message)" }
}
$downloadTimer.Add_Tick({
    if(-not $script:downloadProcess -or -not $script:downloadProcess.HasExited) { return }
    $downloadTimer.Stop(); $newCount = 0
    if($script:downloadProcess.ExitCode -eq 0 -and (Test-Path -LiteralPath $script:queuePath)) {
        foreach($line in Get-Content -LiteralPath $script:queuePath -ErrorAction SilentlyContinue) {
            if([string]::IsNullOrWhiteSpace($line)) { continue }
            try { $img = $line | ConvertFrom-Json; if(-not (Test-ImageCached -CacheRoot $cache -Image $img)) { Add-ImageCacheRecord -CacheRoot $cache -Image $img | Out-Null; Add-ImageCard $img; $newCount++ } } catch { }
        }
        $script:bingOffset += 5; $status.Text="本次新增 $newCount 张，当前显示 $($flow.Controls.Count) 张。"
    } else { $status.Text='获取失败：后台下载任务未正常完成。' }
    if(Test-Path -LiteralPath $script:queuePath) { Remove-Item -LiteralPath $script:queuePath -Force -ErrorAction SilentlyContinue }
    $script:downloadProcess = $null; $script:isLoading = $false; $refresh.Enabled = $true
})

$refresh.Add_Click({ Start-ImageDownload }); $syncCurrent.Add_Click({ Sync-CurrentDesktopWallpaper })
$clearCache.Add_Click({
    foreach($card in @($flow.Controls)) { Remove-ImageCard $card }
    if(Test-Path -LiteralPath $cache) { Get-ChildItem -LiteralPath $cache -Force | Remove-Item -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $cache | Out-Null; $script:bingOffset = 0; $status.Text='缓存已清理；已保存到图片目录的壁纸未受影响。'
})
$form.Add_Shown({
    $null = Import-LegacyImageCache -CacheRoot $cache
    $cached = @(Get-CachedImages -CacheRoot $cache -Limit 0)
    foreach($img in @($cached | Select-Object -First 30)) { Add-ImageCard $img }
    $script:bingOffset = @($cached | Where-Object { $_.Source -eq 'Bing' }).Count
    if($cached.Count -gt 0) { $status.Text="已离线加载 $($flow.Controls.Count) 张缓存图片。" } else { Start-ImageDownload }
})
[void]$form.ShowDialog()
