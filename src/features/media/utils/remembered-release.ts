import { z } from "zod";
import type { AddonSource } from "@/lib/addons/types";
import type { StreamingRequest } from "../stores/streaming";

const entriesSchema = z.array(
    z.object({
        mediaKey: z.string(),
        addonId: z.string(),
        fingerprint: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .nullable(),
        launchedAt: z.number(),
    })
);
const LIMIT = 100;
const storageKey = (userId: string) => `debridui.last-releases.v1:${userId}`;

function getMediaKey({ imdbId, type, tvParams }: StreamingRequest) {
    if (!/^tt[0-9]+$/.test(imdbId)) return null;
    if (type === "movie") return `movie:${imdbId}`;
    return tvParams ? `show:${imdbId}:${tvParams.season}:${tvParams.episode}` : null;
}

function read(key: string) {
    const stored = window.localStorage.getItem(key);
    return stored ? (entriesSchema.safeParse(JSON.parse(stored)).data ?? []) : [];
}

async function fingerprint(identity: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function rememberPlayedRelease(request: StreamingRequest, source: AddonSource, userId?: string) {
    const mediaKey = getMediaKey(request);
    if (!userId || !mediaKey) return;
    // Timestamp before digesting so a slower write cannot replace a more recent Play.
    const launchedAt = performance.timeOrigin + performance.now();
    try {
        const key = storageKey(userId);
        const identity = source.releaseIdentity ? await fingerprint(source.releaseIdentity) : null;
        const entries = read(key);
        if (entries.some((entry) => entry.mediaKey === mediaKey && entry.launchedAt > launchedAt)) return;
        const rest = entries.filter((entry) => entry.mediaKey !== mediaKey);
        const next = [{ mediaKey, addonId: source.addonId, fingerprint: identity, launchedAt }, ...rest];
        window.localStorage.setItem(key, JSON.stringify(next.slice(0, LIMIT)));
    } catch {
        // Storage or Web Crypto can be unavailable; that must never interrupt playback.
    }
}

export async function findRememberedRelease(
    request: StreamingRequest,
    candidates: AddonSource[],
    userId?: string
): Promise<AddonSource | undefined> {
    const mediaKey = getMediaKey(request);
    if (!userId || !mediaKey) return;
    try {
        const saved = read(storageKey(userId)).find((entry) => entry.mediaKey === mediaKey);
        if (!saved?.fingerprint) return;
        const matches = await Promise.all(
            candidates.map(async (candidate) => {
                if (
                    candidate.addonId === saved.addonId &&
                    candidate.releaseIdentity &&
                    (await fingerprint(candidate.releaseIdentity)) === saved.fingerprint
                ) {
                    return candidate;
                }
            })
        );
        const unique = matches.filter((match) => match !== undefined);
        if (unique.length === 1) return unique[0];
    } catch {
        // Fall back to regular source ranking.
    }
}
