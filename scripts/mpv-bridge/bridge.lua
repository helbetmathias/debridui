local mp = require "mp"
local utils = require "mp.utils"

local function normalize(path)
    return path:gsub("\\", "/"):lower()
end

-- get_script_directory() can be nil for a single Lua file (rather than a script directory).
local directory = utils.split_path(debug.getinfo(1, "S").source:sub(2))
local root = normalize(directory):gsub("/+$", "") .. "/streams/"

mp.add_hook("on_load", 10, function()
    local path = mp.get_property("path", "")
    local normalized = normalize(path)
    -- Only interpret our own descriptors, never ordinary media or arbitrary playlists.
    if normalized:sub(1, #root) ~= root or normalized:find("/%.%./", 1) or normalized:sub(-4) ~= ".mkv" then
        return
    end
    local file = io.open(path, "rb")
    if not file then return end
    local contents = file:read(16385)
    file:close()
    if not contents or #contents > 16384 then return end
    local data = utils.parse_json(contents)
    if type(data) ~= "table" or data.kind ~= "debridui-mpv" or data.version ~= 1
        or type(data.url) ~= "string" or not data.url:match("^https?://")
        or data.url:find("[%z\r\n]") or type(data.title) ~= "string" then
        return
    end
    mp.set_property("stream-open-filename", data.url)
    mp.set_property("file-local-options/force-media-title", data.title)
    -- Remove the signed link after loading it. The friendly path remains available over IPC.
    os.remove(path)
end)
