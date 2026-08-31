import type { MediaIdType } from "@/lib/media";

export interface MediaLink {
    idType: MediaIdType | "trakt";
    id: string;
    source: string;
    /** Set when the URL names the type; tmdb ids are only unique within one */
    type?: "movie" | "show";
}

/**
 * External media-database URLs a user might paste. Numeric provider IDs are resolved through
 * TMDB's external-id lookup. Trakt URLs carry a slug, which is converted to a TMDB title search.
 *
 * Host is matched as `(?:[\w-]+\.)*domain` preceded by a non-word char, so lookalike domains
 * (notimdb.com, imdb.com.phish.co) do not match.
 */
const PROVIDERS: { idType: MediaLink["idType"]; source: string; pattern: RegExp; typeFrom?: RegExp }[] = [
    // imdb.com/title/tt0111161 — optional locale segment: imdb.com/de/title/tt0384766
    {
        idType: "imdb",
        source: "IMDb",
        pattern: /(?:^|\W)(?:[\w-]+\.)*imdb\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(tt\d{7,10})\b/i,
    },
    // themoviedb.org/movie/550 or /tv/1399, with optional -slug suffix
    {
        idType: "tmdb",
        source: "TMDB",
        pattern: /(?:^|\W)(?:[\w-]+\.)*themoviedb\.org\/(?:movie|tv)\/(\d+)/i,
        typeFrom: /themoviedb\.org\/(movie|tv)\//i,
    },
    // thetvdb.com only exposes a numeric id on its dereferrer and legacy query URLs
    {
        idType: "tvdb",
        source: "TheTVDB",
        pattern: /(?:^|\W)(?:[\w-]+\.)*thetvdb\.com\/dereferrer\/(?:series|movie)\/(\d+)/i,
    },
    {
        idType: "tvdb",
        source: "TheTVDB",
        pattern: /(?:^|\W)(?:[\w-]+\.)*thetvdb\.com\/[^\s]*[?&]id=(\d+)/i,
    },
    // trakt.tv/movies/the-matrix-1999 or /shows/breaking-bad — id is a slug or a numeric trakt id,
    // and any trailing segment (/seasons/1/episodes/2, /comments, /ratings) still names the title
    {
        idType: "trakt",
        source: "Trakt",
        pattern: /(?:^|\W)(?:[\w-]+\.)*trakt\.tv\/(?:movies|shows)\/([\w-]+)/i,
        typeFrom: /trakt\.tv\/(movies|shows)\//i,
    },
];

export function parseMediaLink(input: string): MediaLink | null {
    for (const { idType, source, pattern, typeFrom } of PROVIDERS) {
        const id = input.match(pattern)?.[1];
        if (!id) continue;
        const segment = typeFrom ? input.match(typeFrom)?.[1]?.toLowerCase() : undefined;
        return {
            idType,
            id,
            source,
            type: segment ? (segment.startsWith("tv") || segment.startsWith("show") ? "show" : "movie") : undefined,
        };
    }
    return null;
}

/** Convert a Trakt title slug such as `the-matrix-1999` into a TMDB search query and optional year. */
export function parseTraktSlug(slug: string): { query: string; year?: number } {
    const yearMatch = slug.match(/-(\d{4})$/);
    const query = slug
        .replace(/-\d{4}$/, "")
        .replace(/-+/g, " ")
        .trim();

    return {
        query,
        year: yearMatch ? Number(yearMatch[1]) : undefined,
    };
}
