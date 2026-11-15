param([Parameter(Mandatory = $true)][string]$TestDirectory)
$ErrorActionPreference = 'Stop'
$recorder = Join-Path $TestDirectory 'recorder'
New-Item -ItemType Directory -Path $recorder -Force | Out-Null
Add-Type -AssemblyName System.Web.Extensions
Add-Type -Path (Join-Path $PSScriptRoot 'fixtures\mpv-argument-recorder.cs') -ReferencedAssemblies System.Web.Extensions.dll -OutputAssembly (Join-Path $recorder 'mpv.exe') -OutputType WindowsApplication
& (Join-Path $PSScriptRoot '..\scripts\mpv-bridge\install.ps1') -MpvDirectory $recorder -InstallDirectory (Join-Path $TestDirectory 'helper') -SkipRegistration
