import type { ContinueWatchingItem, SimklPlayback } from "@/lib/simkl/types";
import { playbackVisibilityKey } from "./hidden-playbacks";

function seriesKeys(item: ContinueWatchingItem) {
    if (item.type !== "show") return [];
    return [
        item.imdbId && `imdb:${item.imdbId}`,
        item.tmdbId && `tmdb:${item.tmdbId}`,
        item.simklId && `simkl:${item.simklId}`,
    ].filter((key): key is string => !!key);
}

export function getContinueWatchingItems(data: SimklPlayback | undefined, hidden: Set<string>): ContinueWatchingItem[] {
    if (!data?.connected || data.reconnectRequired) return [];
    const nextUp = data.nextUp ?? [];
    const bySeries = new Map(nextUp.flatMap((item) => seriesKeys(item).map((key) => [key, item] as const)));
    const resumable = data.items.filter((item) => {
        if (!item.episode || item.episodeMapped === false) return true;
        const current = seriesKeys(item)
            .map((key) => bySeries.get(key))
            .find(Boolean);
        return !(
            current &&
            item.episode.season === current.lastWatchedEpisode.season &&
            item.episode.number === current.lastWatchedEpisode.number &&
            Date.parse(current.lastWatchedAt) > Date.parse(item.pausedAt)
        );
    });
    const inProgress = new Set(resumable.flatMap(seriesKeys));
    const visible = (item: ContinueWatchingItem) => !hidden.has(playbackVisibilityKey(item));
    return [
        ...resumable.filter(visible),
        ...nextUp.filter((item) => visible(item) && !seriesKeys(item).some((key) => inProgress.has(key))).slice(0, 12),
    ];
}
