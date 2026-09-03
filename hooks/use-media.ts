import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { type MediaIdType, mediaClient } from "@/lib/media";

// Cache duration constants
const CACHE_DURATION = {
    SHORT: 5 * 60 * 1000, // 5 minutes
    STANDARD: 6 * 60 * 60 * 1000, // 6 hours
    LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Generic TMDB-backed query hook factory
// biome-ignore lint/suspicious/noExplicitAny: rest tuple type erases call-site inference; replace when a typed alternative emerges
function createMediaHook<T extends any[], R>(
    keyParts: string[],
    fn: (...args: T) => Promise<R>,
    cacheDuration: number
) {
    return (...args: T): UseQueryResult<R> => {
        return useQuery({
            queryKey: ["tmdb", ...keyParts, ...args],
            queryFn: () => fn(...args),
            staleTime: cacheDuration,
        });
    };
}

// List hooks - significantly reduced code
export const useTrendingMovies = createMediaHook(
    ["movies", "trending"],
    (limit = 20) => mediaClient.getTrendingMovies(limit),
    CACHE_DURATION.STANDARD
);

export const useTrendingShows = createMediaHook(
    ["shows", "trending"],
    (limit = 20) => mediaClient.getTrendingShows(limit),
    CACHE_DURATION.STANDARD
);

export const usePopularMovies = createMediaHook(
    ["movies", "popular"],
    (limit = 20) => mediaClient.getPopularMovies(limit),
    CACHE_DURATION.STANDARD
);

export const usePopularShows = createMediaHook(
    ["shows", "popular"],
    (limit = 20) => mediaClient.getPopularShows(limit),
    CACHE_DURATION.STANDARD
);

export const useMostWatchedMovies = createMediaHook(
    ["movies", "watched"],
    (period = "weekly", limit = 20) => mediaClient.getMostWatchedMovies(period, limit),
    CACHE_DURATION.STANDARD
);

export const useMostWatchedShows = createMediaHook(
    ["shows", "watched"],
    (period = "weekly", limit = 20) => mediaClient.getMostWatchedShows(period, limit),
    CACHE_DURATION.STANDARD
);

export const useAnticipatedMovies = createMediaHook(
    ["movies", "anticipated"],
    (limit = 20) => mediaClient.getAnticipatedMovies(limit),
    CACHE_DURATION.STANDARD
);

export const useAnticipatedShows = createMediaHook(
    ["shows", "anticipated"],
    (limit = 20) => mediaClient.getAnticipatedShows(limit),
    CACHE_DURATION.STANDARD
);

export const useBoxOfficeMovies = createMediaHook(
    ["movies", "boxoffice"],
    () => mediaClient.getBoxOfficeMovies(),
    CACHE_DURATION.STANDARD
);

export function useMediaRecommendations(id: string, type: "movie" | "show", enabled = true, limit = 20) {
    return useQuery({
        queryKey: ["tmdb", type, id, "recommendations", limit],
        queryFn: () => mediaClient.getRecommendations(id, type, limit),
        staleTime: CACHE_DURATION.LONG,
        enabled: enabled && !!id,
    });
}

// Details hooks
export const useMovieDetails = createMediaHook(
    ["movie"],
    (slug: string) => mediaClient.getMovie(slug),
    CACHE_DURATION.LONG
);

export const useShowDetails = createMediaHook(
    ["show"],
    (slug: string) => mediaClient.getShow(slug),
    CACHE_DURATION.LONG
);

export const useShowSeasons = createMediaHook(
    ["show", "seasons"],
    (slug: string) => mediaClient.getShowSeasons(slug),
    CACHE_DURATION.LONG
);

export const useMediaSeasonEpisodes = createMediaHook(
    ["season", "episodes"],
    (slug: string, season: number) => mediaClient.getShowEpisodes(slug, season),
    CACHE_DURATION.LONG
);

// Combined hooks
export function useTrendingMixed(limit = 20) {
    return useQuery({
        queryKey: ["tmdb", "mixed", "trending", limit],
        queryFn: () => mediaClient.getTrendingMixed(limit),
        staleTime: CACHE_DURATION.STANDARD,
    });
}

// Fetch media by id. When `type` is known (slug routes) it hits the type-specific
// endpoint directly; when omitted (external-id routes) a single id-lookup resolves
// both the type and the media. `idType` selects the external id namespace.
export function useMediaDetails({
    id,
    type,
    idType = "imdb",
}: {
    id: string;
    type?: "movie" | "show";
    idType?: MediaIdType;
}) {
    const direct = useQuery({
        queryKey: ["tmdb", "media", id, type],
        queryFn: () => (type === "movie" ? mediaClient.getMovie(id) : mediaClient.getShow(id)),
        staleTime: CACHE_DURATION.LONG,
        enabled: !!id && !!type,
    });

    const lookup = useQuery({
        queryKey: ["tmdb", "lookup", idType, id],
        queryFn: () => mediaClient.idLookup(idType, id),
        staleTime: CACHE_DURATION.LONG,
        enabled: !!id && !type,
    });

    if (type) {
        return { media: direct.data, type, isLoading: direct.isLoading, error: direct.error };
    }

    const result = lookup.data?.[0];
    const resolvedType = result?.type as "movie" | "show" | undefined;
    const media = result?.movie ?? result?.show;
    const notFound = lookup.isSuccess && !media;
    return {
        media,
        type: resolvedType,
        isLoading: lookup.isLoading,
        error: lookup.error ?? (notFound ? new Error("Title not found") : null),
    };
}

export const useShowEpisodes = useMediaSeasonEpisodes;

export function useMediaPeople(id: string, type: "movies" | "shows" = "movies") {
    return useQuery({
        queryKey: ["tmdb", "people", id, type],
        queryFn: () => mediaClient.getPeople(id, type),
        staleTime: CACHE_DURATION.LONG,
    });
}

export const useMediaPerson = createMediaHook(
    ["person"],
    (slug: string) => mediaClient.getPerson(slug),
    CACHE_DURATION.LONG
);

export const useMediaPersonMovies = createMediaHook(
    ["person", "movies"],
    (slug: string) => mediaClient.getPersonMovies(slug),
    CACHE_DURATION.LONG
);

export const useMediaPersonShows = createMediaHook(
    ["person", "shows"],
    (slug: string) => mediaClient.getPersonShows(slug),
    CACHE_DURATION.LONG
);
