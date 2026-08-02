import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import type {
    CastAndCrew,
    MediaCrew,
    MediaEpisode,
    MediaImageSet,
    MediaDetails,
    RankedMediaItem,
    MediaPerson,
    PersonDetails,
    PersonMovieCredit,
    PersonMovieCredits,
    PersonShowCredit,
    PersonShowCredits,
    MediaSearchResult,
    MediaSeason,
} from "@/lib/media";

const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p";
const TMDB_CACHE_SECONDS = 6 * 60 * 60;

const MOVIE_GENRES: Record<number, string> = {
    12: "Adventure",
    14: "Fantasy",
    16: "Animation",
    18: "Drama",
    27: "Horror",
    28: "Action",
    35: "Comedy",
    36: "History",
    37: "Western",
    53: "Thriller",
    80: "Crime",
    99: "Documentary",
    878: "Science Fiction",
    9648: "Mystery",
    10402: "Music",
    10749: "Romance",
    10751: "Family",
    10752: "War",
    10770: "TV Movie",
};

const TV_GENRES: Record<number, string> = {
    16: "Animation",
    18: "Drama",
    35: "Comedy",
    37: "Western",
    80: "Crime",
    99: "Documentary",
    9648: "Mystery",
    10751: "Family",
    10759: "Action & Adventure",
    10762: "Kids",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics",
};

interface TmdbMedia {
    id: number;
    media_type?: "movie" | "tv" | "person";
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    overview?: string;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    genre_ids?: number[];
    genres?: Array<{ id: number; name: string }>;
    runtime?: number | null;
    episode_run_time?: number[];
    original_language?: string;
    origin_country?: string[];
    production_countries?: Array<{ iso_3166_1: string }>;
    homepage?: string;
    status?: string;
    number_of_episodes?: number;
    imdb_id?: string | null;
    external_ids?: { imdb_id?: string | null; tvdb_id?: number | null };
    videos?: { results?: Array<{ key: string; site: string; type: string; official?: boolean }> };
    release_dates?: {
        results?: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string; type: number }> }>;
    };
    content_ratings?: { results?: Array<{ iso_3166_1: string; rating: string }> };
    seasons?: TmdbSeason[];
}

interface TmdbSeason {
    id: number;
    season_number: number;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    air_date?: string | null;
    episode_count?: number;
    vote_average?: number;
}

interface TmdbEpisode {
    id: number;
    season_number: number;
    episode_number: number;
    name: string;
    overview?: string;
    air_date?: string | null;
    still_path?: string | null;
    runtime?: number | null;
    vote_average?: number;
    vote_count?: number;
    episode_type?: string;
}

interface TmdbPerson {
    id: number;
    name: string;
    profile_path?: string | null;
    biography?: string;
    birthday?: string | null;
    deathday?: string | null;
    place_of_birth?: string | null;
    homepage?: string | null;
    gender?: number;
    known_for_department?: string;
    imdb_id?: string;
    external_ids?: {
        imdb_id?: string;
        twitter_id?: string;
        facebook_id?: string;
        instagram_id?: string;
        wikidata_id?: string;
    };
}

type TmdbCredit = TmdbMedia &
    TmdbPerson & {
        character?: string;
        job?: string;
        department?: string;
        roles?: Array<{ character: string; episode_count: number }>;
        jobs?: Array<{ job: string; episode_count: number }>;
        total_episode_count?: number;
        episode_count?: number;
    };

interface TmdbCredential {
    token?: string;
    apiKey?: string;
}

class TmdbRequestError extends Error {
    constructor(
        message: string,
        public status: number
    ) {
        super(message);
    }
}

function image(path?: string | null, size = "original"): string[] {
    return path ? [`${TMDB_IMAGE_URL}/${size}${path}`] : [];
}

function mediaImages(item: TmdbMedia): MediaImageSet {
    return {
        poster: image(item.poster_path, "w500"),
        fanart: image(item.backdrop_path, "w1280"),
        banner: image(item.backdrop_path, "w1280"),
        thumb: image(item.backdrop_path, "w500"),
        logo: [],
        clearart: [],
        headshot: [],
        screenshot: [],
    };
}

function certification(item: TmdbMedia, type: "movie" | "show"): string | undefined {
    if (type === "movie") {
        const releases = item.release_dates?.results?.find((result) => result.iso_3166_1 === "US")?.release_dates;
        return releases?.find((release) => release.certification)?.certification || undefined;
    }
    return item.content_ratings?.results?.find((result) => result.iso_3166_1 === "US")?.rating || undefined;
}

function normalizeMedia(item: TmdbMedia, type: "movie" | "show"): MediaDetails {
    const date = type === "movie" ? item.release_date : item.first_air_date;
    const externalIds = item.external_ids;
    const genreMap = type === "movie" ? MOVIE_GENRES : TV_GENRES;
    const genres = item.genres?.map((genre) => genre.name) ?? item.genre_ids?.map((id) => genreMap[id]).filter(Boolean);
    const trailer = item.videos?.results?.find(
        (video) => video.site === "YouTube" && video.type === "Trailer" && video.official
    );
    const fallbackTrailer = item.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer");

    return {
        title: item.title || item.name || "Untitled",
        year: date ? Number.parseInt(date.slice(0, 4), 10) : 0,
        ids: {
            slug: String(item.id),
            tmdb: item.id,
            imdb: item.imdb_id || externalIds?.imdb_id || undefined,
            tvdb: externalIds?.tvdb_id || undefined,
        },
        images: mediaImages(item),
        rating: item.vote_average,
        votes: item.vote_count,
        genres,
        overview: item.overview,
        runtime: item.runtime || item.episode_run_time?.[0] || undefined,
        language: item.original_language,
        country: item.production_countries?.[0]?.iso_3166_1 || item.origin_country?.[0],
        trailer:
            trailer || fallbackTrailer
                ? `https://www.youtube.com/watch?v=${(trailer || fallbackTrailer)?.key}`
                : undefined,
        homepage: item.homepage || undefined,
        status: item.status,
        aired_episodes: item.number_of_episodes,
        certification: certification(item, type),
    };
}

function normalizePerson(person: TmdbPerson): MediaPerson {
    return {
        name: person.name,
        ids: {
            slug: String(person.id),
            tmdb: person.id,
            imdb: person.imdb_id || person.external_ids?.imdb_id,
        },
        images: { headshot: image(person.profile_path, "w342"), fanart: [] },
    };
}

function normalizePersonFull(person: TmdbPerson): PersonDetails {
    return {
        ...normalizePerson(person),
        social_ids: {
            twitter: person.external_ids?.twitter_id,
            facebook: person.external_ids?.facebook_id,
            instagram: person.external_ids?.instagram_id,
            wikipedia: person.external_ids?.wikidata_id,
        },
        biography: person.biography,
        birthday: person.birthday || undefined,
        death: person.deathday || undefined,
        birthplace: person.place_of_birth || undefined,
        homepage: person.homepage || undefined,
        gender: person.gender === 1 ? "female" : person.gender === 2 ? "male" : undefined,
        known_for_department: person.known_for_department,
    };
}

function storedCredential(value: unknown): TmdbCredential | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const credential = value.trim();
    return credential.startsWith("eyJ") || credential.length > 64 ? { token: credential } : { apiKey: credential };
}

async function getCredential(userId: string): Promise<TmdbCredential | null> {
    const token = process.env.TMDB_API_READ_TOKEN?.trim();
    if (token) return { token };
    const apiKey = process.env.TMDB_API_KEY?.trim();
    if (apiKey) return { apiKey };

    const result = await db
        .select({ settings: userSettings.settings })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
    const settings = result[0]?.settings as { tmdb_api_key?: unknown } | undefined;
    return storedCredential(settings?.tmdb_api_key);
}

async function tmdb<T>(endpoint: string, credential: TmdbCredential, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${TMDB_API_URL}${endpoint}`);
    url.searchParams.set("language", "en-US");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (credential.apiKey) url.searchParams.set("api_key", credential.apiKey);

    const response = await fetch(url, {
        next: { revalidate: TMDB_CACHE_SECONDS },
        headers: {
            accept: "application/json",
            ...(credential.token ? { Authorization: `Bearer ${credential.token}` } : {}),
        },
    });
    const data = (await response.json().catch(() => null)) as { status_message?: string } | null;
    if (!response.ok) {
        throw new TmdbRequestError(data?.status_message || `TMDB request failed (${response.status})`, response.status);
    }
    return data as T;
}

async function resolveMediaId(id: string, type: "movie" | "show", credential: TmdbCredential): Promise<number> {
    if (/^\d+$/.test(id)) return Number(id);
    const result = await tmdb<{ movie_results: TmdbMedia[]; tv_results: TmdbMedia[] }>(
        `/find/${encodeURIComponent(id)}`,
        credential,
        {
            external_source: id.startsWith("tt") ? "imdb_id" : "tvdb_id",
        }
    );
    const media = type === "movie" ? result.movie_results[0] : result.tv_results[0];
    if (!media) throw new TmdbRequestError("Title not found", 404);
    return media.id;
}

async function mediaDetails(id: string, type: "movie" | "show", credential: TmdbCredential): Promise<MediaDetails> {
    const tmdbId = await resolveMediaId(id, type, credential);
    const append = type === "movie" ? "external_ids,videos,release_dates" : "external_ids,videos,content_ratings";
    const item = await tmdb<TmdbMedia>(`/${type === "movie" ? "movie" : "tv"}/${tmdbId}`, credential, {
        append_to_response: append,
    });
    return normalizeMedia(item, type);
}

async function mediaList(
    endpoint: string,
    type: "movie" | "show",
    limit: number,
    credential: TmdbCredential
): Promise<RankedMediaItem[]> {
    const response = await tmdb<{ results: TmdbMedia[] }>(endpoint, credential);
    return response.results.slice(0, limit).map((item) => ({ [type]: normalizeMedia(item, type) }));
}

function crewDepartment(department?: string): keyof MediaCrew {
    const normalized = department?.toLowerCase();
    if (normalized === "costume & make-up") return "costume & make-up";
    if (normalized === "visual effects") return "crew";
    if (normalized && ["production", "art", "crew", "directing", "writing", "sound", "camera"].includes(normalized)) {
        return normalized as keyof MediaCrew;
    }
    return "crew";
}

async function mediaPeople(id: string, type: "movie" | "show", credential: TmdbCredential): Promise<CastAndCrew> {
    const tmdbId = await resolveMediaId(id, type, credential);
    const endpoint = type === "movie" ? `/movie/${tmdbId}/credits` : `/tv/${tmdbId}/aggregate_credits`;
    const response = await tmdb<{ cast: TmdbCredit[]; crew: TmdbCredit[] }>(endpoint, credential);
    const crew: MediaCrew = {};

    for (const member of response.crew) {
        const department = crewDepartment(member.department);
        const jobs = member.jobs?.map((job) => job.job) || (member.job ? [member.job] : []);
        const members = crew[department] ?? [];
        members.push({ jobs, person: normalizePerson(member) });
        crew[department] = members;
    }

    return {
        cast: response.cast.map((member) => ({
            characters: member.roles?.map((role) => role.character) || (member.character ? [member.character] : []),
            person: normalizePerson(member),
            episode_count: member.total_episode_count,
        })),
        crew,
    };
}

function groupMovieCrew(credits: TmdbCredit[]): NonNullable<PersonMovieCredits["crew"]> {
    const crew: Record<string, PersonMovieCredit[]> = {};
    for (const credit of credits) {
        const department = crewDepartment(credit.department);
        const departmentCredits = crew[department] ?? [];
        departmentCredits.push({ jobs: credit.job ? [credit.job] : [], movie: normalizeMedia(credit, "movie") });
        crew[department] = departmentCredits;
    }
    return crew as NonNullable<PersonMovieCredits["crew"]>;
}

function groupShowCrew(credits: TmdbCredit[]): NonNullable<PersonShowCredits["crew"]> {
    const crew: Record<string, PersonShowCredit[]> = {};
    for (const credit of credits) {
        const department = crewDepartment(credit.department);
        const departmentCredits = crew[department] ?? [];
        departmentCredits.push({
            jobs: credit.job ? [credit.job] : [],
            show: normalizeMedia(credit, "show"),
            episode_count: credit.episode_count,
        });
        crew[department] = departmentCredits;
    }
    return crew as NonNullable<PersonShowCredits["crew"]>;
}

async function personCredits(
    id: string,
    type: "movie" | "show",
    credential: TmdbCredential
): Promise<PersonMovieCredits | PersonShowCredits> {
    const tmdbId = Number(id);
    if (!Number.isFinite(tmdbId)) throw new TmdbRequestError("Person not found", 404);
    const namespace = type === "movie" ? "movie_credits" : "tv_credits";
    const response = await tmdb<{ cast: TmdbCredit[]; crew: TmdbCredit[] }>(
        `/person/${tmdbId}/${namespace}`,
        credential
    );

    if (type === "movie") {
        return {
            cast: response.cast.map((credit) => ({
                characters: credit.character ? [credit.character] : [],
                movie: normalizeMedia(credit, "movie"),
            })),
            crew: groupMovieCrew(response.crew),
        };
    }
    return {
        cast: response.cast.map((credit) => ({
            characters: credit.character ? [credit.character] : [],
            show: normalizeMedia(credit, "show"),
            episode_count: credit.episode_count,
        })),
        crew: groupShowCrew(response.crew),
    };
}

async function handleSearch(path: string[], request: NextRequest, credential: TmdbCredential) {
    if (path.length === 2) {
        const query = request.nextUrl.searchParams.get("query") || "";
        const response = await tmdb<{ results: TmdbMedia[] }>("/search/multi", credential, {
            query,
            include_adult: "false",
        });
        return response.results
            .filter((item) => item.media_type === "movie" || item.media_type === "tv")
            .map(
                (item): MediaSearchResult => ({
                    type: item.media_type === "movie" ? "movie" : "show",
                    score: item.popularity || 0,
                    ...(item.media_type === "movie"
                        ? { movie: normalizeMedia(item, "movie") }
                        : { show: normalizeMedia(item, "show") }),
                })
            );
    }

    const [, idType, id] = path;
    if (!id) return [];
    if (idType === "tmdb" && /^\d+$/.test(id)) {
        const results: MediaSearchResult[] = [];
        for (const type of ["movie", "show"] as const) {
            try {
                const media = await mediaDetails(id, type, credential);
                results.push({ type, score: 1, ...(type === "movie" ? { movie: media } : { show: media }) });
            } catch (error) {
                if (!(error instanceof TmdbRequestError) || error.status !== 404) throw error;
            }
        }
        return results;
    }

    const externalSource = idType === "tvdb" ? "tvdb_id" : "imdb_id";
    const response = await tmdb<{ movie_results: TmdbMedia[]; tv_results: TmdbMedia[] }>(
        `/find/${encodeURIComponent(id)}`,
        credential,
        {
            external_source: externalSource,
        }
    );
    return [
        ...response.movie_results.map(
            (item): MediaSearchResult => ({ type: "movie", score: 1, movie: normalizeMedia(item, "movie") })
        ),
        ...response.tv_results.map(
            (item): MediaSearchResult => ({ type: "show", score: 1, show: normalizeMedia(item, "show") })
        ),
    ];
}

async function handleMovies(path: string[], request: NextRequest, credential: TmdbCredential) {
    const [, id, subresource] = path;
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 20;
    const lists: Record<string, string> = {
        trending: "/trending/movie/week",
        popular: "/movie/popular",
        watched: "/movie/top_rated",
        anticipated: "/movie/upcoming",
        boxoffice: "/movie/now_playing",
    };
    if (lists[id]) return mediaList(lists[id], "movie", limit, credential);
    if (subresource === "people") return mediaPeople(id, "movie", credential);
    return mediaDetails(id, "movie", credential);
}

async function handleShows(path: string[], request: NextRequest, credential: TmdbCredential) {
    const [, id, subresource, season, tail] = path;
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 20;
    const lists: Record<string, string> = {
        trending: "/trending/tv/week",
        popular: "/tv/popular",
        watched: "/tv/top_rated",
        anticipated: "/tv/on_the_air",
    };
    if (lists[id]) return mediaList(lists[id], "show", limit, credential);
    if (subresource === "people") return mediaPeople(id, "show", credential);

    const tmdbId = await resolveMediaId(id, "show", credential);
    if (subresource === "seasons" && season && tail === "episodes") {
        const result = await tmdb<{ episodes: TmdbEpisode[] }>(`/tv/${tmdbId}/season/${season}`, credential);
        return result.episodes.map(
            (episode): MediaEpisode => ({
                season: episode.season_number,
                number: episode.episode_number,
                title: episode.name,
                ids: { slug: String(episode.id), tmdb: episode.id },
                images: {
                    ...mediaImages({ id: episode.id, backdrop_path: episode.still_path }),
                    screenshot: image(episode.still_path, "w500"),
                },
                overview: episode.overview,
                first_aired: episode.air_date || undefined,
                runtime: episode.runtime || undefined,
                rating: episode.vote_average,
                votes: episode.vote_count,
                episode_type: episode.episode_type,
            })
        );
    }
    if (subresource === "seasons") {
        const show = await tmdb<TmdbMedia>(`/tv/${tmdbId}`, credential);
        return (show.seasons || []).map(
            (item): MediaSeason => ({
                number: item.season_number,
                ids: { slug: String(item.id), tmdb: item.id },
                images: { ...mediaImages({ id: item.id, poster_path: item.poster_path }) },
                title: item.name,
                overview: item.overview,
                rating: item.vote_average,
                episode_count: item.episode_count,
                aired_episodes: item.episode_count,
                first_aired: item.air_date || undefined,
            })
        );
    }
    return mediaDetails(String(tmdbId), "show", credential);
}

async function handlePeople(path: string[], credential: TmdbCredential) {
    const [, id, creditsType] = path;
    if (creditsType === "movies") return personCredits(id, "movie", credential);
    if (creditsType === "shows") return personCredits(id, "show", credential);
    const person = await tmdb<TmdbPerson>(`/person/${id}`, credential, { append_to_response: "external_ids" });
    return normalizePersonFull(person);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const credential = await getCredential(session.user.id);
    if (!credential) {
        return NextResponse.json(
            { error: "TMDB is not configured. Add an API key or API Read Access Token in Settings." },
            { status: 503 }
        );
    }

    const { path } = await params;
    try {
        if (path[0] === "raw") {
            const forwardedParams = Object.fromEntries(
                [...request.nextUrl.searchParams.entries()].filter(([key]) => key !== "api_key")
            );
            const data = await tmdb(`/${path.slice(1).map(encodeURIComponent).join("/")}`, credential, forwardedParams);
            return NextResponse.json(data);
        }

        let data: unknown;
        if (path[0] === "search") data = await handleSearch(path, request, credential);
        else if (path[0] === "movies") data = await handleMovies(path, request, credential);
        else if (path[0] === "shows") data = await handleShows(path, request, credential);
        else if (path[0] === "people") data = await handlePeople(path, credential);
        else throw new TmdbRequestError("Unsupported TMDB request", 404);

        return NextResponse.json(data);
    } catch (error) {
        if (error instanceof TmdbRequestError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: `Unable to reach TMDB: ${message}` }, { status: 502 });
    }
}
