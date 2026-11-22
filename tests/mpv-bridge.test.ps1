param([Parameter(Mandatory = $true)][string]$TestDirectory)
$ErrorActionPreference = 'Stop'
$TestDirectory = Join-Path ([IO.Path]::GetFullPath($TestDirectory)) ('run-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $TestDirectory -Force | Out-Null
$source = Join-Path $PSScriptRoot '..\scripts\mpv-bridge\BridgeLauncher.cs'
Add-Type -AssemblyName System.Web, System.Web.Extensions, System.Windows.Forms
$type = Add-Type -Path $source -ReferencedAssemblies System.Web.dll, System.Web.Extensions.dll, System.Windows.Forms.dll -PassThru | Where-Object FullName -eq 'BridgeLauncher'
$method = $type.GetMethod('CreateStartInfo', [Reflection.BindingFlags]'Static,Public')
$utf8 = New-Object Text.UTF8Encoding($false)
# Only existence is needed to inspect ProcessStartInfo; never launch a test movie into the real scrobbler.
$fakeMpv = Join-Path $TestDirectory 'mpv.exe'
[IO.File]::WriteAllText($fakeMpv, 'not an executable', $utf8)
[IO.File]::WriteAllText((Join-Path $TestDirectory 'config.json'), (@{ mpv = $fakeMpv } | ConvertTo-Json), $utf8)
function Link([string]$Url, [string]$Title) {
    'debridui-mpv://play?v=1&url=' + [Uri]::EscapeDataString($Url) + '&title=' + [Uri]::EscapeDataString($Title)
}
function Prepare([string]$Link) {
    $method.Invoke($null, [object[]]@($TestDirectory, [string[]]@($Link)))
}
function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$url = 'https://example.invalid/video?signature=a%2Fb%26c&token=one+two#fragment'
$title = 'Silo (2023) S01E02 - Truth & "Secrets"'
$start = Prepare (Link $url $title)
Assert ($start.CreateNoWindow -and -not $start.UseShellExecute) 'Launcher must not use a shell or console.'
Assert (-not $start.Arguments.Contains('signature')) 'Stream URL leaked into the MPV command line.'
Assert ($start.Arguments.Contains('--input-ipc-server=\\.\pipe\mpvsocket')) 'Missing SIMKL IPC pipe.'
$aliases = @(Get-ChildItem -LiteralPath (Join-Path $TestDirectory 'streams') -Filter '*.mkv' -Recurse)
Assert ($aliases.Count -eq 1) 'Expected one descriptor.'
$descriptor = Get-Content -LiteralPath $aliases[0].FullName -Raw -Encoding UTF8 | ConvertFrom-Json
Assert ($descriptor.url -ceq $url) 'Signed URL was modified.'
Assert ($descriptor.title -ceq $title) 'Title was modified.'
Assert ($aliases[0].Name.Contains('Silo (2023) S01E02')) 'Series year or episode number missing from filename.'
Assert (-not $aliases[0].Name.Contains('"')) 'Unsafe filename character.'
$again = Prepare (Link $url $title)
Assert ($again.Arguments -ceq $start.Arguments) 'Media identity must remain stable across launches.'
foreach ($name in @('CON', 'AUX.mkv', '..\..\escape', ('A' * 500), 'Movie (2026).mp4')) {
    $null = Prepare (Link $url $name)
}
$unicodeTitle = 'Film ' + [char]0x0219 + [char]0x00E9 + ' (2026)'
$null = Prepare (Link $url $unicodeTitle)
$descriptors = @(Get-ChildItem -LiteralPath (Join-Path $TestDirectory 'streams') -Filter '*.mkv' -Recurse)
foreach ($file in $descriptors) {
    Assert ($file.FullName.StartsWith((Join-Path $TestDirectory 'streams') + '\')) 'Filename escaped streams directory.'
    Assert ($file.FullName.Length -lt 260) 'Filename exceeds legacy Windows path limit.'
}
foreach ($bad in @(
    (Link 'file:///C:/Windows/notepad.exe' 'Bad'),
    (Link 'javascript:alert(1)' 'Bad'),
    (Link 'https://user:password@example.invalid/video' 'Bad'),
    (Link "https://example.invalid/`nvideo" 'Bad'),
    (Link $url ''),
    (Link $url ('a' * 501)),
    ((Link $url 'Bad') + '&title=duplicate'),
    ((Link $url 'Bad') -replace 'v=1', 'v=2'),
    ((Link $url 'Bad') -replace '//play', '//other')
)) {
    $rejected = $false
    try { $null = Prepare $bad } catch { $rejected = $true }
    Assert $rejected 'Unsafe or malformed link was accepted.'
}
Write-Host 'PASS: launch arguments, signed URL fidelity, stable episode filenames, Unicode, path safety, and malformed links.'
