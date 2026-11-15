using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;
using System.Windows.Forms;

public static class BridgeLauncher
{
    [STAThread]
    private static void Main(string[] args)
    {
        string directory = AppDomain.CurrentDomain.BaseDirectory;
        try
        {
            using (Process process = Process.Start(CreateStartInfo(directory, args))) { }
        }
        catch (Exception)
        {
            // Avoid logging exceptions: malformed URLs and provider tokens can appear in their messages.
            MessageBox.Show("DebridUI could not open this stream. Check that the Windows MPV bridge is installed correctly and the link is an HTTP(S) video stream.",
                "DebridUI MPV bridge", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    public static ProcessStartInfo CreateStartInfo(string directory, string[] args)
    {
        if (args.Length != 1 || args[0].Length > 16000)
            throw new ArgumentException("Invalid bridge link.");

        Uri link;
        if (!Uri.TryCreate(args[0], UriKind.Absolute, out link) ||
            link.Scheme != "debridui-mpv" || link.Host != "play" ||
            !String.IsNullOrEmpty(link.UserInfo) || !link.IsDefaultPort ||
            (link.AbsolutePath != "" && link.AbsolutePath != "/") || link.Fragment != "")
            throw new ArgumentException("Invalid bridge link.");

        var query = HttpUtility.ParseQueryString(link.Query);
        if (query.Count != 3 || query.GetValues("v") == null || query.GetValues("v").Length != 1 ||
            query.GetValues("url") == null || query.GetValues("url").Length != 1 ||
            query.GetValues("title") == null || query.GetValues("title").Length != 1)
            throw new ArgumentException("Invalid bridge parameters.");
        string url = query["url"];
        string title = query["title"];
        Uri stream;
        if (query["v"] != "1" || String.IsNullOrWhiteSpace(title) || title.Length > 500 ||
            String.IsNullOrWhiteSpace(url) || url.Length > 8000 ||
            url.IndexOfAny(new[] { '\r', '\n', '\0' }) >= 0 ||
            !Uri.TryCreate(url, UriKind.Absolute, out stream) ||
            (stream.Scheme != "https" && stream.Scheme != "http") ||
            !String.IsNullOrEmpty(stream.UserInfo))
            throw new ArgumentException("The bridge needs a title and an HTTP(S) stream URL.");

        var json = new JavaScriptSerializer();
        var config = json.Deserialize<Dictionary<string, string>>(
            File.ReadAllText(Path.Combine(directory, "config.json"), Encoding.UTF8));
        string mpv = config["mpv"];
        if (!Path.IsPathRooted(mpv) || !File.Exists(mpv))
            throw new IOException("MPV was not found. Reinstall the bridge with the correct MPV directory.");

        string identity;
        using (var hash = SHA256.Create())
            identity = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(title))).Replace("-", "").Substring(0, 16);
        string streams = Path.Combine(directory, "streams", identity);
        Directory.CreateDirectory(streams);
        string name = SafeName(title, Math.Min(120, 240 - streams.Length - 5));
        string alias = Path.Combine(streams, name + ".mkv");
        string descriptor = json.Serialize(new { kind = "debridui-mpv", version = 1, url = url, title = title });
        // This is a tiny descriptor, not downloaded video. Never place the signed URL in command arguments.
        File.WriteAllText(alias, descriptor, new UTF8Encoding(false));

        var start = new ProcessStartInfo(mpv);
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.WorkingDirectory = Path.GetDirectoryName(mpv);
        start.Arguments = @"--force-window=yes --input-ipc-server=\\.\pipe\mpvsocket " +
            Quote("--script=" + Path.Combine(directory, "bridge.lua")) + " -- " + Quote(alias);
        return start;
    }

    private static string SafeName(string title, int limit)
    {
        if (limit < 16) throw new IOException("The bridge installation path is too long.");
        foreach (char invalid in Path.GetInvalidFileNameChars()) title = title.Replace(invalid, ' ');
        title = title.Trim().TrimEnd('.');
        string extension = Path.GetExtension(title).ToLowerInvariant();
        if (Array.IndexOf(new[] { ".mkv", ".mp4", ".avi", ".mov", ".webm", ".m4v", ".ts" }, extension) >= 0)
            title = Path.GetFileNameWithoutExtension(title);
        if (title.Length > limit) title = title.Substring(0, limit);
        if (title.Length > 0 && Char.IsHighSurrogate(title[title.Length - 1])) title = title.Substring(0, title.Length - 1);
        title = title.Trim().TrimEnd('.');
        if (title.Length == 0) return "Untitled";
        if (System.Text.RegularExpressions.Regex.IsMatch(title, @"^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])($|\.)", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            title = "_" + title;
        return title;
    }

    private static string Quote(string argument)
    {
        // Windows argv escaping, including backslashes immediately before a quote or the closing quote.
        var result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char value in argument)
        {
            if (value == '\\') { slashes++; continue; }
            if (value == '"') result.Append('\\', slashes * 2 + 1);
            else result.Append('\\', slashes);
            result.Append(value);
            slashes = 0;
        }
        result.Append('\\', slashes * 2).Append('"');
        return result.ToString();
    }
}
