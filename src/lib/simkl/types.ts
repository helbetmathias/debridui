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
    progress: number;
    pausedAt: string;
    episode?: { season: number; number: number; title?: string };
    episodeMapped?: boolean;
}

export interface SimklPlaybackCache {
    stamp: string;
    items: SimklPlaybackItem[];
    syncedAt: string;
}

export interface SimklStatus {
    configured: boolean;
    connected: boolean;
    reconnectRequired?: boolean;
}

export interface SimklPlayback extends SimklStatus {
    items: SimklPlaybackItem[];
    syncedAt?: string;
    stale?: boolean;
}
