// Additive release migration only: never replay older cleanup migrations.
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const expectedColumns = {
    user_id: "uuid",
    credentials: "text",
    oauth_state: "text",
    reconnect_required: "boolean",
    playback_cache: "jsonb",
    checked_at: "timestamp with time zone",
    retry_at: "timestamp with time zone",
};

async function applySimklMigration(sql, migration, previous) {
    return sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(303030, 7)`;
        await tx`set local search_path to public`;
        const userId = await tx`select udt_name from information_schema.columns
            where table_schema = 'public' and table_name = 'user' and column_name = 'id'`;
        if (userId[0]?.udt_name !== "uuid")
            throw new Error("Expected existing DebridUI user table; no changes applied");
        const [journal] = await tx`select to_regclass('drizzle.__drizzle_migrations') as journal`;
        const last = journal?.journal
            ? (await tx`select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`)[0]
            : null;
        if (last && Number(last.created_at) > migration.when)
            throw new Error("Database has a newer migration; release stopped");
        if (last && Number(last.created_at) === migration.when && last.hash !== migration.hash) {
            throw new Error("SIMKL migration checksum differs; release stopped");
        }
        await tx.unsafe(migration.sql);
        const columns =
            await tx`select column_name, data_type, is_nullable, column_default from information_schema.columns
            where table_schema = 'public' and table_name = 'simkl_connections'`;
        if (
            columns.length !== Object.keys(expectedColumns).length ||
            columns.some(
                (column) =>
                    expectedColumns[column.column_name] !== column.data_type ||
                    column.is_nullable !==
                        (["user_id", "reconnect_required"].includes(column.column_name) ? "NO" : "YES")
            )
        )
            throw new Error("SIMKL table does not match the expected schema; transaction rolled back");
        if (columns.find((column) => column.column_name === "reconnect_required")?.column_default !== "false") {
            throw new Error("Unexpected SIMKL reconnect default; transaction rolled back");
        }
        const constraints = await tx`select pg_get_constraintdef(oid) as definition from pg_constraint
            where conrelid = 'public.simkl_connections'::regclass`;
        if (
            !constraints.some((row) => row.definition === "PRIMARY KEY (user_id)") ||
            !constraints.some((row) =>
                /^FOREIGN KEY \(user_id\) REFERENCES (?:public\.)?"?user"?\(id\) ON DELETE CASCADE$/.test(
                    row.definition
                )
            )
        ) {
            throw new Error("SIMKL table constraints differ; transaction rolled back");
        }
        // Only advance an existing, up-to-date journal. Never mark skipped historical migrations as applied.
        if (last && Number(last.created_at) === previous.when && last.hash === previous.hash) {
            await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${migration.hash}, ${migration.when})`;
            return "SIMKL table verified; migration journal advanced";
        }
        return last && Number(last.created_at) === migration.when
            ? "SIMKL migration already applied and verified"
            : "SIMKL table verified; older migration history left unchanged";
    });
}

if (require.main === module) {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is required; no migration attempted.");
        process.exit(1);
    }
    const postgres = require("postgres");
    const folder = path.resolve(__dirname, "../drizzle");
    const journal = JSON.parse(readFileSync(path.join(folder, "meta/_journal.json"), "utf8"));
    const migration = (tag) => {
        const entry = journal.entries.find((item) => item.tag === tag);
        const sql = readFileSync(path.join(folder, `${tag}.sql`), "utf8");
        return { when: entry.when, sql, hash: createHash("sha256").update(sql).digest("hex") };
    };
    const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 15 });
    applySimklMigration(sql, migration("0007_simkl_connections"), migration("0006_technical_cleanup"))
        .then((result) => console.log(result))
        .catch(() => {
            console.error(
                "SIMKL migration failed; no partial changes committed. Check the database/schema before retrying."
            );
            process.exitCode = 1;
        })
        .finally(() => sql.end({ timeout: 5 }));
}

module.exports = { applySimklMigration };
