// Normalized media types shared by TMDB, Stremio addons, and the UI.
export interface MediaIds {
    slug?: string;
    imdb?: string;
}

export interface MediaImages {
    poster?: string[];
    fanart?: string[];
    banner?: string[];
}

export interface Media {
    title: string;
    year?: number;
    ids?: MediaIds;
    images?: MediaImages;
    rating?: number;
    genres?: string[];
    overview?: string;
}

export interface MediaItem {
    movie?: Media;
    show?: Media;
}

// Rich TMDB-backed media shapes used by detail views.
export interface MediaProviderIds extends MediaIds {
    slug: string;
    tvdb?: number;
    tmdb: number;
}

export interface MediaDetails extends Media {
    year: number;
    ids?: MediaProviderIds;
    images?: MediaImageSet;
    votes?: number;
    runtime?: number;
    language?: string;
    country?: string;
    trailer?: string;
    homepage?: string;
    status?: string;
    aired_episodes?: number;
    certification?: string;
}

export interface MediaSeason {
    number: number;
    ids: MediaProviderIds;
    images?: MediaImageSet;
    title?: string;
    overview?: string;
    rating?: number;
    votes?: number;
    episode_count?: number;
    aired_episodes?: number;
    first_aired?: string;
}

export interface MediaEpisode {
    season: number;
    number: number;
    title: string;
    ids: MediaProviderIds;
    images?: MediaImageSet;
    number_abs?: number;
    overview?: string;
    first_aired?: string; // ISO date
    updated_at?: string; // ISO date
    rating?: number;
    votes?: number;
    comment_count?: number;
    available_translations?: string[]; // ISO language codes (en, es, fr, de, etc.)
    runtime?: number;
    episode_type?: string; // standard, series_premiere, mid_season_finale, mid_season_premiere, season_finale, series_finale
    original_title?: string;
}

export interface MediaImageSet {
    fanart: string[];
    poster: string[];
    logo: string[];
    clearart: string[];
    banner: string[];
    thumb: string[];
    headshot: string[];
    screenshot: string[];
}

export interface MediaPerson {
    name: string;
    ids: MediaProviderIds;
    images?: Pick<MediaImageSet, "headshot" | "fanart">;
}

export interface PersonDetails extends MediaPerson {
    social_ids?: {
        twitter?: string;
        facebook?: string;
        instagram?: string;
        wikipedia?: string;
    };
    biography?: string;
    birthday?: string;
    death?: string;
    birthplace?: string;
    homepage?: string;
    gender?: string;
    known_for_department?: string;
}

export interface PersonMovieCredit {
    characters?: string[];
    jobs?: string[];
    movie: MediaDetails;
}

export interface PersonShowCredit {
    characters?: string[];
    jobs?: string[];
    episode_count?: number;
    series_regular?: boolean;
    show: MediaDetails;
}

export interface PersonMovieCredits {
    cast?: PersonMovieCredit[];
    crew?: {
        production?: PersonMovieCredit[];
        art?: PersonMovieCredit[];
        crew?: PersonMovieCredit[];
        "costume & make-up"?: PersonMovieCredit[];
        directing?: PersonMovieCredit[];
        writing?: PersonMovieCredit[];
        sound?: PersonMovieCredit[];
        camera?: PersonMovieCredit[];
        editing?: PersonMovieCredit[];
        "visual effects"?: PersonMovieCredit[];
    };
}

export interface PersonShowCredits {
    cast?: PersonShowCredit[];
    crew?: {
        production?: PersonShowCredit[];
        art?: PersonShowCredit[];
        crew?: PersonShowCredit[];
        "costume & make-up"?: PersonShowCredit[];
        directing?: PersonShowCredit[];
        writing?: PersonShowCredit[];
        sound?: PersonShowCredit[];
        camera?: PersonShowCredit[];
        editing?: PersonShowCredit[];
        "visual effects"?: PersonShowCredit[];
        "created by"?: PersonShowCredit[];
    };
}

export interface CastMember {
    characters: string[];
    person: MediaPerson;
    episode_count?: number; // only for shows
}

export interface CrewMember {
    jobs?: string[];
    job?: string[];
    person: MediaPerson;
}

export interface MediaCrew {
    production?: CrewMember[];
    art?: CrewMember[];
    crew?: CrewMember[];
    "costume & make-up"?: CrewMember[];
    directing?: CrewMember[];
    writing?: CrewMember[];
    sound?: CrewMember[];
    camera?: CrewMember[];
}

export interface CastAndCrew {
    cast: CastMember[];
    crew: MediaCrew;
}

export interface RankedMediaItem extends MediaItem {
    movie?: MediaDetails;
    show?: MediaDetails;
    watchers?: number;
    plays?: number;
    collected?: number;
    collectors?: number;
}

export interface MediaSearchResult {
    type: "movie" | "show" | "episode" | "person";
    score: number;
    movie?: MediaDetails;
    show?: MediaDetails;
}

// External id types supported by the TMDB lookup proxy.
export type MediaIdType = "imdb" | "tmdb" | "tvdb";

// A search/lookup result is usable only when its type matches a populated media field.
const isMovieOrShow = (result: MediaSearchResult) =>
    (result.type === "movie" && !!result.movie) || (result.type === "show" && !!result.show);

export type MediaType = "movie" | "show";
export type MediaTypeEndpoint = "movies" | "shows";

export interface MediaClientConfig {
    baseUrl?: string;
}

// Error classes
export class MediaClientError extends Error {
    constructor(
        message: string,
        public status?: number,
        public endpoint?: string
    ) {
        super(message);
        this.name = "MediaClientError";
    }
}

export class MediaClient {
    private readonly baseUrl: string;

    constructor(config: MediaClientConfig) {
        this.baseUrl = config.baseUrl || "/api/tmdb";
    }

    private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new MediaClientError(
                    body?.error || `API request failed: ${response.statusText}`,
                    response.status,
                    endpoint
                );
            }

            // Handle empty responses (204 No Content)
            if (response.status === 204) {
                return {} as T;
            }

            const data = await response.json();
            return data as T;
        } catch (error) {
            if (error instanceof MediaClientError) {
                throw error;
            }
            throw new MediaClientError(
                `Request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                undefined,
                endpoint
            );
        }
    }

    // Search Methods
    /**
     * Search for movies and shows
     */
    public async search(query: string, types: MediaType[] = ["movie", "show"]): Promise<MediaSearchResult[]> {
        if (!query.trim()) {
            return [];
        }

        const typeParam = types.join(",");
        const endpoint = `/search/${typeParam}?query=${encodeURIComponent(query)}`;

        const results = await this.makeRequest<MediaSearchResult[]>(endpoint);

        return results.filter(isMovieOrShow).sort((a, b) => b.score - a.score);
    }

    /**
     * Resolve a movie/show by an IMDb, TMDB, or TVDB id.
     * Returns type + full media in a single call.
     */
    public async idLookup(idType: MediaIdType, id: string): Promise<MediaSearchResult[]> {
        const results = await this.makeRequest<MediaSearchResult[]>(`/search/${idType}/${id}`);
        return results.filter(isMovieOrShow);
    }

    // Convenience Methods
    /**
     * Get trending movies
     */
    public async getTrendingMovies(limit = 20): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/movies/trending?limit=${limit}`);
    }

    /**
     * Get trending shows
     */
    public async getTrendingShows(limit = 20): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/shows/trending?limit=${limit}`);
    }

    /**
     * Get trending mixed (movies and shows) sorted by watchers
     */
    public async getTrendingMixed(limit = 20): Promise<{ mixed: RankedMediaItem[] }> {
        const [movies, shows] = await Promise.all([this.getTrendingMovies(limit), this.getTrendingShows(limit)]);

        // Combine and sort by watchers (descending)
        const mixed = [...movies, ...shows].sort((a, b) => (b.watchers || 0) - (a.watchers || 0)).slice(0, limit);

        return { mixed };
    }

    /**
     * Get popular movies
     */
    public async getPopularMovies(limit = 20): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/movies/popular?limit=${limit}`);
    }

    /**
     * Get popular shows
     */
    public async getPopularShows(limit = 20): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/shows/popular?limit=${limit}`);
    }

    /**
     * Get most watched movies
     */
    public async getMostWatchedMovies(period = "weekly", limit = 20): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/movies/watched/${period}?limit=${limit}`);
    }

    /**
     * Get most watched shows
     */
    public async getMostWatchedShows(period = "weekly", limit = 20): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/shows/watched/${period}?limit=${limit}`);
    }

    /**
     * Get anticipated movies
     */
    public async getAnticipatedMovies(limit = 20): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/movies/anticipated?limit=${limit}`);
    }

    /**
     * Get anticipated shows
     */
    public async getAnticipatedShows(limit = 20): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/shows/anticipated?limit=${limit}`);
    }

    /**
     * Get box office movies
     */
    public async getBoxOfficeMovies(): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/movies/boxoffice`);
    }

    /**
     * Get TMDB recommendations for a movie or show, supplemented by similar titles.
     */
    public async getRecommendations(id: string, type: MediaType, limit = 20): Promise<RankedMediaItem[]> {
        return this.makeRequest<RankedMediaItem[]>(`/${type}s/${id}/recommendations?limit=${limit}`);
    }

    /**
     * Get movie by ID
     */
    public async getMovie(id: string): Promise<MediaDetails> {
        return this.makeRequest<MediaDetails>(`/movies/${id}`);
    }

    /**
     * Get show by ID
     */
    public async getShow(id: string): Promise<MediaDetails> {
        return this.makeRequest<MediaDetails>(`/shows/${id}`);
    }

    /**
     * Get show seasons
     */
    public async getShowSeasons(id: string): Promise<MediaSeason[]> {
        return this.makeRequest<MediaSeason[]>(`/shows/${id}/seasons`);
    }

    /**
     * Get show episodes
     */
    public async getShowEpisodes(id: string, season: number): Promise<MediaEpisode[]> {
        return this.makeRequest<MediaEpisode[]>(`/shows/${id}/seasons/${season}/episodes`);
    }

    /**
     * Get cast and crew for a movie or show
     */
    public async getPeople(id: string, type: "movies" | "shows"): Promise<CastAndCrew> {
        return this.makeRequest<CastAndCrew>(`/${type}/${id}/people`);
    }

    /**
     * Get person details by ID/slug
     */
    public async getPerson(id: string): Promise<PersonDetails> {
        return this.makeRequest<PersonDetails>(`/people/${id}`);
    }

    /**
     * Get person's movie credits
     */
    public async getPersonMovies(id: string): Promise<PersonMovieCredits> {
        return this.makeRequest<PersonMovieCredits>(`/people/${id}/movies`);
    }

    /**
     * Get person's show credits
     */
    public async getPersonShows(id: string): Promise<PersonShowCredits> {
        return this.makeRequest<PersonShowCredits>(`/people/${id}/shows`);
    }
}

export const mediaClient = new MediaClient({
    baseUrl: "/api/tmdb",
});
