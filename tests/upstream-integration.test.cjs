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

test("dashboard uses the full hero without saved playbacks and a compact layout only with real progress", () => {
    const React = nativeRequire("react");
    const { renderToStaticMarkup } = nativeRequire("react-dom/server");
    let data;
    const Hero = ({ compact }) => React.createElement("div", { "data-compact": String(compact) });
    const Dashboard = loader({
        "next/dynamic": { default: () => Hero },
        "@/features/media/hooks/use-simkl": { useSimklPlayback: () => ({ data }) },
        "@/features/media/components/hero-carousel-skeleton": { HeroCarouselSkeleton: () => null },
        "@/features/media/components/continue-watching": { ContinueWatching: () => null },
        "@/features/media/components/media-footer": { MediaFooter: () => null },
        "./_components/addon-catalogs": { AddonCatalogs: () => null },
    })("src/app/(auth)/(app)/dashboard/page.tsx").default;
    for (const value of [
        undefined,
        { connected: false, items: [] },
        { connected: true, items: [] },
        { connected: false, items: [{ id: "old" }] },
    ]) {
        data = value;
        assert.match(renderToStaticMarkup(React.createElement(Dashboard)), /data-compact="false"/);
    }
    data = { connected: true, items: [{ id: "saved" }] };
    assert.match(renderToStaticMarkup(React.createElement(Dashboard)), /data-compact="true"/);
});

test("Continue Watching removes normal explanatory copy but retains refresh failure feedback", () => {
    const React = nativeRequire("react");
    const { renderToStaticMarkup } = nativeRequire("react-dom/server");
    let stale = false;
    const ContinueWatching = loader({
        "embla-carousel-react": { default: () => [() => {}, undefined] },
        "@/features/media/hooks/use-simkl": {
            useSimklPlayback: () => ({
                data: { connected: true, items: [{ id: "saved" }], stale },
                isLoading: false,
                refetch: () => {},
            }),
        },
        "./continue-watching-card": { ContinueWatchingCard: () => React.createElement("p", null, "Saved movie") },
    })("src/features/media/components/continue-watching.tsx").ContinueWatching;
    const render = () => renderToStaticMarkup(React.createElement(ContinueWatching));
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
    const markup = renderToStaticMarkup(React.createElement(Card, { item: episode }));
    assert.match(markup, /aria-label="Resume Silo"/);
    assert.match(markup, /35% watched/);
    assert.match(markup, /sm:hidden/);
    assert.match(markup, /hidden sm:flex/);
    assert.equal(requests.length, 2);
    for (const request of requests) {
        assert.equal(request.imdbId, episode.imdbId);
        assert.equal(request.type, "show");
        assert.deepEqual(request.tvParams, { season: 1, episode: 2, title: "Truth" });
    }
    requests.length = 0;
    renderToStaticMarkup(React.createElement(Card, { item: { ...episode, episodeMapped: false } }));
    assert.equal(requests.length, 0);
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

test("SIMKL sync serializes refresh, isolates caches, gates playback on activities, and backs off", async () => {
    const restore = simklTestEnvironment();
    const database = simklDatabase();
    let grants = 0;
    let playbackReads = 0;
    let activitiesReads = 0;
    let fail = false;
    let stamp = "one";
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
                    return { movies: { playback: stamp } };
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
        assert.equal(JSON.stringify(results).includes("new-access"), false);
        assert.equal((await service.getSimklPlayback("user-b")).items.length, 0);
        database.rows.get("user-a").checkedAt = new Date(0);
        await service.getSimklPlayback("user-a");
        assert.equal(activitiesReads, 2);
        assert.equal(playbackReads, 1);
        stamp = "two";
        database.rows.get("user-a").checkedAt = new Date(0);
        await service.getSimklPlayback("user-a");
        assert.equal(playbackReads, 2);
        fail = true;
        database.rows.get("user-a").checkedAt = new Date(0);
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
            "@/lib/media/player": { openInPlayer: (args) => played.push(args) },
            "@/features/addons/hooks/use-addons": {},
            "@/features/preview/stores/preview": {},
            "@/lib/query-client": {},
        })("src/features/media/stores/streaming.ts").useStreamingStore;
        const source = { url, resolution: "2160p", quality: "WEB-DL", size: "10 GB" };
        streaming.getState().playSource(source, { type: "movie", media: { title: "Movie", year: 2026 } });
        assert.equal(played.at(-1).fileName, "Movie (2026)");
        streaming.getState().playSource(source, {
            type: "show",
            media: { title: "Silo", year: 2023 },
            tvParams: { season: 1, episode: 2, title: "Truth" },
        });
        assert.equal(played.at(-1).fileName, "Silo S01E02 - Truth");
        selectedPlayer = MediaPlayer.MPV;
        streaming.getState().playSource(source, { type: "movie", media: { title: "Movie", year: 2026 } });
        assert.equal(played.at(-1).fileName, "Movie [2160p WEB-DL 10 GB]");
    } finally {
        if (originalWindow === undefined) delete global.window;
        else global.window = originalWindow;
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
