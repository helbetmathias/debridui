import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { simklConnections } from "@/lib/db/schema";
import {
    parseCredentials,
    readSimkl,
    readSimklNextUp,
    revokeGrant,
    type SimklCredentials,
    SimklError,
    tokenGrant,
} from "./client";
import { syncNextUp } from "./next-up";
import { normalizePlayback, playbackStamp } from "./playback";
import {
    createAuthorization,
    isSimklConfigured,
    seal,
    simklConfig,
    stateHash,
    unseal,
    validateAuthorization,
} from "./security";
import type { SimklPlayback, SimklPlaybackCache } from "./types";

export async function startAuthorization(userId: string) {
    const pending = createAuthorization(userId);
    await db
        .insert(simklConnections)
        .values({ userId, oauthState: stateHash(pending.state) })
        .onConflictDoUpdate({ target: simklConnections.userId, set: { oauthState: stateHash(pending.state) } });
    return pending;
}

export async function finishAuthorization(userId: string, cookie: string, state: string, code: string) {
    const pending = validateAuthorization(cookie, state, userId);
    const claimed = `claimed:${stateHash(state)}`;
    const condition = and(eq(simklConnections.userId, userId), eq(simklConnections.oauthState, claimed));
    // Atomic claim makes state one-use across Vercel instances and concurrent callbacks.
    const consumed = await db
        .update(simklConnections)
        .set({ oauthState: claimed })
        .where(and(eq(simklConnections.userId, userId), eq(simklConnections.oauthState, stateHash(state))))
        .returning({ userId: simklConnections.userId });
    if (!consumed.length) throw new Error("Expired or consumed OAuth state");
    let credentials: SimklCredentials | undefined;
    try {
        credentials = await tokenGrant({
            grant_type: "authorization_code",
            code,
            code_verifier: pending.verifier,
            redirect_uri: simklConfig().redirectUri,
        });
        // Never recreate a connection that was disconnected while the code was exchanged.
        const saved = await db
            .update(simklConnections)
            .set({
                credentials: seal(credentials, `tokens:${userId}`),
                reconnectRequired: false,
                oauthState: null,
                playbackCache: null,
                checkedAt: null,
                retryAt: null,
            })
            .where(condition)
            .returning({ userId: simklConnections.userId });
        if (!saved.length) throw new Error("Connection changed during authorization");
    } catch {
        if (credentials) await revokeGrant(credentials.refreshToken).catch(() => undefined);
        await db.update(simklConnections).set({ oauthState: null }).where(condition);
        throw new Error("SIMKL connection could not be completed");
    }
}

export async function connectionStatus(userId: string) {
    const [row] = await db
        .select({ credentials: simklConnections.credentials, reconnectRequired: simklConnections.reconnectRequired })
        .from(simklConnections)
        .where(eq(simklConnections.userId, userId));
    return {
        configured: true,
        connected: !!row?.credentials,
        ...(row?.reconnectRequired ? { reconnectRequired: true } : {}),
    };
}

export async function readSavedSimklPlayback(userId: string): Promise<SimklPlayback> {
    if (!isSimklConfigured()) return { configured: false, connected: false, items: [] };

    // Startup needs only the last committed snapshot, not a row lock or a request to SIMKL.
    const [row] = await db
        .select({
            connected: isNotNull(simklConnections.credentials),
            reconnectRequired: simklConnections.reconnectRequired,
            playbackCache: simklConnections.playbackCache,
            retryAt: simklConnections.retryAt,
        })
        .from(simklConnections)
        .where(eq(simklConnections.userId, userId));

    if (!row?.connected) {
        return { configured: true, connected: false, items: [], reconnectRequired: row?.reconnectRequired };
    }

    return {
        configured: true,
        connected: true,
        items: row.playbackCache?.items ?? [],
        ...(row.playbackCache?.nextUp ? { nextUp: row.playbackCache.nextUp.items } : {}),
        syncedAt: row.playbackCache?.syncedAt,
        stale: !!row.retryAt && row.retryAt.getTime() > Date.now(),
    };
}

export async function disconnectSimkl(userId: string) {
    // The same row lock as playback/refresh prevents a concurrent sync reviving this link.
    return db.transaction(async (tx) => {
        const [row] = await tx.select().from(simklConnections).where(eq(simklConnections.userId, userId)).for("update");
        let revoked = true;
        if (row?.credentials) {
            try {
                await revokeGrant(parseCredentials(unseal(row.credentials, `tokens:${userId}`)).refreshToken);
            } catch {
                revoked = false;
            }
        }
        await tx.delete(simklConnections).where(eq(simklConnections.userId, userId));
        return { revoked };
    });
}

export async function getSimklPlayback(userId: string): Promise<SimklPlayback> {
    return db.transaction(async (tx) => {
        const condition = eq(simklConnections.userId, userId);
        const [row] = await tx.select().from(simklConnections).where(condition).for("update");
        if (!row?.credentials)
            return {
                configured: true,
                connected: false,
                items: [],
                ...(row?.reconnectRequired ? { reconnectRequired: true } : {}),
            };
        const cache = row.playbackCache;
        const cached = {
            configured: true,
            connected: true,
            items: cache?.items ?? [],
            syncedAt: cache?.syncedAt,
            ...(cache?.nextUp ? { nextUp: cache.nextUp.items } : {}),
        };
        if (row.retryAt && row.retryAt.getTime() > Date.now()) return { ...cached, stale: true };
        if (row.checkedAt && Date.now() - row.checkedAt.getTime() < 60_000) return cached;
        try {
            let credentials = parseCredentials(unseal(row.credentials, `tokens:${userId}`));
            const refresh = async () => {
                if (credentials.refreshExpiresAt <= Date.now()) throw new SimklError(400, 60, "invalid_grant");
                credentials = await tokenGrant({
                    grant_type: "refresh_token",
                    refresh_token: credentials.refreshToken,
                });
                // Persist before any subsequent read fails; a refresh invalidates the previous access token.
                await tx
                    .update(simklConnections)
                    .set({ credentials: seal(credentials, `tokens:${userId}`) })
                    .where(condition);
            };
            if (credentials.expiresAt < Date.now() + 60_000) await refresh();
            let activities: unknown;
            try {
                activities = await readSimkl("/sync/activities", credentials.accessToken);
            } catch (error) {
                if (!(error instanceof SimklError) || error.status !== 401) throw error;
                await refresh();
                activities = await readSimkl("/sync/activities", credentials.accessToken);
            }
            const stamp = playbackStamp(activities);
            // A daily reconciliation also expires retained playbacks when no activity timestamp moves.
            const changed = !cache || stamp !== cache.stamp || Date.now() - Date.parse(cache.syncedAt) > 86400_000;
            const snapshot: SimklPlaybackCache = changed
                ? {
                      stamp,
                      items: normalizePlayback(await readSimkl("/sync/playback", credentials.accessToken)),
                      syncedAt: new Date().toISOString(),
                  }
                : cache;
            let retryAt: Date | null = null;
            let nextUp = cache?.nextUp;
            try {
                nextUp = await syncNextUp(activities, nextUp, (since) =>
                    readSimklNextUp(credentials.accessToken, since)
                );
            } catch (error) {
                retryAt = new Date(Date.now() + (error instanceof SimklError ? error.retrySeconds : 60) * 1000);
            }
            await tx
                .update(simklConnections)
                .set({ playbackCache: { ...snapshot, nextUp }, checkedAt: new Date(), retryAt })
                .where(condition);
            return {
                configured: true,
                connected: true,
                items: snapshot.items,
                syncedAt: snapshot.syncedAt,
                ...(nextUp ? { nextUp: nextUp.items } : {}),
                ...(retryAt ? { stale: true } : {}),
            };
        } catch (error) {
            if (
                error instanceof SimklError &&
                (error.code === "invalid_grant" ||
                    (error.status === 401 && error.code !== "invalid_client") ||
                    error.code === "insufficient_scope")
            ) {
                await tx
                    .update(simklConnections)
                    .set({ credentials: null, playbackCache: null, checkedAt: null, reconnectRequired: true })
                    .where(condition);
                return { configured: true, connected: false, items: [], reconnectRequired: true };
            }
            await tx
                .update(simklConnections)
                .set({ retryAt: new Date(Date.now() + (error instanceof SimklError ? error.retrySeconds : 60) * 1000) })
                .where(condition);
            return { ...cached, stale: true };
        }
    });
}
