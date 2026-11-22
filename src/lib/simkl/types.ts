import type { Media } from "@/lib/media";

export interface SimklRecommendation {
    media: Media;
    simklId: string;
    simklUrl: string;
}

export interface SimklTitleRating {
    rating: number;
    simklUrl: string;
}

/** Public playback data only. OAuth credentials never leave the server. */
export interface SimklPlaybackItem {
    id: string;
    type: "movie" | "show";
    title: string;
    year?: number;
    imdbId?: string;
    tmdbId?: string;
    simklId?: string;
    simklUrl?: string;
    progress: number;
    pausedAt: string;
    episode?: { season: number; number: number; title?: string };
    episodeMapped?: boolean;
}

export interface SimklNextUpItem extends Pick<SimklPlaybackItem, "id" | "title" | "year" | "imdbId" | "tmdbId"> {
    type: "show";
    simklId: string;
    simklUrl: string;
    episode: NonNullable<SimklPlaybackItem["episode"]>;
    lastWatchedEpisode: Pick<NonNullable<SimklPlaybackItem["episode"]>, "season" | "number">;
    lastWatchedAt: string;
}

export type ContinueWatchingItem = SimklPlaybackItem | SimklNextUpItem;

export interface SimklNextUpCache {
    since: string;
    watching: string;
    removed: string | null;
    items: SimklNextUpItem[];
}

export interface SimklPlaybackCache {
    stamp: string;
    items: SimklPlaybackItem[];
    syncedAt: string;
    nextUp?: SimklNextUpCache;
}

export interface SimklStatus {
    configured: boolean;
    connected: boolean;
    reconnectRequired?: boolean;
}

export interface SimklPlayback extends SimklStatus {
    items: SimklPlaybackItem[];
    nextUp?: SimklNextUpItem[];
    syncedAt?: string;
    stale?: boolean;
}
