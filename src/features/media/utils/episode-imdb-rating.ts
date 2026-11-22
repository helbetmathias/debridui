import type { MediaEpisode } from "@/lib/media";
import type { OmdbEpisodeRating } from "@/lib/omdb";

export type DisplayEpisode = MediaEpisode & { originalEpisode?: { season: number; number: number } };

export function getOriginalEpisode(episode: DisplayEpisode) {
    return episode.originalEpisode ?? episode;
}

function normalizeTitle(title: string) {
    return title
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");
}

export function matchEpisodeImdbRating(episode: DisplayEpisode, scores?: OmdbEpisodeRating[]) {
    const { number } = getOriginalEpisode(episode);
    const candidates = scores?.filter((score) => score.number === number);
    if (candidates?.length !== 1) return;
    const [candidate] = candidates;
    if (episode.ids.imdb) return episode.ids.imdb === candidate.imdbId ? candidate : undefined;
    const title = normalizeTitle(episode.title);
    if (!title || /^(episode|chapter|tba|tbd)\d*$/.test(title) || title !== normalizeTitle(candidate.title)) return;
    const aired = episode.first_aired?.slice(0, 10);
    if (aired && candidate.released && aired !== candidate.released) return;
    return candidate;
}
