import "server-only";
import { z } from "zod";
import { simklConfig } from "./security";

export class SimklError extends Error {
    constructor(
        public status: number,
        public retrySeconds = 60,
        public code?: string
    ) {
        super("SIMKL request failed");
    }
}

const credentialsSchema = z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number(),
    refreshExpiresAt: z.number(),
});
export const parseCredentials = (value: unknown) => credentialsSchema.parse(value);
export type SimklCredentials = z.infer<typeof credentialsSchema>;

async function request(path: string, init: RequestInit, params?: URLSearchParams, timeoutMs = 12_000) {
    const config = simklConfig();
    const url = new URL(`https://api.simkl.com${path}`);
    url.search = new URLSearchParams({
        client_id: config.clientId,
        "app-name": "debridui",
        "app-version": "1.0",
    }).toString();
    if (params) for (const [key, value] of params) url.searchParams.append(key, value);
    const response = await fetch(url, {
        ...init,
        headers: { "User-Agent": "DebridUI/1.0", ...init.headers },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
        const retry = response.headers.get("Retry-After");
        const delay =
            retry && /^\d+$/.test(retry) ? Number(retry) : retry ? (Date.parse(retry) - Date.now()) / 1000 : 60;
        const body = await response.json().catch(() => null);
        const code = typeof body?.error === "string" ? body.error : undefined;
        throw new SimklError(response.status, Math.min(86400, Math.max(60, Number.isFinite(delay) ? delay : 60)), code);
    }
    return response;
}

export async function tokenGrant(params: Record<string, string>): Promise<SimklCredentials> {
    const config = simklConfig();
    const response = await request("/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ ...params, client_id: config.clientId, client_secret: config.clientSecret }),
    });
    const value = z
        .object({
            access_token: z.string().min(1),
            refresh_token: z.string().min(1),
            expires_in: z.number().positive(),
            scope: z.string(),
            token_type: z.string(),
        })
        .parse(await response.json());
    if (!value.scope.split(" ").includes("media:read") || value.token_type.toLowerCase() !== "bearer") {
        throw new Error("Invalid SIMKL grant");
    }
    return {
        accessToken: value.access_token,
        refreshToken: value.refresh_token,
        expiresAt: Date.now() + value.expires_in * 1000,
        refreshExpiresAt: Date.now() + 180 * 86400_000,
    };
}

export async function readSimkl(path: "/sync/activities" | "/sync/playback", accessToken: string): Promise<unknown> {
    return (await request(path, { headers: { Authorization: `Bearer ${accessToken}` } })).json();
}

export async function readSimklNextUp(accessToken: string, since?: string): Promise<unknown> {
    const params = new URLSearchParams({ next_watch_info: "yes" });
    if (since) params.set("date_from", since);
    const path = since ? "/sync/all-items/shows" : "/sync/all-items/shows/watching";
    return (await request(path, { headers: { Authorization: `Bearer ${accessToken}` } }, params, 4_000)).json();
}

export async function revokeGrant(token: string): Promise<void> {
    const config = simklConfig();
    await request("/oauth2/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, token }),
    });
}
