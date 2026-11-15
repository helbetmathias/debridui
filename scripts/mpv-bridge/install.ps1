param(
    [Parameter(Mandatory = $true)]
    [string]$MpvDirectory,
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'DebridUI\mpv-bridge'),
    [switch]$SkipRegistration
)

$ErrorActionPreference = 'Stop'
$MpvDirectory = (Resolve-Path -LiteralPath $MpvDirectory).Path
$mpv = Join-Path $MpvDirectory 'mpv.exe'
if (-not (Test-Path -LiteralPath $mpv -PathType Leaf)) { throw 'mpv.exe was not found in MpvDirectory.' }
$InstallDirectory = [IO.Path]::GetFullPath($InstallDirectory)
$launcher = Join-Path $InstallDirectory 'DebridUI-MPV.exe'
$protocol = 'HKCU:\Software\Classes\debridui-mpv'
$command = '"' + $launcher + '" "%1"'

# Never overwrite an unrelated protocol registration.
if (-not $SkipRegistration -and (Test-Path -LiteralPath $protocol)) {
    $previous = (Get-Item -LiteralPath "$protocol\shell\open\command").GetValue('')
    if ($previous -ne $command) { throw 'A different debridui-mpv handler is registered. No changes were made.' }
}

Add-Type -AssemblyName System.Web, System.Web.Extensions, System.Windows.Forms
$build = Join-Path ([IO.Path]::GetTempPath()) ('DebridUI-MPV-' + [Guid]::NewGuid().ToString('N') + '.exe')
Add-Type -Path (Join-Path $PSScriptRoot 'BridgeLauncher.cs') -ReferencedAssemblies System.Web.dll, System.Web.Extensions.dll, System.Windows.Forms.dll -OutputAssembly $build -OutputType WindowsApplication

if (Test-Path -LiteralPath $InstallDirectory) {
    $backup = $InstallDirectory + '.backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
    New-Item -ItemType Directory -Path $backup | Out-Null
    foreach ($name in @('DebridUI-MPV.exe', 'config.json', 'bridge.lua', 'uninstall.ps1')) {
        $existing = Join-Path $InstallDirectory $name
        if (Test-Path -LiteralPath $existing -PathType Leaf) { Copy-Item -LiteralPath $existing -Destination $backup }
    }
    Write-Host "Previous bridge files backed up to $backup"
}
New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
Copy-Item -LiteralPath $build -Destination $launcher -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'bridge.lua') -Destination $InstallDirectory -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'uninstall.ps1') -Destination $InstallDirectory -Force
[IO.File]::WriteAllText((Join-Path $InstallDirectory 'config.json'), (@{ mpv = $mpv } | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
Remove-Item -LiteralPath $build

if (-not $SkipRegistration) {
    New-Item -Path "$protocol\shell\open\command" -Force | Out-Null
    Set-Item -LiteralPath $protocol -Value 'URL:DebridUI MPV bridge'
    New-ItemProperty -LiteralPath $protocol -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
    Set-Item -LiteralPath "$protocol\shell\open\command" -Value $command
}
Write-Host 'MPV bridge installed. Your existing mpv:// handler and MPV configuration were not changed.'
