import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { createTMDBClient, type TMDBEpisodeGroupDetails, type TMDBEpisodeGroupsResponse } from "@/lib/tmdb";

const CACHE_DURATION = {
    SHORT: 5 * 60 * 1000, // 5 minutes
    STANDARD: 6 * 60 * 60 * 1000, // 6 hours
    LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// biome-ignore lint/suspicious/noExplicitAny: rest tuple type erases call-site inference; replace when a typed alternative emerges
function createTMDBHook<T extends any[], R>(
    keyParts: string[],
    fn: (client: ReturnType<typeof createTMDBClient>, ...args: T) => Promise<R>,
    cacheDuration: number,
    argsEnabled?: (...args: T) => boolean
) {
    return (...args: T): UseQueryResult<R> => {
        return useQuery({
            queryKey: ["tmdb", ...keyParts, ...args],
            queryFn: () => fn(createTMDBClient(), ...args),
            staleTime: cacheDuration,
            enabled: argsEnabled ? argsEnabled(...args) : true,
        });
    };
}

export const useTMDBSeriesEpisodeGroups = createTMDBHook<[number], TMDBEpisodeGroupsResponse>(
    ["series", "episode-groups"],
    (client, seriesId) => client.getTVSeriesEpisodeGroups(seriesId),
    CACHE_DURATION.LONG,
    (seriesId) => !!seriesId
);

export const useTMDBEpisodeGroupDetails = createTMDBHook<[string], TMDBEpisodeGroupDetails>(
    ["episode-group", "details"],
    (client, groupId) => client.getEpisodeGroupDetails(groupId),
    CACHE_DURATION.LONG,
    (groupId) => !!groupId
);
