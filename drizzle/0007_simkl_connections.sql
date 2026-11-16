CREATE TABLE IF NOT EXISTS "simkl_connections" (
    "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "credentials" text,
    "oauth_state" text,
    "reconnect_required" boolean NOT NULL DEFAULT false,
    "playback_cache" jsonb,
    "checked_at" timestamp with time zone,
    "retry_at" timestamp with time zone
);
