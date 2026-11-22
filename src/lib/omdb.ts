import "server-only";
import { z } from "zod";

const imdbId = z.string().regex(/^tt[0-9]{1,12}$/);
const numberFromString = z
    .string()
    .regex(/^[0-9]{1,4}$/)
    .transform(Number);
export const omdbSeasonQuery = z.object({
    id: imdbId,
    season: numberFromString.pipe(z.number().int().min(1).max(250)),
});

const ratingsSchema = z.object({
    Response: z.literal("True"),
    Season: numberFromString,
    Episodes: z.array(z.unknown()).max(500),
});
const episodeSchema = z.object({
    imdbID: imdbId,
    Title: z.string().trim().min(1).max(400),
    Episode: numberFromString.pipe(z.number().int().positive()),
    Released: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .catch(undefined),
    imdbRating: z
        .string()
        .regex(/^(?:[0-9]|10)(?:\.\d{1,3})?$/)
        .transform(Number)
        .pipe(z.number().positive().max(10)),
});

export interface OmdbEpisodeRating {
    imdbId: string;
    number: number;
    title: string;
    released?: string;
    rating: number;
}

export async function getOmdbSeasonRatings({ id, season }: z.infer<typeof omdbSeasonQuery>) {
    const apiKey = process.env.OMDB_API_KEY?.trim();
    if (!apiKey) return [];

    const url = new URL("https://www.omdbapi.com/");
    url.search = new URLSearchParams({ i: id, Season: String(season), apikey: apiKey }).toString();
    const response = await fetch(url, {
        redirect: "error",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3_000),
        next: { revalidate: 60 * 60 },
    });
    if (!response.ok) throw new Error("OMDb unavailable");

    const result = ratingsSchema.safeParse(await response.json());
    if (!result.success || result.data.Season !== season) return [];
    return result.data.Episodes.flatMap((raw): OmdbEpisodeRating[] => {
        const episode = episodeSchema.safeParse(raw);
        if (!episode.success) return [];
        const { imdbID, Title, Episode, Released, imdbRating } = episode.data;
        return [{ imdbId: imdbID, title: Title, number: Episode, released: Released, rating: imdbRating }];
    });
}
