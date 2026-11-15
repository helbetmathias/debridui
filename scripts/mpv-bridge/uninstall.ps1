$ErrorActionPreference = 'Stop'
$protocol = 'HKCU:\Software\Classes\debridui-mpv'
$expected = '"' + (Join-Path $PSScriptRoot 'DebridUI-MPV.exe') + '" "%1"'
if (Test-Path -LiteralPath $protocol) {
    if ((Get-Item -LiteralPath "$protocol\shell\open\command").GetValue('') -ne $expected) {
        throw 'A different bridge is registered. Nothing was removed.'
    }
    Remove-Item -LiteralPath $protocol -Recurse
}
Write-Host 'DebridUI bridge protocol unregistered. Files and backups were retained; normal mpv:// links are unchanged.'
