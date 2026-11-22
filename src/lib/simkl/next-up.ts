import { z } from "zod";
import type { SimklNextUpCache, SimklNextUpItem } from "./types";

const date = z.iso.datetime({ offset: true });
const positiveId = z
    .union([z.string(), z.number().int()])
    .transform(String)
    .pipe(z.string().regex(/^[1-9][0-9]{0,10}$/));
const episodeCode = /^S(\d{1,3})E(\d{1,4})$/;
const ids = z.object({ simkl: positiveId });
const showSchema = z.object({
    status: z.string(),
    last_watched_at: date.nullable(),
    last_watched: z.string().nullable(),
    next_to_watch: z.string().nullable(),
    next_to_watch_info: z
        .object({ title: z.string().max(400).nullish(), date: date.nullish(), season: z.number(), episode: z.number() })
        .nullish()
        .catch(undefined),
    show: z.object({
        title: z.string().trim().min(1).max(400),
        year: z.number().int().positive().nullish().catch(undefined),
        ids: ids.extend({
            slug: z
                .string()
                .regex(/^[a-zA-Z0-9_-]{1,200}$/)
                .optional()
                .catch(undefined),
            imdb: z
                .string()
                .regex(/^tt[0-9]{1,12}$/)
                .optional()
                .catch(undefined),
            tmdb: positiveId.optional().catch(undefined),
        }),
    }),
});
const showIdentity = z.object({ show: z.object({ ids }) });
const sets = z.object({ shows: z.array(z.unknown()).optional(), error: z.never().optional() });
const activitySchema = z.object({
    all: date,
    tv_shows: z.object({
        watching: date.nullish(),
        removed_from_list: date.nullish(),
        completed: date.nullish(),
        hold: date.nullish(),
        dropped: date.nullish(),
        plantowatch: date.nullish(),
    }),
});

export function nextUpSyncState(raw: unknown) {
    const result = activitySchema.safeParse(raw);
    if (!result.success) return;
    const { all, tv_shows } = result.data;
    return {
        since: all,
        watching: JSON.stringify([
            tv_shows.watching,
            tv_shows.completed,
            tv_shows.hold,
            tv_shows.dropped,
            tv_shows.plantowatch,
        ]),
        removed: tv_shows.removed_from_list ?? null,
    };
}

export function mergeNextUp(raw: unknown, previous: SimklNextUpItem[] = []): SimklNextUpItem[] {
    const entries = new Map(previous.map((item) => [item.simklId, item]));
    for (const entry of sets.parse(raw).shows ?? []) {
        const identity = showIdentity.safeParse(entry);
        if (!identity.success) continue;
        const simklId = identity.data.show.ids.simkl;
        entries.delete(simklId);
        const result = showSchema.safeParse(entry);
        if (!result.success) continue;
        const { status, last_watched, last_watched_at, next_to_watch, next_to_watch_info, show } = result.data;
        const last = episodeCode.exec(last_watched ?? "");
        if (status !== "watching" || !last || !last_watched_at) continue;
        const next = episodeCode.exec(next_to_watch ?? "");
        if (!next || (!show.ids.imdb && !show.ids.tmdb)) continue;
        const season = Number(next[1]);
        const number = Number(next[2]);
        if (season < 1 || number < 1) continue;
        const lastWatchedEpisode = { season: Number(last[1]), number: Number(last[2]) };
        if (
            season < lastWatchedEpisode.season ||
            (season === lastWatchedEpisode.season && number <= lastWatchedEpisode.number)
        )
            continue;
        if (next_to_watch_info?.date && Date.parse(next_to_watch_info.date) > Date.now()) continue;
        const title =
            next_to_watch_info?.season === season && next_to_watch_info.episode === number
                ? (next_to_watch_info.title ?? undefined)
                : undefined;
        entries.set(simklId, {
            id: `next-up:${simklId}:${season}:${number}`,
            type: "show",
            title: show.title,
            year: show.year ?? undefined,
            imdbId: show.ids.imdb,
            tmdbId: show.ids.tmdb,
            simklId,
            simklUrl: `https://simkl.com/tv/${simklId}${show.ids.slug ? `/${show.ids.slug}` : ""}`,
            episode: { season, number, title },
            lastWatchedEpisode,
            lastWatchedAt: last_watched_at,
        });
    }
    return [...entries.values()]
        .sort((a, b) => Date.parse(b.lastWatchedAt) - Date.parse(a.lastWatchedAt))
        .slice(0, 100);
}

export async function syncNextUp(
    activities: unknown,
    cache: SimklNextUpCache | undefined,
    readShows: (since?: string) => Promise<unknown>
): Promise<SimklNextUpCache | undefined> {
    const state = nextUpSyncState(activities);
    if (!state) return cache;
    if (cache && state.watching === cache.watching && state.removed === cache.removed) return cache;
    // A deletion is not included in date_from deltas. In that case re-read only the Watching bucket.
    const previous = cache && state.removed === cache.removed ? cache : undefined;
    return { ...state, items: mergeNextUp(await readShows(previous?.since), previous?.items) };
}
