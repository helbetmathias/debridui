# Windows MPV / SIMKL bridge

This optional helper gives MPV a readable movie/episode filename while it streams the original URL. It is intended for Media Player Scrobbler for SIMKL, whose MPV integration identifies media using the `path` property over IPC, not just the window title. SIMKL matching still depends on its title database and your scrobbler settings; recognition is not guaranteed for every title.

## Installation

Requirements: Windows, Windows PowerShell 5.1 / .NET Framework, MPV, and your existing SIMKL scrobbler. No Python installation or replacement scrobbler EXE is needed.

1. Download/clone this fork and keep the files in `scripts/mpv-bridge/` together. Review the scripts before running them.
2. Open Windows PowerShell in the repository root and run, replacing the MPV directory if necessary:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mpv-bridge\install.ps1 -MpvDirectory "$env:APPDATA\mpv"
   ```

3. In DebridUI, choose **Settings → Appearance → Default Player → MPV (SIMKL bridge)** on this Windows browser. This is a device-local choice; leave normal MPV selected on other devices.
4. Keep the SIMKL scrobbler running with MPV integration enabled. Its IPC path should be the default `\\.\pipe\mpvsocket`. Play one movie/episode normally from DebridUI, allow the browser's external-app prompt, and check the scrobbler identifies it correctly.

The installed helper lives at `%LOCALAPPDATA%\DebridUI\mpv-bridge`. The installer compiles the included C# source into a Windows GUI executable and registers **only** the new `debridui-mpv://` protocol for your Windows account. No administrator privileges are needed. It does not replace your existing `mpv://` handler, MPV executable, scripts, or configuration. Reinstalling backs up previous helper files beside the installation directory.

## Playback and privacy

- The normal flow stays **choose movie/episode → Play → MPV**. No console window or persistent helper process is used. The launcher starts MPV and exits.
- Movies include their release year when available. Episodes use the series premiere year (not the episode's air year) before `SxxExx`, e.g. `Sherlock (2010) S02E01`, to help the scrobbler distinguish same-named shows. Quality/source labels are omitted in this mode. Files launched from Files/Links retain their supplied filename.
- If an episode's bridge filename changes, MPV may not find its existing local Watch Later bookmark. This does not delete SIMKL progress or remap previously misidentified entries.
- A tiny local JSON descriptor has a video-shaped filename for the scrobbler. **It is not a downloaded video.** The MPV hook redirects the stream using [`stream-open-filename`](https://mpv.io/manual/stable/#command-interface-stream-open-filename), while `path` keeps the readable name. MPV exposes timing over its normal local IPC pipe.
- Signed stream URLs are preserved exactly, kept out of MPV's command-line arguments, and removed from the descriptor after the hook reads it. A crash before loading can leave a descriptor in the helper's `streams` directory; these contain playback links, so do not share that directory. Your own MPV logging configuration may still log stream URLs as usual.
- Only HTTP(S) stream links are accepted. The helper does not execute commands supplied by links, host a local HTTP proxy, add SIMKL credentials, or directly mark anything watched. The existing scrobbler remains responsible for detection and scrobbling.
- Use one MPV instance at a time with the default scrobbler pipe. Multiple instances can compete for that pipe. External sidecar subtitles/resume plugins should be checked with your setup because MPV's reported path is now the alias, not the remote URL. Embedded subtitles and normal seeking still use the actual media stream.

## Switching back / uninstalling

Choose **MPV** again in DebridUI to immediately resume the original launch behavior. To unregister the optional bridge:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DebridUI\mpv-bridge\uninstall.ps1"
```

This removes only the bridge's protocol registration after checking ownership. Helper files and backups are retained for recovery; ordinary `mpv://` links remain unchanged.

## Developer checks

- `bun run test:integration` covers opt-in URL generation, exact signed-URL transport, clean title formatting, and unchanged normal MPV launches.
- In Windows PowerShell, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/mpv-bridge.test.ps1 -TestDirectory <temporary-test-directory>` for native argument/filename validation. It does not start a player or contact SIMKL.
- `install.ps1 -SkipRegistration -InstallDirectory <temporary-test-directory>` builds an isolated helper without registering a protocol. Use renamed MPV test binaries and a separate IPC pipe for synthetic playback tests to avoid polluting real scrobbling history.
- `node tests/mpv-bridge-playback.test.cjs <path-to-mpv.exe> <path-to-ffmpeg.exe>` runs the offline native-launcher/HTTP/IPC playback checks on Windows, including seeking, embedded subtitles, and unchanged normal-file playback. It uses generated footage and a renamed test player, not your running scrobbler.

After updates, test one real movie and one real episode through the installed scrobbler; automated offline tests cannot confirm SIMKL's live matching or watched thresholds.
