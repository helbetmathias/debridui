import "server-only";
import { z } from "zod";
import { cdnUrl } from "@/lib/media/images";
import { simklConfig } from "./security";
import type { SimklRecommendation } from "./types";

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

export async function getSimklRecommendations({ id, type }: RecommendationQuery): Promise<SimklRecommendation[]> {
    const namespace = type === "movie" ? "movies" : "tv";
    const simklType = type === "movie" ? "movie" : "tv";
    const signal = AbortSignal.timeout(3_000);
    const lookup = catalogUrl("/redirect");
    const idKind = id.startsWith("tt") ? "imdb" : "tmdb";
    lookup.searchParams.set("to", "simkl");
    lookup.searchParams.set("type", simklType);
    lookup.searchParams.set(idKind, id);
    const redirect = await fetch(lookup, { headers, redirect: "manual", cache: "no-store", signal });
    if (redirect.status !== 301) return [];
    const location = new URL(redirect.headers.get("Location") ?? "", "https://api.simkl.com");
    if (location.origin !== "https://simkl.com") return [];
    const [, resolvedNamespace, resolvedId] = location.pathname.split("/");
    const sourceId = numericId.safeParse(resolvedId);
    if (resolvedNamespace !== namespace || !sourceId.success) return [];

    const readDetails = async (simklId: string) => {
        const response = await fetch(catalogUrl(`/${namespace}/${simklId}`), {
            headers,
            redirect: "error",
            next: { revalidate: SUMMARY_TTL },
            signal,
        });
        if (!response.ok) return null;
        const parsed = detailsSchema.safeParse(await response.json());
        return parsed.success && parsed.data.ids.simkl === simklId ? parsed.data : null;
    };

    const details = await readDetails(sourceId.data);
    if (!details || (details.ids[idKind] && details.ids[idKind] !== id)) return [];

    function parseCandidates(entries: unknown[]) {
        return entries.slice(0, 50).flatMap((entry) => {
            const candidate = candidateSchema.safeParse(entry);
            if (
                !candidate.success ||
                (candidate.data.type === "show" ? "tv" : candidate.data.type) !== simklType ||
                candidate.data.ids.simkl === sourceId.data
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
    // Community picks sometimes include only a SIMKL ID. Look up a bounded number of top entries.
    await Promise.all(
        missingIds.slice(0, COMMUNITY_LOOKUP_LIMIT).map(async (key) => {
            const entry = await readDetails(key).catch(() => null);
            if (entry) resolvedIds.set(key, entry.ids);
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
                ids: { slug: ids.tmdb ?? ids.imdb, imdb: ids.imdb },
                images: candidate.poster
                    ? { poster: [cdnUrl(`https://simkl.in/posters/${candidate.poster}_m.webp`, { q: 90 })] }
                    : undefined,
            },
            simklUrl: `https://simkl.com/${namespace}/${ids.simkl}${slug ? `/${slug}` : ""}`,
        });
        if (items.length >= LIMIT) break;
    }
    return items;
}
