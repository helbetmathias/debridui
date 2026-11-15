// Windows-only offline playback check. Never runs a process named mpv.exe.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const net = require("node:net");
const { spawn, execFileSync } = require("node:child_process");
const { once } = require("node:events");

const [mpv, ffmpeg] = process.argv.slice(2);
assert(mpv && ffmpeg, "Pass paths to MPV and FFmpeg; MPV is copied under a non-player test name.");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "debridui-bridge-test-"));
const probe = path.join(root, "bridge-probe.exe");
fs.copyFileSync(mpv, probe);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(action, description) {
    for (let attempt = 0; attempt < 100; attempt++) {
        const result = await action();
        if (result) return result;
        await wait(50);
    }
    throw new Error(`Timed out: ${description}`);
}

async function main() {
    execFileSync(
        "powershell.exe",
        [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            path.join(__dirname, "prepare-mpv-playback.ps1"),
            "-TestDirectory",
            root,
        ],
        { windowsHide: true, stdio: "pipe" }
    );
    const video = path.join(root, "fixture.mkv");
    execFileSync(
        ffmpeg,
        [
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:size=160x90:rate=5:duration=12",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=12",
            "-i",
            path.join(__dirname, "fixtures", "bridge-subtitle.srt"),
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-map",
            "2:s",
            "-c:v",
            "mpeg4",
            "-c:a",
            "aac",
            "-c:s",
            "srt",
            "-t",
            "12",
            video,
        ],
        { windowsHide: true, stdio: "pipe" }
    );
    const media = fs.readFileSync(video);
    const requests = [];
    const server = http.createServer((request, response) => {
        requests.push(request.url);
        const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || "");
        const start = range ? Number(range[1]) : 0;
        const end = range?.[2] ? Math.min(Number(range[2]), media.length - 1) : media.length - 1;
        if (start >= media.length) {
            response.writeHead(416, { "Content-Range": `bytes */${media.length}` }).end();
            return;
        }
        response.writeHead(range ? 206 : 200, {
            "Content-Type": "video/x-matroska",
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            ...(range ? { "Content-Range": `bytes ${start}-${end}/${media.length}` } : {}),
        });
        response.end(media.subarray(start, end + 1));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
        const url = `http://127.0.0.1:${server.address().port}/stream?signature=a%2Fb%26c&token=one+two`;
        const helper = path.join(root, "helper", "DebridUI-MPV.exe");
        const pe = fs.readFileSync(helper);
        assert.equal(
            pe.readUInt16LE(pe.readUInt32LE(0x3c) + 24 + 68),
            2,
            "Helper must use Windows GUI subsystem, not console"
        );
        for (const title of ["Bridge Fixture (2026)", "Bridge Fixture S01E02 - Truth & Secrets"]) {
            const argumentsFile = path.join(root, "recorder", "arguments.json");
            if (fs.existsSync(argumentsFile)) fs.unlinkSync(argumentsFile);
            const link = `debridui-mpv://play?v=1&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
            const launcher = spawn(helper, [link], { windowsHide: true, stdio: "ignore" });
            const [code] = await once(launcher, "exit");
            assert.equal(code, 0);
            await until(() => fs.existsSync(argumentsFile), "native launcher argv capture");
            const args = JSON.parse(fs.readFileSync(argumentsFile, "utf8"));
            assert.equal(args.length, 5);
            assert.equal(args[0], "--force-window=yes");
            assert.equal(args[1], "--input-ipc-server=\\\\.\\pipe\\mpvsocket");
            assert.equal(args[3], "--");
            assert.equal(JSON.parse(fs.readFileSync(args[4], "utf8")).url, url);
            const pipe = String.raw`\\.\pipe\debridui-bridge-test-${process.pid}`;
            const player = spawn(
                probe,
                [
                    "--no-config",
                    "--load-scripts=no",
                    "--force-window=no",
                    "--vo=null",
                    "--ao=null",
                    "--pause=yes",
                    "--keep-open=yes",
                    "--terminal=yes",
                    `--input-ipc-server=${pipe}`,
                    ...args.slice(2),
                ],
                { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
            );
            let diagnostics = "";
            player.stdout.on("data", (data) => {
                diagnostics += data.toString();
            });
            player.stderr.on("data", (data) => {
                diagnostics += data.toString();
            });
            let socket;
            try {
                socket = await until(
                    () =>
                        new Promise((resolve) => {
                            const connection = net.createConnection(pipe);
                            connection.once("connect", () => resolve(connection));
                            connection.once("error", () => {
                                connection.destroy();
                                resolve(null);
                            });
                        }),
                    "MPV test pipe"
                );
                let buffer = "";
                let nextId = 0;
                const pending = new Map();
                socket.on("data", (chunk) => {
                    buffer += chunk.toString();
                    while (buffer.includes("\n")) {
                        const end = buffer.indexOf("\n");
                        const line = buffer.slice(0, end);
                        buffer = buffer.slice(end + 1);
                        if (!line) continue;
                        const message = JSON.parse(line);
                        pending.get(message.request_id)?.(message);
                        pending.delete(message.request_id);
                    }
                });
                const command = (args) =>
                    new Promise((resolve, reject) => {
                        const id = ++nextId;
                        const timeout = setTimeout(() => {
                            pending.delete(id);
                            reject(new Error("IPC timeout"));
                        }, 4000);
                        pending.set(id, (message) => {
                            clearTimeout(timeout);
                            resolve(message);
                        });
                        socket.write(`${JSON.stringify({ command: args, request_id: id })}\n`);
                    });
                const property = async (name) => (await command(["get_property", name])).data;
                await until(async () => (await property("duration")) > 10, "stream metadata");
                assert.equal(await property("path"), args[4]);
                assert.equal(await property("media-title"), title);
                assert.equal(await property("stream-open-filename"), url);
                const tracks = await property("track-list");
                for (const type of ["video", "audio", "sub"])
                    assert(
                        tracks.some((track) => track.type === type),
                        `Missing ${type} track`
                    );
                assert.equal(fs.existsSync(args[4]), false, "Descriptor should be removed after opening");
                assert.equal((await command(["seek", 5, "absolute+exact"])).error, "success");
                await command(["set_property", "pause", false]);
                await until(async () => (await property("time-pos")) >= 5.2, "seek and playback progress");
                await command(["set_property", "pause", true]);
                // The hook must leave ordinary local video files alone.
                await command(["loadfile", video, "replace"]);
                await until(
                    async () => (await property("path")) === video && (await property("duration")) > 10,
                    "ordinary file playback"
                );
                socket.write(`${JSON.stringify({ command: ["quit"] })}\n`);
                console.log(
                    `PASS: native GUI launcher -> HTTP stream -> IPC filename/title, duration, seeking, subtitles, and normal files (${title})`
                );
            } catch (error) {
                console.error("Test MPV diagnostics:", diagnostics, "Exit code:", player.exitCode);
                throw error;
            } finally {
                socket?.destroy();
                player.kill();
            }
        }
        assert(requests.length >= 2);
        assert(
            requests.every((url) => url === "/stream?signature=a%2Fb%26c&token=one+two"),
            "HTTP query was modified"
        );
        console.log("PASS: exact signed-query transport; no production API or scrobbler was contacted.");
    } finally {
        server.closeAllConnections();
        server.close();
    }
    console.log(`Test artifacts retained at ${root}`);
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
