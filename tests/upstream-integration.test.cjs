const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const nativeRequire = createRequire(path.join(root, "package.json"));

test("hero artwork stays static on desktop and mobile in both full and compact layouts", () => {
    const React = nativeRequire("react");
    const { renderToStaticMarkup } = nativeRequire("react-dom/server");
    const Hero = loader({
        "embla-carousel-react": { default: () => [() => {}, undefined] },
        "embla-carousel-autoplay": { default: () => ({ play: () => {} }) },
        "embla-carousel-wheel-gestures": { WheelGesturesPlugin: () => ({}) },
        "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
        "./watch-button": { WatchButton: ({ children }) => children },
        "@/features/media/hooks/use-hero-media": {
            useHeroMedia: () => ({
                isLoading: false,
                items: [
                    { movie: { title: "First movie", ids: { imdb: "tt0000001" } } },
                    { show: { title: "Second show", ids: { imdb: "tt0000002" } } },
                ],
            }),
        },
    })("src/features/media/components/hero-carousel.tsx").HeroCarousel;
    for (const compact of [false, true]) {
        const markup = renderToStaticMarkup(React.createElement(Hero, { compact }));
        assert.equal((markup.match(/<img\b/g) || []).length, 4);
        assert.doesNotMatch(markup, /scale-|duration-8000|transition-transform/);
        assert.match(markup, /Watch Now/);
        assert.match(markup, /Browse Episodes/);
    }
});

test("dashboard authenticates before reading saved playback and falls back if the database read fails", async () => {
    let session = null;
    const reads = [];
    const savedPlayback = { configured: true, connected: true, items: [] };
    let failing = false;
    const DashboardPage = loader({
        "next/navigation": {
            redirect: (path) => {
                throw new Error(path);
            },
        },
        "@/lib/auth": { getRequestSession: async () => session },
        "@/lib/simkl/service": {
            readSavedSimklPlayback: async (id) => {
                reads.push(id);
                if (failing) throw new Error("Database unavailable");
                return savedPlayback;
            },
        },
        "./_components/dashboard-content": { DashboardContent: () => null },
    })("src/app/(auth)/(app)/dashboard/page.tsx").default;
    await assert.rejects(DashboardPage(), /\/login/);
    assert.deepEqual(reads, []);
    session = { user: { id: "user-a" } };
    assert.deepEqual((await DashboardPage()).props.startup, { userId: "user-a", savedPlayback });
    assert.deepEqual(reads, ["user-a"]);
    failing = true;
    assert.equal((await DashboardPage()).props.startup.savedPlayback, undefined);
});

test("dashboard sizes the hero from the saved connection, not the live playback response", () => {
    const React = nativeRequire("react");
    const { renderToStaticMarkup } = nativeRequire("react-dom/server");
    let data;
    const Hero = ({ compact }) => React.createElement("div", { "data-compact": String(compact) });
    const Dashboard = loader({
        "@/features/media/components/hero-carousel": { HeroCarousel: Hero },
        "@/features/media/hooks/use-simkl": { useSimklPlayback: () => ({ data }) },
        "@/features/media/components/continue-watching": { ContinueWatching: () => null },
        "@/features/media/components/media-footer": { MediaFooter: () => null },
        "./addon-catalogs": { AddonCatalogs: () => null },
    })("src/app/(auth)/(app)/dashboard/_components/dashboard-content.tsx").DashboardContent;
    const render = (savedPlayback) =>
        renderToStaticMarkup(React.createElement(Dashboard, { startup: { userId: "user-a", savedPlayback } }));
    assert.match(render(undefined), /data-compact="false"/);
    for (const response of [
        undefined,
        { connected: true, items: [{ id: "saved" }] },
        { connected: false, items: [] },
    ]) {
        data = response;
        assert.match(render({ connected: false, items: [] }), /data-compact="false"/);
        assert.match(render({ connected: true, items: [] }), /data-compact="true"/);
    }
});

test("saved SIMKL playback bootstraps only the matching user and still revalidates", () => {
    let session = null;
    const { useSimklPlayback: playbackOptions } = loader({
        "@tanstack/react-query": { useQuery: (options) => options },
        "@/features/auth/components/auth-provider": { useAuth: () => ({ session }) },
    })("src/features/media/hooks/use-simkl.ts");
    const savedPlayback = { connected: true, items: [{ id: "saved" }] };
    const startup = { userId: "user-a", savedPlayback };
    assert.equal(playbackOptions(startup).initialData, savedPlayback);
    assert.equal(playbackOptions(startup).enabled, false);
    session = { user: { id: "user-a" } };
    assert.equal(playbackOptions(startup).initialDataUpdatedAt, 0);
    assert.equal(playbackOptions(startup).enabled, true);
    session = { user: { id: "user-b" } };
    assert.deepEqual(playbackOptions(startup).queryKey, ["simkl", "user-b", "playback"]);
    assert.equal(playbackOptions(startup).initialData, undefined);
});

test("Continue Watching removes normal explanatory copy but retains refresh failure feedback", () => {
    const React = nativeRequire("react");
    const { renderToStaticMarkup } = nativeRequire("react-dom/server");
    let stale = false;
    const ContinueWatching = loader({
        "embla-carousel-react": { default: () => [() => {}, undefined] },
        "./continue-watching-card": { ContinueWatchingCard: () => React.createElement("p", null, "Saved movie") },
    })("src/features/media/components/continue-watching.tsx").ContinueWatching;
    const render = () =>
        renderToStaticMarkup(
            React.createElement(ContinueWatching, {
                userId: "viewer",
                playback: { data: { connected: true, items: [{ id: "saved" }], stale }, refetch: () => {} },
            })
        );
    assert.equal(renderToStaticMarkup(React.createElement(ContinueWatching, { playback: { isFetching: true } })), "");
    const regular = render();
    assert.doesNotMatch(regular, /Saved progress from your connected scrobblers|Resume selects a fresh source/);
    assert.match(regular, /basis-\[208px\]/);
    assert.match(regular, /disabled:hidden/);
    stale = true;
    assert.match(render(), /Could not refresh SIMKL; showing saved progress/);
});

test("compact playback cards keep movie/episode source requests unchanged and label mobile Resume", () => {
    const React = nativeRequire("react");
    const { renderToStaticMarkup } = nativeRequire("react-dom/server");
    const requests = [];
    const Card = loader({
        "@tanstack/react-query": { ...nativeRequire("@tanstack/react-query"), useQuery: () => ({ data: undefined }) },
        "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
        "./watch-button": {
            WatchButton: ({ request, children }) => {
                requests.push(request);
                return children;
            },
        },
    })("src/features/media/components/continue-watching-card.tsx").ContinueWatchingCard;
    const episode = {
        id: "saved",
        type: "show",
        title: "Silo",
        imdbId: "tt14688458",
        progress: 35,
        pausedAt: "2026-11-16T12:00:00Z",
        episode: { season: 1, number: 2, title: "Truth" },
    };
    const markup = renderToStaticMarkup(React.createElement(Card, { item: episode, onHide: () => {} }));
    assert.match(markup, /aria-label="Resume Silo"/);
    assert.match(markup, /aria-label="Options for Silo"/);
    assert.match(markup, /35% watched/);
    assert.match(markup, /sm:hidden/);
    assert.match(markup, /hidden sm:flex/);
    assert.equal(requests.length, 2);
    for (const request of requests) {
        assert.equal(request.imdbId, episode.imdbId);
        assert.equal(request.type, "show");
        assert.equal(request.resume, true);
        assert.deepEqual(request.tvParams, { season: 1, episode: 2, title: "Truth" });
    }
    requests.length = 0;
    renderToStaticMarkup(React.createElement(Card, { item: { ...episode, episodeMapped: false }, onHide: () => {} }));
    assert.equal(requests.length, 0);
    const next = {
        ...episode,
        id: "next-up:20:2:1",
        episode: { season: 2, number: 1, title: "Next season" },
        lastWatchedEpisode: episode.episode,
        lastWatchedAt: episode.pausedAt,
    };
    const nextMarkup = renderToStaticMarkup(React.createElement(Card, { item: next, onHide: () => {} }));
    assert.match(nextMarkup, /aria-label="Play Silo, S02 E01"/);
    assert.match(nextMarkup, /Up Next/);
    assert.doesNotMatch(nextMarkup, /<progress|35% watched/);
    assert.equal(requests.length, 2);
    for (const request of requests) {
        assert.equal(request.resume, false);
        assert.deepEqual(request.tvParams, { season: 2, episode: 1, title: "Next season" });
    }
});

test("Continue Watching hide and undo are local to the user and the saved playback", () => {
    const browser = new EventTarget();
    const storage = new Map();
    browser.localStorage = { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) };
    const originalWindow = global.window;
    global.window = browser;
    const {
        playbackVisibilityKey,
        parseHiddenPlaybacks,
        readHiddenPlaybacks,
        setPlaybackHidden,
        subscribeHiddenPlaybacks,
    } = loader()("src/features/media/utils/hidden-playbacks.ts");
    const item = { id: "42", pausedAt: "2026-11-16T12:00:00Z" };
    const newer = { ...item, pausedAt: "2026-11-16T12:01:00Z" };
    let notifications = 0;
    const stop = subscribeHiddenPlaybacks(() => notifications++);
    const read = (userId) => parseHiddenPlaybacks(readHiddenPlaybacks(userId));
    try {
        setPlaybackHidden("viewer-a", item, true);
        assert.deepEqual(read("viewer-a"), [playbackVisibilityKey(item)]);
        assert.ok(!read("viewer-a").includes(playbackVisibilityKey(newer)));
        assert.deepEqual(read("viewer-b"), []);
        assert.equal(notifications, 1);
        setPlaybackHidden("viewer-a", item, false);
        assert.deepEqual(read("viewer-a"), []);
        assert.equal(notifications, 2);
        stop();
        setPlaybackHidden("viewer-a", item, true);
        assert.equal(notifications, 2);
    } finally {
        stop();
        if (originalWindow === undefined) delete global.window;
        else global.window = originalWindow;
    }
});

test("targeted SIMKL migration verifies its schema and never replays historical cleanup", async () => {
    const { applySimklMigration } = require("../scripts/apply-simkl-migration.cjs");
    const migration = {
        sql: fs.readFileSync(path.join(root, "drizzle/0007_simkl_connections.sql"), "utf8"),
        hash: "current",
        when: 7,
    };
    const previous = { hash: "previous", when: 6 };
    assert.match(migration.sql, /^CREATE TABLE IF NOT EXISTS/);
    assert.doesNotMatch(migration.sql, /(?:^|;)\s*(?:DROP|TRUNCATE|DELETE)\b/i);
    function database(last, mismatch = false) {
        const writes = [];
        const tx = async (strings) => {
            const query = strings.join("?");
            if (query.includes("udt_name")) return [{ udt_name: "uuid" }];
            if (query.includes("to_regclass")) return [{ journal: last ? "journal" : null }];
            if (query.includes("order by created_at")) return [last];
            if (query.includes("column_name, data_type"))
                return Object.entries({
                    user_id: "uuid",
                    credentials: "text",
                    oauth_state: "text",
                    reconnect_required: mismatch ? "text" : "boolean",
                    playback_cache: "jsonb",
                    checked_at: "timestamp with time zone",
                    retry_at: "timestamp with time zone",
                }).map(([column_name, data_type]) => ({
                    column_name,
                    data_type,
                    is_nullable: ["user_id", "reconnect_required"].includes(column_name) ? "NO" : "YES",
                    column_default: column_name === "reconnect_required" ? "false" : null,
                }));
            if (query.includes("pg_constraint"))
                return [
                    { definition: "PRIMARY KEY (user_id)" },
                    { definition: 'FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE' },
                ];
            if (query.includes("insert into")) writes.push("journal");
            return [];
        };
        tx.unsafe = async (query) => writes.push(query);
        return { writes, sql: { begin: async (callback) => callback(tx) } };
    }
    for (const last of [
        null,
        { hash: "old", created_at: 2 },
        { hash: "previous", created_at: 6 },
        { hash: "current", created_at: 7 },
    ]) {
        const db = database(last);
        await applySimklMigration(db.sql, migration, previous);
        assert.equal(db.writes[0], migration.sql);
        assert.equal(db.writes.includes("journal"), last?.created_at === 6);
    }
    const mismatch = database(null, true);
    await assert.rejects(applySimklMigration(mismatch.sql, migration, previous), /expected schema/);
    assert.equal(mismatch.writes.includes("journal"), false);
    const newer = database({ hash: "newer", created_at: 8 });
    await assert.rejects(applySimklMigration(newer.sql, migration, previous), /newer migration/);
    assert.equal(newer.writes.length, 0);
});

// Fixed, non-production credentials for local boundary tests only.
function simklTestEnvironment() {
    const values = {
        SIMKL_CLIENT_ID: "test-client",
        SIMKL_CLIENT_SECRET: "test-secret-not-real",
        SIMKL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    Object.assign(process.env, values);
    return () => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    };
}

function simklDatabase() {
    const rows = new Map();
    const table = Object.fromEntries(
        ["userId", "credentials", "oauthState", "playbackCache", "checkedAt", "retryAt"].map((key) => [key, key])
    );
    const orm = {
        eq: (key, value) => (row) => row[key] === value,
        and:
            (...conditions) =>
            (row) =>
                conditions.every((test) => test(row)),
    };
    let queue = Promise.resolve();
    const db = {
        select: () => ({
            from: () => ({
                where: (test) => {
                    const result = () => [...rows.values()].filter(test).map((row) => ({ ...row }));
                    const query = Promise.resolve(result());
                    query.for = async () => result();
                    return query;
                },
            }),
        }),
        insert: () => ({
            values: (value) => ({
                onConflictDoUpdate: async ({ set }) => {
                    rows.set(value.userId, rows.has(value.userId) ? { ...rows.get(value.userId), ...set } : value);
                },
            }),
        }),
        update: () => ({
            set: (updates) => ({
                where: (test) => {
                    const changed = [...rows.values()].filter(test);
                    for (const row of changed) Object.assign(row, updates);
                    const result = Promise.resolve(changed);
                    result.returning = async () => changed.map(({ userId }) => ({ userId }));
                    return result;
                },
            }),
        }),
        delete: () => ({
            where: async (test) => {
                for (const [id, row] of rows) if (test(row)) rows.delete(id);
            },
        }),
        transaction: (callback) => {
            const run = queue.then(() => callback(db));
            queue = run.catch(() => undefined);
            return run;
        },
    };
    return {
        db,
        rows,
        mocks: {
            "server-only": {},
            "drizzle-orm": orm,
            "@/lib/db/schema": { simklConnections: table },
            "@/lib/db/drizzle": { db },
        },
    };
}

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

test("hero source preferences are independent, limited to two, and mix/deduplicate fairly", () => {
    const load = loader();
    const { serverSettingsSchema } = load("src/lib/schemas.ts");
    const { catalogPreferenceKey, getHeroCatalogKeys } = load("src/lib/addons/catalog-preferences.ts");
    const { mixHeroItems } = load("src/lib/media/hero.ts");
    const catalogs = ["movie", "series"].map((type) => ({
        manifestId: "cinemeta",
        addonName: "Cinemeta",
        name: "Popular",
        id: "top",
        type,
        addonEnabled: true,
    }));
    const defaults = catalogs.map(catalogPreferenceKey);
    assert.deepEqual(getHeroCatalogKeys(catalogs), defaults);
    assert.deepEqual(getHeroCatalogKeys(catalogs, []), []);
    assert.deepEqual(getHeroCatalogKeys(catalogs, ["removed-addon", defaults[1]]), [defaults[1]]);
    assert.deepEqual(getHeroCatalogKeys(catalogs.map((item) => ({ ...item, addonEnabled: false }))), []);
    assert.deepEqual(
        serverSettingsSchema.parse({ hero_catalogs: defaults, catalog_visibility: { [defaults[0]]: false } })
            .hero_catalogs,
        defaults
    );
    assert.equal(serverSettingsSchema.safeParse({ hero_catalogs: [...defaults, "third"] }).success, false);
    assert.equal(serverSettingsSchema.safeParse({ hero_catalogs: [defaults[0], defaults[0]] }).success, false);
    const movies = Array.from({ length: 10 }, (_, n) => ({ movie: { title: `Movie ${n}`, ids: { imdb: `tt${n}` } } }));
    const shows = Array.from({ length: 10 }, (_, n) => ({ show: { title: `Show ${n}`, ids: { imdb: `tt${n}` } } }));
    const mixed = mixHeroItems([movies, shows], 10);
    assert.equal(mixed.filter((item) => item.movie).length, 5);
    assert.equal(mixed.filter((item) => item.show).length, 5);
    assert.equal(mixHeroItems([movies, movies], 10).length, 10);
    assert.equal(mixHeroItems([[], shows], 10).length, 10);
});

test("SIMKL encryption binds credentials to the user; OAuth is scoped, PKCE-protected and expires", () => {
    const restore = simklTestEnvironment();
    try {
        const security = loader({ "server-only": {} })("src/lib/simkl/security.ts");
        const encrypted = security.seal({ accessToken: "private-access" }, "tokens:user-a");
        assert.equal(encrypted.includes("private-access"), false);
        assert.deepEqual(security.unseal(encrypted, "tokens:user-a"), { accessToken: "private-access" });
        assert.throws(() => security.unseal(encrypted, "tokens:user-b"));
        const pending = security.createAuthorization("user-a");
        const url = new URL(pending.url);
        assert.equal(url.origin, "https://simkl.com");
        assert.equal(url.searchParams.get("scope"), "media:read");
        assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/simkl/callback");
        assert.equal(url.searchParams.has("client_secret"), false);
        assert.equal(url.searchParams.get("code_challenge_method"), "S256");
        const payload = security.validateAuthorization(pending.cookie, pending.state, "user-a");
        const challenge = require("node:crypto").createHash("sha256").update(payload.verifier).digest("base64url");
        assert.equal(url.searchParams.get("code_challenge"), challenge);
        assert.throws(() => security.validateAuthorization(pending.cookie, pending.state, "user-b"));
        assert.throws(() => security.validateAuthorization(pending.cookie, "wrong", "user-a"));
        const expired = security.seal({ ...payload, expires: 0 }, "oauth");
        assert.throws(() => security.validateAuthorization(expired, pending.state, "user-a"));
        process.env.SIMKL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
        assert.throws(() => security.unseal(encrypted, "tokens:user-a"));
        process.env.NEXT_PUBLIC_APP_URL = "http://unsafe.example";
        assert.equal(security.isSimklConfigured(), false);
    } finally {
        restore();
    }
});

test("SIMKL playback normalizes real movies/episodes, keeps latest point, and guards anime mappings", () => {
    const { normalizePlayback, playbackStamp } = loader()("src/lib/simkl/playback.ts");
    const movie = {
        id: 1,
        type: "movie",
        progress: 35,
        paused_at: "2026-11-16T06:30:00Z",
        movie: { title: "Example", year: 2026, ids: { imdb: "tt123", simkl: 1, tmdb: "10" } },
    };
    const show = {
        id: 2,
        type: "episode",
        progress: 50.5,
        paused_at: "2026-11-16T06:40:00Z",
        show: { title: "Show", ids: { imdb: "tt456", simkl: 2 } },
        episode: { season: 1, number: 3, title: "Truth" },
    };
    const result = normalizePlayback([
        movie,
        show,
        { ...movie, id: 3, progress: 20, paused_at: "2026-11-15T06:00:00Z" },
        { ...movie, id: 4, progress: 100 },
        { id: 5, progress: "invalid" },
    ]);
    assert.equal(result.length, 2);
    assert.equal(result[0].episode.number, 3);
    assert.equal(result[1].progress, 35);
    const anime = { ...show, show: undefined, anime: show.show };
    assert.equal(normalizePlayback([anime])[0].episodeMapped, false);
    const mapped = normalizePlayback([{ ...anime, episode: { ...show.episode, tvdb_season: 2, tvdb_number: 4 } }])[0];
    assert.equal(mapped.episodeMapped, true);
    assert.deepEqual(mapped.episode, { season: 2, number: 4, title: "Truth" });
    assert.throws(() => normalizePlayback({ error: "bad" }));
    assert.notEqual(playbackStamp({ movies: { playback: "one" } }), playbackStamp({ movies: { playback: "two" } }));
});

test("SIMKL Next Up uses watched history and airdates, filters invalid matches, and syncs only on TV changes", async () => {
    const load = loader();
    const { mergeNextUp, syncNextUp } = load("src/lib/simkl/next-up.ts");
    const { getContinueWatchingItems } = load("src/features/media/utils/continue-watching-items.ts");
    const { playbackVisibilityKey } = load("src/features/media/utils/hidden-playbacks.ts");
    const first = "2026-08-01T12:00:00Z";
    const second = "2026-08-02T12:00:00Z";
    const last = "2026-08-03T12:00:00Z";
    const show = {
        status: "watching",
        last_watched_at: first,
        last_watched: "S01E10",
        next_to_watch: "S02E01",
        next_to_watch_info: { season: 2, episode: 1, date: "2000-01-01T00:00:00Z", title: "Season premiere" },
        show: { title: "Silo", ids: { simkl: 23, imdb: "tt14688458", tmdb: 1, slug: "silo" } },
    };
    const calls = [];
    let response = { shows: [show] };
    const read = async (since) => {
        calls.push(since);
        return response;
    };
    const initial = await syncNextUp({ all: first, tv_shows: { watching: first } }, undefined, read);
    const [next] = initial.items;
    assert.deepEqual(next.episode, { season: 2, number: 1, title: "Season premiere" });
    assert.equal(next.simklUrl, "https://simkl.com/tv/23/silo");
    assert.deepEqual(
        await syncNextUp({ all: second, tv_shows: { watching: first, playback: second } }, initial, read),
        initial
    );
    assert.deepEqual(calls, [undefined]);
    for (const invalid of [
        { ...show, last_watched: null },
        { ...show, status: "hold" },
        { ...show, status: "completed" },
        { ...show, next_to_watch: null },
        { ...show, next_to_watch: "S01E10" },
        { ...show, next_to_watch_info: { ...show.next_to_watch_info, date: "2099-01-01T00:00:00Z" } },
        { ...show, show: { ...show.show, ids: { simkl: 23 } } },
    ]) {
        assert.deepEqual(mergeNextUp({ shows: [invalid] }, initial.items), []);
    }
    response = { shows: [{ ...show, next_to_watch: "S02E02" }] };
    const advanced = await syncNextUp({ all: second, tv_shows: { watching: second } }, initial, read);
    assert.deepEqual(advanced.items[0].episode, { season: 2, number: 2, title: undefined });
    response = { shows: [{ ...show, status: "completed" }] };
    const completed = await syncNextUp({ all: last, tv_shows: { watching: second, completed: last } }, advanced, read);
    assert.deepEqual(completed.items, []);
    response = {};
    const removed = await syncNextUp(
        { all: last, tv_shows: { watching: second, removed_from_list: last } },
        advanced,
        read
    );
    assert.deepEqual(removed.items, []);
    assert.deepEqual(calls, [undefined, first, second, undefined]);
    assert.throws(() => mergeNextUp({ error: "invalid" }, advanced.items));

    const pause = {
        id: "pause",
        type: "show",
        imdbId: next.imdbId,
        progress: 45,
        pausedAt: second,
        episode: { season: 1, number: 10 },
    };
    const playback = { connected: true, items: [pause], nextUp: [next] };
    assert.deepEqual(getContinueWatchingItems(playback, new Set()), [pause]);
    assert.deepEqual(getContinueWatchingItems(playback, new Set([playbackVisibilityKey(pause)])), []);
    const stale = { ...pause, pausedAt: "2026-08-01T11:00:00Z" };
    const finished = { ...playback, items: [stale] };
    assert.deepEqual(getContinueWatchingItems(finished, new Set()), [next]);
    assert.deepEqual(getContinueWatchingItems(finished, new Set([playbackVisibilityKey(next)])), []);
    assert.deepEqual(getContinueWatchingItems({ ...playback, connected: false }, new Set()), []);
});

test("SIMKL callback state is single-use, scoped to its owner, and tokens never enter status", async () => {
    const restore = simklTestEnvironment();
    const database = simklDatabase();
    let grants = 0;
    const credentials = {
        accessToken: "test-access",
        refreshToken: "test-refresh",
        expiresAt: Date.now() + 86400_000,
        refreshExpiresAt: Date.now() + 86400_000 * 180,
    };
    const load = loader({
        ...database.mocks,
        "@/lib/simkl/client": {},
        "./client": {
            parseCredentials: (value) => value,
            tokenGrant: async () => {
                grants++;
                return credentials;
            },
            revokeGrant: async () => {},
        },
    });
    try {
        const service = load("src/lib/simkl/service.ts");
        const pending = await service.startAuthorization("user-a");
        await assert.rejects(service.finishAuthorization("user-b", pending.cookie, pending.state, "code"));
        assert.equal(grants, 0);
        await service.finishAuthorization("user-a", pending.cookie, pending.state, "code");
        assert.equal(grants, 1);
        assert.deepEqual(await service.connectionStatus("user-a"), { configured: true, connected: true });
        assert.deepEqual(await service.connectionStatus("user-b"), { configured: true, connected: false });
        assert.equal(database.rows.get("user-a").credentials.includes("test-access"), false);
        await assert.rejects(service.finishAuthorization("user-a", pending.cookie, pending.state, "code"));
        assert.equal(grants, 1);
    } finally {
        restore();
    }
});

test("dashboard snapshot reads only scoped, committed SIMKL playback without contacting the provider", async () => {
    const row = {
        connected: true,
        reconnectRequired: false,
        playbackCache: { stamp: "internal-stamp", items: [{ id: "saved" }], syncedAt: "2026-11-22T07:00:00Z" },
        retryAt: new Date(Date.now() + 60_000),
    };
    const rows = new Map([["user-a", row]]);
    const db = {
        select: (fields) => {
            assert.deepEqual(Object.keys(fields), ["connected", "reconnectRequired", "playbackCache", "retryAt"]);
            assert.deepEqual(fields.connected, { present: "credentials" });
            return { from: () => ({ where: ({ id }) => [rows.get(id)].filter(Boolean) }) };
        },
    };
    let configured = true;
    const { readSavedSimklPlayback } = loader({
        "server-only": {},
        "@/lib/db/drizzle": { db },
        "@/lib/db/schema": { simklConnections: { credentials: "credentials", userId: "userId" } },
        "drizzle-orm": {
            eq: (column, id) => {
                assert.equal(column, "userId");
                return { id };
            },
            isNotNull: (present) => ({ present }),
        },
        "./client": {},
        "./security": { isSimklConfigured: () => configured },
    })("src/lib/simkl/service.ts");
    assert.deepEqual(await readSavedSimklPlayback("user-a"), {
        configured: true,
        connected: true,
        items: row.playbackCache.items,
        syncedAt: row.playbackCache.syncedAt,
        stale: true,
    });
    assert.deepEqual((await readSavedSimklPlayback("user-b")).items, []);
    rows.set("user-b", { ...row, connected: false, reconnectRequired: true });
    assert.deepEqual(await readSavedSimklPlayback("user-b"), {
        configured: true,
        connected: false,
        items: [],
        reconnectRequired: true,
    });
    configured = false;
    assert.deepEqual(await readSavedSimklPlayback("user-a"), { configured: false, connected: false, items: [] });
});

test("SIMKL sync serializes refresh, isolates caches, gates playback on activities, and backs off", async () => {
    const restore = simklTestEnvironment();
    const database = simklDatabase();
    let grants = 0;
    let playbackReads = 0;
    let activitiesReads = 0;
    const nextUpReads = [];
    let fail = false;
    let nextUpFail = false;
    let stamp = "one";
    let tvChange = "2026-08-01T12:00:00Z";
    class SimklError extends Error {
        constructor(status, retrySeconds = 60, code) {
            super("test provider error");
            Object.assign(this, { status, retrySeconds, code });
        }
    }
    const load = loader({
        ...database.mocks,
        "./client": {
            parseCredentials: (value) => value,
            SimklError,
            tokenGrant: async () => {
                grants++;
                return {
                    accessToken: "new-access",
                    refreshToken: "refresh",
                    expiresAt: Date.now() + 86400_000,
                    refreshExpiresAt: Date.now() + 86400_000 * 180,
                };
            },
            readSimkl: async (endpoint) => {
                if (fail) throw new SimklError(429, 120);
                if (endpoint === "/sync/activities") {
                    activitiesReads++;
                    return { all: tvChange, tv_shows: { watching: tvChange }, movies: { playback: stamp } };
                }
                playbackReads++;
                return [
                    {
                        id: 1,
                        type: "movie",
                        progress: 35,
                        paused_at: "2026-11-16T06:30:00Z",
                        movie: { title: "Example", ids: { imdb: "tt123", simkl: 1 } },
                    },
                ];
            },
            readSimklNextUp: async (_token, since) => {
                nextUpReads.push(since);
                if (nextUpFail) throw new SimklError(503);
                return {
                    shows: [
                        {
                            status: "watching",
                            last_watched_at: tvChange,
                            last_watched: "S01E01",
                            next_to_watch: "S01E02",
                            show: { title: "Example Show", ids: { imdb: "tt543", simkl: 2 } },
                        },
                    ],
                };
            },
        },
    });
    try {
        const { seal } = load("src/lib/simkl/security.ts");
        database.rows.set("user-a", {
            userId: "user-a",
            credentials: seal(
                { accessToken: "old", refreshToken: "refresh", expiresAt: 0, refreshExpiresAt: Date.now() + 86400_000 },
                "tokens:user-a"
            ),
        });
        const service = load("src/lib/simkl/service.ts");
        const results = await Promise.all([service.getSimklPlayback("user-a"), service.getSimklPlayback("user-a")]);
        assert.equal(grants, 1);
        assert.equal(playbackReads, 1);
        assert.equal(activitiesReads, 1);
        assert.equal(results[0].items[0].progress, 35);
        assert.equal(results[0].nextUp[0].episode.number, 2);
        assert.deepEqual(results[0].nextUp, results[1].nextUp);
        assert.deepEqual(nextUpReads, [undefined]);
        assert.equal(JSON.stringify(results).includes("new-access"), false);
        assert.equal((await service.getSimklPlayback("user-b")).items.length, 0);
        database.rows.get("user-a").checkedAt = new Date(0);
        await service.getSimklPlayback("user-a");
        assert.equal(activitiesReads, 2);
        assert.equal(playbackReads, 1);
        stamp = "two";
        tvChange = "2026-08-02T12:00:00Z";
        nextUpFail = true;
        database.rows.get("user-a").checkedAt = new Date(0);
        const playbackOnly = await service.getSimklPlayback("user-a");
        assert.equal(playbackReads, 2);
        assert.deepEqual(nextUpReads, [undefined, "2026-08-01T12:00:00Z"]);
        assert.equal(playbackOnly.stale, true);
        assert.deepEqual(playbackOnly.items, results[0].items);
        assert.deepEqual(playbackOnly.nextUp, results[0].nextUp);
        fail = true;
        database.rows.get("user-a").checkedAt = new Date(0);
        database.rows.get("user-a").retryAt = null;
        const stale = await service.getSimklPlayback("user-a");
        assert.equal(stale.stale, true);
        assert.equal(stale.items[0].progress, 35);
        assert.equal(database.rows.get("user-a").playbackCache.stamp.includes("two"), true);
        assert.ok(database.rows.get("user-a").retryAt.getTime() > Date.now() + 110_000);
    } finally {
        restore();
    }
});

test("SIMKL provider sends only server-side credentials, read-only calls, and safe rate-limit errors", async () => {
    const restore = simklTestEnvironment();
    const originalFetch = global.fetch;
    const requests = [];
    let rateLimited = false;
    global.fetch = async (url, init) => {
        requests.push({ url: String(url), init });
        if (rateLimited)
            return new Response(JSON.stringify({ error: "rate_limit", private: "not-for-clients" }), {
                status: 429,
                headers: { "Retry-After": "120" },
            });
        return new Response(
            JSON.stringify({
                access_token: "access",
                refresh_token: "refresh",
                expires_in: 604800,
                scope: "media:read",
                token_type: "Bearer",
            })
        );
    };
    try {
        const provider = loader({ "server-only": {} })("src/lib/simkl/client.ts");
        const result = await provider.tokenGrant({
            grant_type: "authorization_code",
            code: "code",
            code_verifier: "verifier",
            redirect_uri: "http://localhost:3000/api/simkl/callback",
        });
        assert.equal(result.accessToken, "access");
        assert.equal(new URLSearchParams(requests[0].init.body).get("client_secret"), "test-secret-not-real");
        assert.equal(requests[0].url.includes("test-secret"), false);
        await provider.readSimkl("/sync/playback", result.accessToken);
        assert.equal(requests[1].init.headers.Authorization, "Bearer access");
        assert.equal(new URL(requests[1].url).searchParams.get("app-name"), "debridui");
        assert.equal(requests[1].init.cache, "no-store");
        await provider.readSimklNextUp(result.accessToken);
        await provider.readSimklNextUp(result.accessToken, "2026-08-03T12:00:00Z");
        assert.equal(new URL(requests[2].url).pathname, "/sync/all-items/shows/watching");
        assert.equal(new URL(requests[2].url).searchParams.get("next_watch_info"), "yes");
        assert.equal(new URL(requests[3].url).pathname, "/sync/all-items/shows");
        assert.equal(new URL(requests[3].url).searchParams.get("date_from"), "2026-08-03T12:00:00Z");
        assert.equal(requests[3].init.headers.Authorization, "Bearer access");
        rateLimited = true;
        await assert.rejects(
            provider.readSimkl("/sync/playback", result.accessToken),
            (error) => error.status === 429 && error.retrySeconds === 120 && !error.message.includes("not-for-clients")
        );
    } finally {
        global.fetch = originalFetch;
        restore();
    }
});

test("SIMKL recommendations preserve community order, resolve linkable IDs, and fill with genre picks", async () => {
    const restore = simklTestEnvironment();
    const originalFetch = globalThis.fetch;
    const requests = [];
    const item = (simkl, ids = {}, type = "tv", poster = "74/abc123") => ({
        ids: { simkl, slug: `item-${simkl}`, ...ids },
        title: `Item ${simkl}`,
        poster,
        year: 2024,
        type,
    });
    globalThis.fetch = async (input, options) => {
        const url = new URL(input);
        requests.push(url.pathname);
        assert.equal(url.origin, "https://api.simkl.com");
        assert.equal(url.searchParams.get("client_id"), "test-client");
        assert.equal(url.searchParams.get("app-name"), "debridui");
        assert.ok(url.searchParams.get("app-version"));
        assert.ok(options.headers["User-Agent"]);
        assert.equal(new Headers(options.headers).has("authorization"), false);
        assert.ok(options.signal);
        if (url.pathname === "/redirect") {
            assert.equal(options.redirect, "manual");
            assert.equal(url.searchParams.get("type"), "tv");
            assert.equal(url.searchParams.get("tmdb"), "100");
            return Response.redirect("https://simkl.com/tv/1/source", 301);
        }
        assert.equal(options.redirect, "error");
        assert.ok(options.next.revalidate > 0);
        if (url.pathname === "/tv/1") {
            return Response.json({
                ids: { simkl: 1, imdb: "tt0000001", tmdb: "100" },
                users_recommendations: [item(2), item(3), item(4), item(5), item(6), item(7), item(8)],
                similar: [
                    item(3, { imdb: "tt0000003" }, "show"),
                    item(10, { tmdb: "100" }),
                    item(11, { tmdb: "200" }),
                    item(12, { tmdb: "120" }, "anime"),
                    item(13, { imdb: "tt0000013" }, "tv", "../invalid"),
                    item(14, {}, "tv"),
                ],
            });
        }
        if (url.pathname === "/tv/2")
            return Response.json({ ids: { simkl: 2, tmdb: 200 }, ratings: { imdb: { rating: 7.8 } } });
        return new Response(null, { status: 404 });
    };
    try {
        const { getSimklRecommendations } = loader({ "server-only": {} })("src/lib/simkl/recommendations.ts");
        const result = await getSimklRecommendations({ id: "100", type: "show" });
        assert.deepEqual(requests, ["/redirect", "/tv/1", "/tv/2", "/tv/4", "/tv/5", "/tv/6"]);
        assert.deepEqual(
            result.map(({ simklId }) => simklId),
            ["2", "3", "13"]
        );
        assert.deepEqual(
            result.map(({ media }) => media.rating),
            [7.8, undefined, undefined]
        );
        assert.deepEqual(
            result.map(({ media }) => media.ids.slug),
            ["200", "tt0000003", "tt0000013"]
        );
        assert.deepEqual(
            result.map(({ simklUrl }) => simklUrl),
            [2, 3, 13].map((id) => `https://simkl.com/tv/${id}/item-${id}`)
        );
        assert.equal(
            new URL(result[0].media.images.poster[0]).searchParams.get("url"),
            "https://simkl.in/posters/74/abc123_m.webp"
        );
        assert.equal(result[2].media.images, undefined);
    } finally {
        globalThis.fetch = originalFetch;
        restore();
    }
});

test("SIMKL recommendations never follow lookups to an unexpected host or media type", async () => {
    const restore = simklTestEnvironment();
    const originalFetch = globalThis.fetch;
    try {
        const { getSimklRecommendations } = loader({ "server-only": {} })("src/lib/simkl/recommendations.ts");
        for (const location of [
            "https://example.com/movies/1/test",
            "https://simkl.com/tv/1/test",
            "https://simkl.com/search/1",
        ]) {
            let callCount = 0;
            globalThis.fetch = async (input) => {
                const url = new URL(input);
                assert.equal(url.pathname, "/redirect");
                assert.equal(url.searchParams.get("imdb"), "tt0000001");
                callCount++;
                return Response.redirect(location, 301);
            };
            assert.deepEqual(await getSimklRecommendations({ id: "tt0000001", type: "movie" }), []);
            assert.equal(callCount, 1);
        }
    } finally {
        globalThis.fetch = originalFetch;
        restore();
    }
});

test("SIMKL IMDb rating lookup uses cached public details and never substitutes another score", async () => {
    const restore = simklTestEnvironment();
    const originalFetch = globalThis.fetch;
    const { getSimklImdbRating } = loader({ "server-only": {} })("src/lib/simkl/recommendations.ts");
    try {
        const cases = [
            { type: "movie", namespace: "movies", id: 42, imdb: { rating: 8.3 }, expected: 8.3 },
            { type: "show", namespace: "tv", id: 42, imdb: { rating: 6.7 }, expected: 6.7 },
            { type: "show", namespace: "tv", id: 42, imdb: undefined, expected: null },
            { type: "show", namespace: "tv", id: 42, imdb: { rating: 11 }, expected: null },
            { type: "show", namespace: "tv", id: 42, imdb: { rating: 0 }, expected: null },
            { type: "show", namespace: "tv", id: 43, imdb: { rating: 9.1 }, expected: null },
        ];
        for (const sample of cases) {
            globalThis.fetch = async (input, options) => {
                const url = new URL(input);
                assert.equal(url.origin, "https://api.simkl.com");
                assert.equal(url.pathname, `/${sample.namespace}/42`);
                assert.equal(options.redirect, "error");
                assert.ok(options.next.revalidate > 0);
                assert.equal(new Headers(options.headers).has("authorization"), false);
                return Response.json({
                    ids: { simkl: sample.id },
                    ratings: { imdb: sample.imdb, simkl: { rating: 9.5 } },
                });
            };
            assert.equal(await getSimklImdbRating({ id: "42", type: sample.type }), sample.expected);
        }
    } finally {
        globalThis.fetch = originalFetch;
        restore();
    }
});

test("SIMKL title ratings require a verified IMDb match and include an item-level attribution link", async () => {
    const restore = simklTestEnvironment();
    const oldFetch = globalThis.fetch;
    const calls = [];
    let matchedImdb = "tt1234567";
    globalThis.fetch = async (input, options) => {
        const url = new URL(input);
        calls.push(url.pathname);
        assert.equal(url.origin, "https://api.simkl.com");
        assert.equal(new Headers(options.headers).has("authorization"), false);
        if (url.pathname === "/redirect") {
            assert.equal(options.redirect, "manual");
            assert.equal(url.searchParams.get("imdb"), "tt1234567");
            return Response.redirect("https://simkl.com/movies/42/test-film", 301);
        }
        return Response.json({
            ids: { simkl: 42, imdb: matchedImdb, slug: "test-film" },
            ratings: { imdb: { rating: 8.4 }, simkl: { rating: 9.1 } },
        });
    };
    try {
        const { getSimklTitleImdbRating } = loader({ "server-only": {} })("src/lib/simkl/recommendations.ts");
        const query = { id: "tt1234567", type: "movie" };
        assert.deepEqual(await getSimklTitleImdbRating(query), {
            rating: 8.4,
            simklUrl: "https://simkl.com/movies/42/test-film",
        });
        assert.deepEqual(calls, ["/redirect", "/movies/42"]);
        for (matchedImdb of ["tt1234568", undefined]) {
            assert.equal(await getSimklTitleImdbRating(query), null);
        }
    } finally {
        globalThis.fetch = oldFetch;
        restore();
    }
});

test("OMDb season ratings make one authenticated season lookup and return only normalized scores", async () => {
    const oldKey = process.env.OMDB_API_KEY;
    const oldFetch = globalThis.fetch;
    let authenticated = false;
    let calls = 0;
    let returnedSeason = "2";
    const { NextRequest } = nativeRequire("next/server");
    const get = loader({
        "server-only": {},
        "@/lib/auth": {
            auth: { api: { getSession: async () => (authenticated ? { user: { id: "viewer" } } : null) } },
        },
    })("src/app/api/imdb/season/route.ts").GET;
    const request = (query = "id=tt1234567&season=2") =>
        get(new NextRequest(`https://example.test/api/imdb/season?${query}`));
    globalThis.fetch = async (input, options) => {
        calls++;
        const url = new URL(input);
        assert.equal(url.origin, "https://www.omdbapi.com");
        assert.equal(url.searchParams.get("i"), "tt1234567");
        assert.equal(url.searchParams.get("Season"), "2");
        assert.equal(url.searchParams.get("apikey"), "test-omdb-secret");
        assert.equal(options.redirect, "error");
        assert.ok(options.next.revalidate > 0);
        return Response.json({
            Response: "True",
            Season: returnedSeason,
            Episodes: [
                { Episode: "1", Title: "One", Released: "2026-08-02", imdbID: "tt7654321", imdbRating: "8.1" },
                { Episode: "2", Title: "Two", Released: "N/A", imdbID: "tt7654322", imdbRating: "N/A" },
                { Episode: "3", Title: "Three", imdbID: "tt7654323", imdbRating: "11.2" },
                { Episode: "4", Title: "Four", imdbID: "tt7654324", imdbRating: "0.0" },
            ],
        });
    };
    try {
        process.env.OMDB_API_KEY = "test-omdb-secret";
        assert.equal((await request()).status, 401);
        authenticated = true;
        assert.equal((await request("id=1234567&season=2")).status, 400);
        assert.equal((await request("id=tt1234567&season=1.5")).status, 400);
        assert.equal(calls, 0);
        const response = await request();
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.deepEqual(await response.json(), [
            { number: 1, title: "One", imdbId: "tt7654321", released: "2026-08-02", rating: 8.1 },
        ]);
        assert.equal(calls, 1);
        returnedSeason = "3";
        assert.deepEqual(await (await request()).json(), []);
        delete process.env.OMDB_API_KEY;
        assert.deepEqual(await (await request()).json(), []);
        assert.equal(calls, 2);
    } finally {
        globalThis.fetch = oldFetch;
        if (oldKey === undefined) delete process.env.OMDB_API_KEY;
        else process.env.OMDB_API_KEY = oldKey;
    }
});

test("IMDb episode ratings follow original numbering and refuse ambiguous or conflicting data", () => {
    const { matchEpisodeImdbRating, getOriginalEpisode } = loader()("src/features/media/utils/episode-imdb-rating.ts");
    const episode = { season: 1, number: 4, title: "Bête noire!", first_aired: "2026-09-01", ids: { tmdb: 10 } };
    const score = { number: 4, title: "Bete Noire", imdbId: "tt12345678", released: "2026-09-01", rating: 8.7 };
    assert.equal(matchEpisodeImdbRating(episode, [score]), score);
    assert.ok(!matchEpisodeImdbRating(episode, [{ ...score, title: "Wrong title" }]));
    assert.ok(!matchEpisodeImdbRating(episode, [{ ...score, released: "2026-09-02" }]));
    assert.ok(!matchEpisodeImdbRating(episode, [score, { ...score, imdbId: "tt87654321" }]));
    assert.ok(!matchEpisodeImdbRating({ ...episode, ids: { imdb: "tt7654321" } }, [score]));
    assert.ok(!matchEpisodeImdbRating({ ...episode, title: "Episode 4" }, [{ ...score, title: "Episode #4" }]));
    const grouped = { ...episode, season: 7, number: 1, originalEpisode: { season: 1, number: 4 } };
    assert.deepEqual(getOriginalEpisode(grouped), { season: 1, number: 4 });
    assert.equal(matchEpisodeImdbRating(grouped, [score]), score);
});

test("SIMKL recommendation and rating routes gate catalog reads on the signed-in user's connection", async () => {
    const restore = simklTestEnvironment();
    const { NextRequest } = nativeRequire("next/server");
    const calls = [];
    let session = null;
    let status = { configured: true, connected: false };
    let unavailable = false;
    const lib = loader({ "server-only": {} })("src/lib/simkl/recommendations.ts");
    const route = loader({
        "server-only": {},
        "@/lib/auth": { auth: { api: { getSession: async () => session } } },
        "@/lib/simkl/service": {
            connectionStatus: async (id) => {
                calls.push(id);
                return status;
            },
            getSimklPlayback: () => assert.fail("must not read playback"),
        },
        "@/lib/simkl/recommendations": {
            ...lib,
            getSimklRecommendations: async (params) => {
                calls.push(params);
                if (unavailable) throw new Error("do not expose provider errors");
                return [{ media: { title: "SIMKL pick" }, simklUrl: "https://simkl.com/movies/1/pick" }];
            },
            getSimklImdbRating: async (params) => {
                calls.push(params);
                return 8.1;
            },
        },
    })("src/app/api/simkl/[action]/route.ts");
    const get = (params = "id=tt0000001&type=movie&userId=other-user") =>
        route.GET(new NextRequest(`http://localhost:3000/api/simkl/recommendations?${params}`), {
            params: Promise.resolve({ action: "recommendations" }),
        });
    const rating = (params = "id=42&type=show&userId=other-user") =>
        route.GET(new NextRequest(`http://localhost:3000/api/simkl/rating?${params}`), {
            params: Promise.resolve({ action: "rating" }),
        });
    try {
        assert.equal((await get()).status, 401);
        assert.equal((await rating()).status, 401);
        session = { user: { id: "current-user" } };
        assert.equal((await get("id=not-a-media-id&type=movie")).status, 400);
        assert.equal((await rating("id=tt0000001&type=show")).status, 400);
        assert.deepEqual(calls, []);
        assert.deepEqual(await (await get()).json(), []);
        assert.equal(await (await rating()).json(), null);
        status = { configured: true, connected: true, reconnectRequired: true };
        assert.deepEqual(await (await get()).json(), []);
        assert.equal(await (await rating()).json(), null);
        assert.deepEqual(calls, Array(4).fill("current-user"));
        status = { configured: true, connected: true };
        const response = await get();
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal((await response.json())[0].media.title, "SIMKL pick");
        assert.deepEqual(calls.slice(-2), ["current-user", { id: "tt0000001", type: "movie" }]);
        const score = await rating();
        assert.equal(score.headers.get("cache-control"), "private, no-store");
        assert.equal(await score.json(), 8.1);
        assert.deepEqual(calls.slice(-2), ["current-user", { id: "42", type: "show" }]);
        unavailable = true;
        const error = await get();
        assert.equal(error.status, 503);
        assert.doesNotMatch(await error.text(), /do not expose/);
    } finally {
        restore();
    }
});

test("SIMKL retains refreshed credentials after a failed read and persists revoked-account reconnect state", async () => {
    const restore = simklTestEnvironment();
    const database = simklDatabase();
    let revoked = false;
    class SimklError extends Error {
        constructor(status, retrySeconds = 60, code) {
            super("provider failed");
            Object.assign(this, { status, retrySeconds, code });
        }
    }
    const load = loader({
        ...database.mocks,
        "./client": {
            parseCredentials: (value) => value,
            SimklError,
            tokenGrant: async () => {
                if (revoked) throw new SimklError(400, 60, "invalid_grant");
                return {
                    accessToken: "new-persisted-access",
                    refreshToken: "refresh",
                    expiresAt: Date.now() + 86400_000,
                    refreshExpiresAt: Date.now() + 180 * 86400_000,
                };
            },
            readSimkl: async () => {
                throw new SimklError(revoked ? 401 : 500);
            },
        },
    });
    try {
        const security = load("src/lib/simkl/security.ts");
        const service = load("src/lib/simkl/service.ts");
        database.rows.set("user-a", {
            userId: "user-a",
            credentials: security.seal(
                {
                    accessToken: "old-access",
                    refreshToken: "refresh",
                    expiresAt: 0,
                    refreshExpiresAt: Date.now() + 86400_000,
                },
                "tokens:user-a"
            ),
        });
        assert.equal((await service.getSimklPlayback("user-a")).stale, true);
        assert.equal(
            security.unseal(database.rows.get("user-a").credentials, "tokens:user-a").accessToken,
            "new-persisted-access"
        );
        revoked = true;
        database.rows.get("user-a").retryAt = null;
        assert.equal((await service.getSimklPlayback("user-a")).reconnectRequired, true);
        assert.equal(database.rows.get("user-a").credentials, null);
        assert.equal((await service.getSimklPlayback("user-a")).reconnectRequired, true);
        assert.equal((await service.connectionStatus("user-a")).reconnectRequired, true);
    } finally {
        restore();
    }
});

test("SIMKL API rejects anonymous/cross-origin mutations and ignores supplied user IDs", async () => {
    const restore = simklTestEnvironment();
    let userId = null;
    const calls = [];
    const { NextRequest } = nativeRequire("next/server");
    const route = loader({
        "server-only": {},
        "@/lib/auth": { auth: { api: { getSession: async () => (userId ? { user: { id: userId } } : null) } } },
        "@/lib/simkl/service": {
            connectionStatus: async (id) => {
                calls.push(id);
                return { configured: true, connected: true };
            },
            getSimklPlayback: async (id) => {
                calls.push(id);
                return { configured: true, connected: true, items: [] };
            },
            disconnectSimkl: async (id) => {
                calls.push(id);
                return { revoked: true };
            },
        },
    })("src/app/api/simkl/[action]/route.ts");
    const context = (action) => ({ params: Promise.resolve({ action }) });
    try {
        assert.equal(
            (await route.GET(new NextRequest("http://localhost:3000/api/simkl/playback"), context("playback"))).status,
            401
        );
        assert.equal(calls.length, 0);
        userId = "signed-in-user";
        const bad = await route.POST(
            new NextRequest("http://localhost:3000/api/simkl/disconnect", {
                method: "POST",
                headers: { origin: "https://evil.invalid" },
            }),
            context("disconnect")
        );
        assert.equal(bad.status, 403);
        const response = await route.GET(
            new NextRequest("http://localhost:3000/api/simkl/playback?userId=someone-else"),
            context("playback")
        );
        assert.equal(response.status, 200);
        assert.deepEqual(calls, ["signed-in-user"]);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
    } finally {
        restore();
    }
});

test("MPV bridge is opt-in, preserves signed URLs, and formats clean movie/episode titles", () => {
    const opened = [];
    let selectedPlayer = "MPV";
    const settings = { getState: () => ({ get: () => selectedPlayer }) };
    const load = loader({ "@/stores/settings": { useSettingsStore: settings } });
    const { MediaPlayer } = load("src/lib/schemas.ts");
    const player = load("src/lib/media/player.ts");
    const originalWindow = global.window;
    global.window = { open: (...args) => opened.push(args) };
    try {
        const url = "https://example.invalid/video?signature=a%2Fb%26c&token=one+two#fragment";
        player.openInPlayer({ url, fileName: "Movie (2026)" });
        assert.equal(opened[0][0], `mpv://${encodeURIComponent(url)}`);
        selectedPlayer = MediaPlayer.MPV_SIMKL;
        player.openInPlayer({ url, fileName: 'Movie & "Secrets" (2026)' });
        const link = new URL(opened[1][0]);
        assert.equal(link.protocol, "debridui-mpv:");
        assert.equal(link.searchParams.get("v"), "1");
        assert.equal(link.searchParams.get("url"), url);
        assert.equal(link.searchParams.get("title"), 'Movie & "Secrets" (2026)');
        assert.equal(opened[1][1], "_self");
        assert.equal(player.isSupportedPlayer(MediaPlayer.MPV_SIMKL, "Windows"), true);
        assert.equal(player.isSupportedPlayer(MediaPlayer.MPV_SIMKL, "Android"), false);

        const played = [];
        const streaming = loader({
            "@/stores/settings": { useSettingsStore: settings },
            "@/lib/media/player": {
                openInPlayer: (args) => {
                    played.push(args);
                    player.openInPlayer(args);
                },
            },
            "@/features/addons/hooks/use-addons": {},
            "@/features/preview/stores/preview": {},
            "@/lib/query-client": {},
        })("src/features/media/stores/streaming.ts").useStreamingStore;
        const source = { url, resolution: "2160p", quality: "WEB-DL", size: "10 GB" };
        streaming.getState().playSource(source, { type: "movie", media: { title: "Movie", year: 2026 } });
        assert.equal(played.at(-1).fileName, "Movie (2026)");
        const playEpisode = (title, year, season, episode, episodeTitle, resume = false) => {
            streaming.getState().playSource(source, {
                type: "show",
                media: { title, year },
                tvParams: { season, episode, title: episodeTitle },
                resume,
            });
        };
        const assertBridgeTitle = (title) => {
            assert.equal(played.at(-1).fileName, title);
            const launch = new URL(opened.at(-1)[0]);
            assert.equal(launch.protocol, "debridui-mpv:");
            assert.equal(launch.searchParams.get("url"), url);
            assert.equal(launch.searchParams.get("title"), title);
        };
        playEpisode("Sherlock", 2010, 2, 1, "A Scandal in Belgravia");
        assertBridgeTitle("Sherlock (2010) S02E01 - A Scandal in Belgravia");
        playEpisode("Chernobyl", 2019, 1, 2, "Please Remain Calm", true);
        assertBridgeTitle("Chernobyl (2019) S01E02 - Please Remain Calm");
        playEpisode("Silo", undefined, 1, 2, "Truth");
        assertBridgeTitle("Silo S01E02 - Truth");
        playEpisode("Sherlock (2010)", 2010, 2, 1);
        assertBridgeTitle("Sherlock (2010) S02E01");
        selectedPlayer = MediaPlayer.MPV;
        streaming.getState().playSource(source, { type: "movie", media: { title: "Movie", year: 2026 } });
        assert.equal(played.at(-1).fileName, "Movie [2160p WEB-DL 10 GB]");
        playEpisode("Sherlock", 2010, 2, 1, "A Scandal in Belgravia");
        assert.equal(played.at(-1).fileName, "Sherlock S02E01 - A Scandal in Belgravia [2160p WEB-DL 10 GB]");
        assert.equal(opened.at(-1)[0], `mpv://${encodeURIComponent(url)}`);
    } finally {
        if (originalWindow === undefined) delete global.window;
        else global.window = originalWindow;
    }
});

test("Remembered releases distinguish files, titles, episodes, users and ambiguous source matches", async () => {
    const storage = new Map();
    const oldWindow = global.window;
    global.window = {
        localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    };
    try {
        const load = loader();
        const { parseStream } = load("src/lib/addons/parser.ts");
        const { rememberPlayedRelease, findRememberedRelease } = load("src/features/media/utils/remembered-release.ts");
        const movie = { imdbId: "tt0123456", type: "movie", media: { title: "Movie" } };
        const episode = { ...movie, type: "show", tvParams: { season: 1, episode: 2 } };
        const torrent = { infoHash: "a".repeat(40), fileIdx: 0 };
        const oldSource = parseStream({ ...torrent, url: "https://example.test/video?signature=old" }, "a", "Addon");
        const fresh = parseStream({ ...torrent, url: "https://example.test/video?signature=fresh" }, "a", "Addon");
        const other = parseStream({ ...torrent, fileIdx: 1, url: "https://example.test/other" }, "a", "Addon");
        const fileOnly = parseStream(
            {
                url: "https://example.test/special",
                behaviorHints: { filename: "Movie.Extended.1080p.mkv", videoSize: 987654321 },
            },
            "a",
            "Addon"
        );
        const noIdentity = parseStream({ url: "https://example.test/generic", name: "1080p" }, "a", "Addon");
        assert.equal(noIdentity.releaseIdentity, undefined);
        assert.notEqual(fresh.releaseIdentity, other.releaseIdentity);
        assert.ok(fileOnly.releaseIdentity);
        await rememberPlayedRelease(movie, oldSource, "viewer-a");
        assert.equal(await findRememberedRelease(movie, [other, fresh], "viewer-a"), fresh);
        assert.equal(
            await findRememberedRelease(
                movie,
                [fresh, { ...fresh, url: "https://example.test/duplicate" }],
                "viewer-a"
            ),
            undefined
        );
        assert.equal(await findRememberedRelease(movie, [{ ...fresh, addonId: "b" }], "viewer-a"), undefined);
        assert.equal(await findRememberedRelease(movie, [fresh], "viewer-b"), undefined);
        assert.equal(await findRememberedRelease(episode, [fresh], "viewer-a"), undefined);
        await rememberPlayedRelease(episode, fileOnly, "viewer-a");
        assert.equal(await findRememberedRelease(episode, [fileOnly], "viewer-a"), fileOnly);
        assert.equal(
            await findRememberedRelease({ ...episode, tvParams: { season: 1, episode: 3 } }, [fileOnly], "viewer-a"),
            undefined
        );
        assert.doesNotMatch([...storage.values()].join(), /signature|https:|Movie\.Extended/);
        await rememberPlayedRelease(movie, noIdentity, "viewer-a");
        assert.equal(await findRememberedRelease(movie, [fresh], "viewer-a"), undefined);
    } finally {
        if (oldWindow === undefined) delete global.window;
        else global.window = oldWindow;
    }
});

test("Resume fetches fresh streams and only prefers an eligible release; regular Watch is unchanged", async () => {
    const oldFetch = global.fetch;
    const mockRange = {
        minResolution: "1080p",
        maxResolution: "any",
        minSourceQuality: "any",
        maxSourceQuality: "any",
    };
    const streamingSettings = { autoPlay: true, allowUncached: false };
    const request = { imdbId: "tt0123456", type: "movie", media: { title: "Movie" }, resume: true };
    const addon = { id: "addon", name: "Addon", url: "https://example.test/manifest.json", enabled: true, order: 0 };
    const last = {
        name: "Instant 1080p WEB-DL",
        infoHash: "a".repeat(40),
        fileIdx: 0,
        url: "https://video.test/fresh",
    };
    const best = {
        name: "Instant 2160p WEB-DL",
        infoHash: "b".repeat(40),
        fileIdx: 0,
        url: "https://video.test/ranked",
    };
    const opened = [];
    const toasts = [];
    let picked = "https://video.test/fresh";
    let fetched = 0;
    let cacheReads = 0;
    let streams = [best, last];
    const noop = () => {};
    const load = loader({
        sonner: {
            toast: {
                loading: () => "test",
                dismiss: noop,
                error: noop,
                success: (...args) => toasts.push(args),
                warning: noop,
            },
        },
        "@/stores/settings": {
            getActiveRange: () => mockRange,
            useSettingsStore: { getState: () => ({ get: (key) => (key === "streaming" ? streamingSettings : "MPV") }) },
        },
        "@/lib/media/player": { openInPlayer: ({ url }) => opened.push(url) },
        "@/features/addons/hooks/use-addons": { getStreamCapableAddons: async (addons) => addons },
        "@/features/preview/stores/preview": {},
        "@/features/media/utils/remembered-release": {
            findRememberedRelease: async (_request, sources, userId) => {
                assert.equal(userId, "viewer-a");
                return sources.find((source) => source.url === picked);
            },
            rememberPlayedRelease: noop,
        },
        "@/lib/query-client": {
            queryClient: {
                getQueryData: () => {
                    cacheReads++;
                    return [{ url: "https://video.test/legacy-cache", isCached: true }];
                },
                setQueryData: noop,
            },
        },
    });
    global.fetch = async (url, options) => {
        assert.equal(url, "https://example.test/stream/movie/tt0123456.json");
        assert.equal(options.cache, "no-store");
        fetched++;
        return Response.json({ streams });
    };
    try {
        const store = load("src/features/media/stores/streaming.ts").useStreamingStore.getState();
        await store.play(request, [addon], "viewer-a");
        picked = "https://video.test/not-found";
        await store.play(request, [addon], "viewer-a");
        picked = last.url;
        streams = [best, { ...last, name: "1080p WEB-DL" }];
        await store.play(request, [addon], "viewer-a");
        streams = [best, { ...last, name: "Instant 720p WEB-DL" }];
        await store.play(request, [addon], "viewer-a");
        await store.play({ ...request, resume: false }, [addon], "viewer-a");
        assert.deepEqual(opened, [last.url, best.url, best.url, best.url, "https://video.test/legacy-cache"]);
        assert.equal(fetched, 4);
        assert.equal(cacheReads, 1);
        assert.deepEqual(
            toasts.map(([title]) => title),
            [
                "Reused last source",
                "Picked best available source",
                "Picked best available source",
                "Picked best available source",
            ]
        );
        assert.match(toasts[0][1].description, /Addon.*1080p.*Cached/);
        assert.match(toasts[1][1].description, /Addon.*2160p.*Cached/);
        assert.doesNotMatch(JSON.stringify(toasts), /https:\/\//);
    } finally {
        global.fetch = oldFetch;
    }
});

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
        integrations: { catalog_visibility: { [key]: false }, hero_catalogs: [key] },
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
