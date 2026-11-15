const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const nativeRequire = createRequire(path.join(root, "package.json"));

// Run the real TypeScript modules with isolated auth, database and network boundaries.
function loader(mocks = {}) {
    const cache = new Map();
    function load(file) {
        const absolute = path.resolve(root, file);
        if (cache.has(absolute)) return cache.get(absolute).exports;
        const module = { exports: {} };
        cache.set(absolute, module);
        const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
                jsx: ts.JsxEmit.ReactJSX,
            },
            fileName: absolute,
        }).outputText;
        const requireModule = (id) => {
            if (Object.hasOwn(mocks, id)) return mocks[id];
            if (!id.startsWith("@/") && !id.startsWith(".")) return nativeRequire(id);
            const target = id.startsWith("@/")
                ? path.join(root, "src", id.slice(2))
                : path.resolve(path.dirname(absolute), id);
            const resolved = [target, `${target}.ts`, `${target}.tsx`, path.join(target, "index.ts")].find(
                (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
            );
            if (!resolved) throw new Error(`Cannot resolve ${id} from ${file}`);
            return load(resolved);
        };
        new Function("require", "module", "exports", code)(requireModule, module, module.exports);
        return module.exports;
    }
    return load;
}

test("plain and encrypted backups retain catalog visibility and reject a wrong password", async () => {
    const load = loader();
    const backup = load("src/features/settings/utils/backup.ts");
    const prefs = load("src/lib/addons/catalog-preferences.ts");
    const catalog = {
        manifestId: "org.example.streaming",
        type: "movie",
        id: "netflix",
        addonName: "Streaming Catalogs",
    };
    const key = prefs.catalogPreferenceKey(catalog);
    const data = {
        integrations: { catalog_visibility: { [key]: false } },
        addons: [{ name: "Catalogs", url: "https://example.test/manifest.json", enabled: true }],
    };
    for (const password of [undefined, "integration-test-password"]) {
        const exported = await backup.createBackup(data, password);
        const restored = await backup.parseBackup(JSON.stringify(exported), password);
        assert.deepEqual(restored.data, data);
        assert.equal(prefs.isCatalogVisible(catalog, restored.data.integrations.catalog_visibility), false);
        assert.equal(
            prefs.isCatalogVisible({ ...catalog, id: "disney" }, restored.data.integrations.catalog_visibility),
            true
        );
        if (password) {
            assert.equal(JSON.stringify(exported).includes("catalog_visibility"), false);
            await assert.rejects(backup.parseBackup(JSON.stringify(exported), "wrong"), backup.BackupPasswordError);
            await assert.rejects(backup.parseBackup(JSON.stringify(exported)), backup.BackupPasswordError);
        }
    }
    await assert.rejects(backup.parseBackup('{"format":"debridui-backup","version":999,"data":{}}'), /newer version/);
    await assert.rejects(backup.parseBackup("invalid-json"), /valid JSON/);
});

test("backup restore is scoped to the signed-in user, skips duplicate addons, and retains catalog preferences", async () => {
    let transactionCount = 0;
    const inserted = [];
    const settingsWrites = [];
    const tx = {
        select: () => ({
            from: () => ({ where: async () => [{ url: "https://existing.test/manifest.json", order: 4 }] }),
        }),
        insert: () => ({ values: async (rows) => inserted.push(...rows) }),
    };
    const mocks = {
        "@/lib/auth": { auth: { api: { getSession: async () => ({ user: { id: "test-user" } }) } } },
        "next/headers": { headers: async () => new Headers() },
        "next/navigation": {
            redirect: () => {
                throw new Error("redirect");
            },
        },
        "next/cache": { revalidatePath: () => {} },
        "@/lib/db/drizzle": {
            db: {
                transaction: async (fn) => {
                    transactionCount++;
                    return fn(tx);
                },
            },
            upsertUserSettings: async (_, userId, settings) => settingsWrites.push({ userId, settings }),
        },
        "@/lib/db/schema": { addons: { url: "url", order: "order", userId: "userId" }, userAccounts: {} },
        "drizzle-orm": { eq: (...args) => args },
    };
    const actions = loader(mocks)("src/features/settings/actions/backup.ts");
    const addon = { name: "Test", enabled: true, url: "https://new.test/manifest.json" };
    const integrations = { catalog_visibility: { "manifest~movie~netflix": false } };
    const result = await actions.restoreBackup({
        addons: [{ ...addon, url: "https://existing.test/manifest.json" }, addon, addon],
        integrations,
    });
    assert.equal(result.addedAddons, 1);
    assert.equal(inserted[0].userId, "test-user");
    assert.equal(inserted[0].order, 5);
    assert.deepEqual(settingsWrites, [{ userId: "test-user", settings: integrations }]);
    mocks["@/lib/auth"].auth.api.getSession = async () => null;
    await assert.rejects(actions.restoreBackup({ integrations }), /redirect/);
    assert.equal(transactionCount, 1);
});

test("TorBox failure states with error details are reported as failed", () => {
    const TorBox = loader()("src/lib/debrid/torbox.ts").default;
    const client = new TorBox({ type: "torbox", apiKey: "test-only" });
    assert.equal(client.mapWebDownloadStatus("failed (Download): ERROR: unavailable", false), "failed");
    assert.equal(client.mapWebDownloadStatus("error: provider unavailable", false), "failed");
    assert.equal(client.mapWebDownloadStatus("downloading", false), "processing");
    const download = client.mapToWebDownload({
        id: 1,
        name: "Example",
        download_state: "failed (Download): ERROR: [youtube] abc: Video unavailable",
        download_finished: false,
        download_present: false,
        progress: 0,
        created_at: "2026-11-15T00:00:00Z",
    });
    assert.equal(download.status, "failed");
    assert.equal(download.error, "Video unavailable");
});

test("addon reorder swaps positions under an immediate unique constraint and rejects foreign ids", async () => {
    const rows = [
        { id: "cinemeta", order: 0 },
        { id: "trakt", order: 1 },
    ];
    const matches = (row, condition) =>
        condition.kind === "and"
            ? condition.parts.every((part) => matches(row, part))
            : condition.column === "userId" ||
              (condition.kind === "in"
                  ? condition.value.includes(row[condition.column])
                  : row[condition.column] === condition.value);
    const tx = {
        select: (selection) => ({
            from: () => ({
                where: async (condition) =>
                    selection.max
                        ? [{ max: Math.max(...rows.map((row) => row.order)) }]
                        : rows.filter((row) => matches(row, condition)),
            }),
        }),
        update: () => ({
            set: (changes) => ({
                where: async (condition) => {
                    const row = rows.find((item) => matches(item, condition));
                    assert.ok(row);
                    assert.equal(
                        rows.some((item) => item !== row && item.order === changes.order),
                        false,
                        "unique position collision"
                    );
                    Object.assign(row, changes);
                },
            }),
        }),
    };
    const actions = loader({
        "@/lib/auth": { auth: { api: { getSession: async () => ({ user: { id: "test-user" } }) } } },
        "next/headers": { headers: async () => new Headers() },
        "next/navigation": {
            redirect: () => {
                throw new Error("redirect");
            },
        },
        "next/cache": { revalidatePath: () => {} },
        "@/lib/db/drizzle": { db: { transaction: (fn) => fn(tx) } },
        "@/lib/db/schema": { addons: { id: "id", userId: "userId", order: "order" } },
        "drizzle-orm": {
            eq: (column, value) => ({ kind: "eq", column, value }),
            inArray: (column, value) => ({ kind: "in", column, value }),
            and: (...parts) => ({ kind: "and", parts }),
            sql: () => "max",
        },
    })("src/features/addons/actions/addons.ts");
    await actions.updateAddonOrders([
        { id: "trakt", order: 0 },
        { id: "cinemeta", order: 1 },
    ]);
    assert.deepEqual(rows, [
        { id: "cinemeta", order: 1 },
        { id: "trakt", order: 0 },
    ]);
    await assert.rejects(actions.updateAddonOrders([{ id: "foreign", order: 0 }]), /could not be reordered/);
    await assert.rejects(
        actions.updateAddonOrders([
            { id: "trakt", order: 0 },
            { id: "trakt", order: 1 },
        ])
    );
});

test("search history stays browser-local, deduplicates picks, and caps entries at 20", async () => {
    const storage = new Map();
    const originalWindow = global.window;
    global.window = {
        localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: (key) => storage.delete(key),
        },
    };
    try {
        const queryClient = { setQueryData: () => {} };
        const history = loader({
            "@tanstack/react-query": { useQueryClient: () => queryClient, useMutation: (options) => options },
        })("src/features/search/hooks/use-search-history.ts");
        // biome-ignore lint/correctness/useHookAtTopLevel: React Query hooks are mocked as plain callback factories in this isolated test.
        const record = history.useRecordSearchPick();
        for (let id = 0; id < 25; id++)
            await record.mutationFn({
                provider: "tmdb",
                providerId: String(id),
                title: `Title ${id}`,
                metadata: { kind: "tmdb", type: "movie" },
            });
        await record.mutationFn({
            provider: "tmdb",
            providerId: "24",
            title: "Latest pick",
            metadata: { kind: "tmdb", type: "movie" },
        });
        const items = JSON.parse(storage.get("debridui.search-history.v1"));
        assert.equal(items.length, 20);
        assert.equal(items.filter((entry) => entry.providerId === "24").length, 1);
        assert.equal(items[0].title, "Latest pick");
        // biome-ignore lint/correctness/useHookAtTopLevel: React Query hooks are mocked as plain callback factories in this isolated test.
        await history.useClearSearchHistory().mutationFn();
        assert.equal(storage.size, 0);
    } finally {
        global.window = originalWindow;
    }
});

test("TMDB API requires authentication and recommendations fall back to similar without duplicates", async () => {
    const originalFetch = global.fetch;
    const originalToken = process.env.TMDB_API_READ_TOKEN;
    process.env.TMDB_API_READ_TOKEN = "test-read-token";
    let signedIn = false;
    const paths = [];
    const media = (id) => ({
        id,
        title: `Movie ${id}`,
        release_date: "2026-01-01",
        poster_path: "/poster.jpg",
        vote_average: 8,
    });
    global.fetch = async (url, options) => {
        assert.equal(options.headers.Authorization, "Bearer test-read-token");
        paths.push(new URL(url).pathname);
        const results = String(url).includes("/recommendations") ? [media(42), media(5)] : [media(5), media(6)];
        return Response.json({ results });
    };
    try {
        const route = loader({
            "@/lib/auth": {
                auth: { api: { getSession: async () => (signedIn ? { user: { id: "test-user" } } : null) } },
            },
            "@/lib/db/drizzle": { db: {} },
            "@/lib/db/schema": { userSettings: {} },
        })("src/app/api/tmdb/[...path]/route.ts");
        const request = {
            headers: new Headers(),
            nextUrl: new URL("https://example.test/api/tmdb/movies/42/recommendations?limit=3"),
        };
        const params = { params: Promise.resolve({ path: ["movies", "42", "recommendations"] }) };
        assert.equal((await route.GET(request, params)).status, 401);
        assert.equal(paths.length, 0);
        signedIn = true;
        const response = await route.GET(request, params);
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.deepEqual(
            data.map((item) => item.movie.ids.tmdb),
            [5, 6]
        );
        assert.equal(paths.length, 2);
        assert.ok(data[0].movie.images.poster[0].includes("/w500/"));
        assert.equal(JSON.stringify(data).includes("test-read-token"), false);
    } finally {
        global.fetch = originalFetch;
        if (originalToken === undefined) delete process.env.TMDB_API_READ_TOKEN;
        else process.env.TMDB_API_READ_TOKEN = originalToken;
    }
});
