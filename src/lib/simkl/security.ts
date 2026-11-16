import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function simklConfig() {
    const clientId = process.env.SIMKL_CLIENT_ID;
    const clientSecret = process.env.SIMKL_CLIENT_SECRET;
    const encryptionKey = process.env.SIMKL_TOKEN_ENCRYPTION_KEY;
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    const local = origin.hostname === "localhost" || origin.hostname === "127.0.0.1";
    if (origin.protocol !== "https:" && !(local && origin.protocol === "http:")) throw new Error("Invalid app URL");
    if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/")
        throw new Error("Invalid app URL");
    if (!clientId || !clientSecret || !encryptionKey || Buffer.from(encryptionKey, "base64").length !== 32) {
        throw new Error("SIMKL is not configured");
    }
    return {
        clientId,
        clientSecret,
        key: Buffer.from(encryptionKey, "base64"),
        origin: origin.origin,
        redirectUri: `${origin.origin}/api/simkl/callback`,
        secure: origin.protocol === "https:",
    };
}

export function isSimklConfigured(): boolean {
    try {
        simklConfig();
        return true;
    } catch {
        return false;
    }
}

export function seal(value: unknown, purpose: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", simklConfig().key, iv);
    cipher.setAAD(Buffer.from(purpose));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function unseal(value: string, purpose: string): unknown {
    const bytes = Buffer.from(value, "base64url");
    const cipher = createDecipheriv("aes-256-gcm", simklConfig().key, bytes.subarray(0, 12));
    cipher.setAAD(Buffer.from(purpose));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8"));
}

export const stateHash = (state: string) => createHash("sha256").update(state).digest("hex");
const pendingSchema = z.object({ userId: z.string(), state: z.string(), verifier: z.string(), expires: z.number() });

export function createAuthorization(userId: string) {
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const config = simklConfig();
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: "media:read",
        state,
        code_challenge: createHash("sha256").update(verifier).digest("base64url"),
        code_challenge_method: "S256",
    });
    return {
        state,
        cookie: seal({ userId, state, verifier, expires: Date.now() + 10 * 60_000 }, "oauth"),
        url: `https://simkl.com/oauth2/authorize?${params}`,
    };
}

export function validateAuthorization(cookie: string, state: string, userId: string) {
    const value = pendingSchema.parse(unseal(cookie, "oauth"));
    const expected = Buffer.from(value.state);
    const actual = Buffer.from(state);
    if (
        value.userId !== userId ||
        value.expires < Date.now() ||
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
    )
        throw new Error("Invalid OAuth state");
    return value;
}
