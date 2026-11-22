import { useQueries } from "@tanstack/react-query";
import type { OmdbEpisodeRating } from "@/lib/omdb";
import { type DisplayEpisode, getOriginalEpisode } from "../utils/episode-imdb-rating";

export function useEpisodeImdbRatings(id: string | undefined, episodes: DisplayEpisode[]) {
    const seasons = /^(?:tt[0-9]{1,12})$/.test(id ?? "")
        ? [...new Set(episodes.map((episode) => getOriginalEpisode(episode).season))]
              .filter((season) => Number.isInteger(season) && season > 0 && season <= 250)
              .slice(0, 6)
        : [];
    const ratings = useQueries({
        queries: seasons.map((season) => ({
            queryKey: ["imdb", "episode-ratings", id, season],
            queryFn: async ({ signal }): Promise<OmdbEpisodeRating[]> => {
                const params = new URLSearchParams({ id: id ?? "", season: String(season) });
                const response = await fetch(`/api/imdb/season?${params}`, { signal });
                if (!response.ok) throw new Error("IMDb episode ratings unavailable");
                return response.json();
            },
            staleTime: 60 * 60_000,
            retry: false,
            refetchOnWindowFocus: false,
        })),
    });
    return new Map(seasons.map((season, index) => [season, ratings[index]?.data]));
}
