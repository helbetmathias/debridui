import "server-only";
import { z } from "zod";
import { cdnUrl } from "@/lib/media/images";
import { simklConfig } from "./security";
import type { SimklRecommendation, SimklTitleRating } from "./types";

const imdbId = z.string().regex(/^tt[0-9]{1,12}$/);
const numericId = z
    .union([z.string(), z.number().int()])
    .transform(String)
    .pipe(z.string().regex(/^[1-9][0-9]{0,10}$/));
export const simklRecommendationQuery = z.object({
    id: z.string().regex(/^(?:tt[0-9]{1,12}|[1-9][0-9]{0,10})$/),
    type: z.enum(["movie", "show"]),
});
type RecommendationQuery = z.infer<typeof simklRecommendationQuery>;
export const simklRatingQuery = simklRecommendationQuery.extend({ id: numericId });
type RatingQuery = z.infer<typeof simklRatingQuery>;

const idsSchema = z.object({
    simkl: numericId,
    imdb: imdbId.optional().catch(undefined),
    tmdb: numericId.optional().catch(undefined),
    slug: z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,200}$/)
        .optional()
        .catch(undefined),
});
const candidateSchema = z.object({
    ids: idsSchema,
    type: z.enum(["movie", "tv", "show"]),
    title: z.string().trim().min(1),
    year: z.number().int().positive().optional().catch(undefined),
    poster: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/)
        .max(200)
        .optional()
        .catch(undefined),
});
const detailsSchema = z.object({
    ids: idsSchema,
    ratings: z
        .object({ imdb: z.object({ rating: z.number().positive().max(10) }) })
        .optional()
        .catch(undefined),
    users_recommendations: z.array(z.unknown()).catch([]),
    similar: z.array(z.unknown()).catch([]),
});

const LIMIT = 16;
const COMMUNITY_LOOKUP_LIMIT = 4;
const SUMMARY_TTL = 6 * 60 * 60;

function catalogUrl(path: string) {
    const url = new URL(path, "https://api.simkl.com");
    url.searchParams.set("client_id", simklConfig().clientId);
    url.searchParams.set("app-name", "debridui");
    url.searchParams.set("app-version", "1.0");
    return url;
}

const headers = { "User-Agent": "DebridUI/1.0" };

async function readDetails(namespace: "movies" | "tv", simklId: string, signal: AbortSignal) {
    const response = await fetch(catalogUrl(`/${namespace}/${simklId}`), {
        headers,
        redirect: "error",
        next: { revalidate: SUMMARY_TTL },
        signal,
    });
    if (!response.ok) return null;
    const parsed = detailsSchema.safeParse(await response.json());
    return parsed.success && parsed.data.ids.simkl === simklId ? parsed.data : null;
}

export async function getSimklImdbRating({ id, type }: RatingQuery): Promise<number | null> {
    const detail = await readDetails(type === "movie" ? "movies" : "tv", id, AbortSignal.timeout(3_000));
    return detail?.ratings?.imdb.rating ?? null;
}

async function readByExternalId({ id, type }: RecommendationQuery, signal: AbortSignal) {
    const namespace: "movies" | "tv" = type === "movie" ? "movies" : "tv";
    const simklType: "movie" | "tv" = type === "movie" ? "movie" : "tv";
    const lookup = catalogUrl("/redirect");
    const idKind: "imdb" | "tmdb" = id.startsWith("tt") ? "imdb" : "tmdb";
    lookup.searchParams.set("to", "simkl");
    lookup.searchParams.set("type", simklType);
    lookup.searchParams.set(idKind, id);
    const redirect = await fetch(lookup, { headers, redirect: "manual", cache: "no-store", signal });
    if (redirect.status !== 301) return null;
    const location = new URL(redirect.headers.get("Location") ?? "", "https://api.simkl.com");
    if (location.origin !== "https://simkl.com") return null;
    const [, resolvedNamespace, resolvedId] = location.pathname.split("/");
    const sourceId = numericId.safeParse(resolvedId);
    if (resolvedNamespace !== namespace || !sourceId.success) return null;

    const details = await readDetails(namespace, sourceId.data, signal);
    if (!details || (details.ids[idKind] && details.ids[idKind] !== id)) return null;
    return { details, namespace, simklType, idKind };
}

export async function getSimklTitleImdbRating(query: RecommendationQuery): Promise<SimklTitleRating | null> {
    const result = await readByExternalId(query, AbortSignal.timeout(3_000));
    if (!result?.details.ratings || result.details.ids[result.idKind] !== query.id) return null;
    const { ratings, ids } = result.details;
    return { rating: ratings.imdb.rating, simklUrl: simklTitleUrl(result.namespace, ids.simkl, ids.slug) };
}

function simklTitleUrl(namespace: "movies" | "tv", id: string, slug?: string) {
    return `https://simkl.com/${namespace}/${id}${slug ? `/${slug}` : ""}`;
}

export async function getSimklRecommendations(query: RecommendationQuery): Promise<SimklRecommendation[]> {
    const signal = AbortSignal.timeout(3_000);
    const result = await readByExternalId(query, signal);
    if (!result) return [];
    const { id } = query;
    const { details, namespace, simklType, idKind } = result;

    function parseCandidates(entries: unknown[]) {
        return entries.slice(0, 50).flatMap((entry) => {
            const candidate = candidateSchema.safeParse(entry);
            if (
                !candidate.success ||
                (candidate.data.type === "show" ? "tv" : candidate.data.type) !== simklType ||
                candidate.data.ids.simkl === details.ids.simkl
            )
                return [];
            return [candidate.data];
        });
    }

    const community = parseCandidates(details.users_recommendations);
    const similar = parseCandidates(details.similar);
    const resolvedIds = new Map(
        [...similar, ...community].filter(({ ids }) => ids.imdb || ids.tmdb).map(({ ids }) => [ids.simkl, ids])
    );
    const missingIds = [...new Set(community.map(({ ids }) => ids.simkl).filter((key) => !resolvedIds.has(key)))];
    const knownRatings = new Map<string, number>();
    // Community picks sometimes include only a SIMKL ID. Look up a bounded number of top entries.
    await Promise.all(
        missingIds.slice(0, COMMUNITY_LOOKUP_LIMIT).map(async (key) => {
            const entry = await readDetails(namespace, key, signal).catch(() => null);
            if (!entry) return;
            resolvedIds.set(key, entry.ids);
            if (entry.ratings) knownRatings.set(key, entry.ratings.imdb.rating);
        })
    );

    const seen = new Set([idKind === "tmdb" ? `tmdb:${id}` : id]);
    if (details.ids.tmdb) seen.add(`tmdb:${details.ids.tmdb}`);
    if (details.ids.imdb) seen.add(details.ids.imdb);
    const items: SimklRecommendation[] = [];
    for (const candidate of [...community, ...similar]) {
        const ids = resolvedIds.get(candidate.ids.simkl);
        if (!ids || !(ids.tmdb || ids.imdb)) continue;
        const keys = [`simkl:${ids.simkl}`, ...(ids.tmdb ? [`tmdb:${ids.tmdb}`] : []), ...(ids.imdb ? [ids.imdb] : [])];
        if (keys.some((key) => seen.has(key))) continue;
        for (const key of keys) seen.add(key);
        const slug = candidate.ids.slug ?? ids.slug;
        items.push({
            media: {
                title: candidate.title,
                year: candidate.year,
                rating: knownRatings.get(ids.simkl),
                ids: { slug: ids.tmdb ?? ids.imdb, imdb: ids.imdb },
                images: candidate.poster
                    ? { poster: [cdnUrl(`https://simkl.in/posters/${candidate.poster}_m.webp`, { q: 90 })] }
                    : undefined,
            },
            simklId: ids.simkl,
            simklUrl: simklTitleUrl(namespace, ids.simkl, slug),
        });
        if (items.length >= LIMIT) break;
    }
    return items;
}
