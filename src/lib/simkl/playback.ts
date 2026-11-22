import { z } from "zod";
import type { SimklPlaybackItem } from "./types";

const mediaSchema = z.object({
    title: z.string().min(1),
    year: z.number().int().optional(),
    ids: z.object({
        imdb: z.string().optional(),
        tmdb: z.union([z.string(), z.number()]).optional(),
        simkl: z.union([z.string(), z.number()]).optional(),
        slug: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{1,200}$/)
            .optional()
            .catch(undefined),
    }),
});
const sessionSchema = z.object({
    id: z.union([z.number(), z.string()]),
    progress: z.number().finite().min(0).max(100),
    paused_at: z.string().datetime({ offset: true }),
    type: z.enum(["movie", "episode"]),
    movie: mediaSchema.optional(),
    show: mediaSchema.optional(),
    anime: mediaSchema.optional(),
    episode: z
        .object({
            season: z.number().int().min(0),
            number: z.number().int().min(1),
            title: z.string().optional(),
            tvdb_season: z.number().int().min(0).optional(),
            tvdb_number: z.number().int().min(1).optional(),
        })
        .optional(),
});

export function normalizePlayback(payload: unknown): SimklPlaybackItem[] {
    if (!Array.isArray(payload)) throw new Error("Invalid SIMKL playback response");
    const items: { identity: string; item: SimklPlaybackItem }[] = [];
    const seen = new Set<string>();
    for (const raw of payload) {
        const parsed = sessionSchema.safeParse(raw);
        if (!parsed.success) continue;
        const session = parsed.data;
        const media = session.type === "movie" ? (session.movie ?? session.anime) : (session.show ?? session.anime);
        if (!media || session.progress <= 0 || session.progress >= 100) continue;
        const episode = session.type === "episode" ? session.episode : undefined;
        if (session.type === "episode" && !episode) continue;
        // SIMKL supplies TVDB-mapped episode numbers for anime when available.
        const season = episode?.tvdb_season ?? episode?.season;
        const number = episode?.tvdb_number ?? episode?.number;
        const identity = `${session.type}:${media.ids.simkl ?? media.ids.imdb ?? session.id}:${season}:${number}`;
        const imdbId = /^tt\d+$/.test(media.ids.imdb ?? "") ? media.ids.imdb : undefined;
        const simklId = String(media.ids.simkl ?? "");
        const simklPath = session.anime ? "anime" : session.type === "movie" ? "movies" : "tv";
        items.push({
            identity,
            item: {
                id: String(session.id),
                type: session.type === "movie" ? "movie" : "show",
                title: media.title,
                year: media.year,
                imdbId,
                tmdbId: media.ids.tmdb ? String(media.ids.tmdb) : undefined,
                simklId: media.ids.simkl ? String(media.ids.simkl) : undefined,
                ...(/^[1-9][0-9]{0,10}$/.test(simklId)
                    ? {
                          simklUrl: `https://simkl.com/${simklPath}/${simklId}${media.ids.slug ? `/${media.ids.slug}` : ""}`,
                      }
                    : {}),
                progress: session.progress,
                pausedAt: session.paused_at,
                episodeMapped:
                    !episode ||
                    !session.anime ||
                    (episode.tvdb_season !== undefined && episode.tvdb_number !== undefined),
                ...(episode && season !== undefined && number !== undefined
                    ? { episode: { season, number, title: episode.title } }
                    : {}),
            },
        });
    }
    return items
        .sort((a, b) => Date.parse(b.item.pausedAt) - Date.parse(a.item.pausedAt))
        .filter(({ identity }) => {
            if (seen.has(identity)) return false;
            seen.add(identity);
            return true;
        })
        .slice(0, 30)
        .map(({ item }) => item);
}

export function playbackStamp(payload: unknown): string {
    const schema = z.object({
        movies: z.object({ playback: z.string().nullable().optional() }).optional(),
        tv_shows: z.object({ playback: z.string().nullable().optional() }).optional(),
        anime: z.object({ playback: z.string().nullable().optional() }).optional(),
    });
    const value = schema.parse(payload);
    return JSON.stringify([value.movies?.playback, value.tv_shows?.playback, value.anime?.playback]);
}
