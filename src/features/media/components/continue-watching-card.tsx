"use client";

import { useQuery } from "@tanstack/react-query";
import { Film, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { mediaClient } from "@/lib/media";
import { getBackdropUrl } from "@/lib/media/images";
import type { SimklPlaybackItem } from "@/lib/simkl/types";
import { WatchButton } from "./watch-button";

export function ContinueWatchingCard({ item }: { item: SimklPlaybackItem }) {
    const id = item.imdbId || item.tmdbId || "";
    const { data: detail } = useQuery({
        queryKey: ["tmdb", "media", id, item.type],
        queryFn: () => (item.type === "movie" ? mediaClient.getMovie(id) : mediaClient.getShow(id)),
        enabled: !!id,
        staleTime: 86400_000,
        retry: false,
    });
    const media = detail ?? { title: item.title, year: item.year, ids: { imdb: item.imdbId } };
    const imdbId = item.imdbId || detail?.ids?.imdb;
    const art = getBackdropUrl(detail?.images);
    const episode = item.episode;
    const episodeLabel = episode
        ? `S${String(episode.season).padStart(2, "0")} E${String(episode.number).padStart(2, "0")}`
        : item.year;
    // Movie runtime is approximate; a show's overall runtime is not an episode runtime.
    const remaining =
        item.type === "movie" && detail?.runtime ? Math.ceil((detail.runtime * (100 - item.progress)) / 100) : null;
    const detailHref = id
        ? `/${item.type}s/${id}${episode ? `?season=${episode.season}#episode-${episode.number}` : ""}`
        : null;
    const progressLabel = `${Math.round(item.progress)}%`;
    const image = (
        <div className="relative aspect-video bg-muted/30 overflow-hidden">
            {art ? (
                <img
                    src={art}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
            ) : (
                <Film className="absolute inset-0 m-auto size-8 text-muted-foreground" />
            )}
            <span className="absolute bottom-2 left-2 rounded-sm bg-background/85 px-2 py-1 text-xs tabular-nums">
                {episodeLabel ?? "Movie"}
            </span>
        </div>
    );
    return (
        <article className="group overflow-hidden rounded-sm border border-border/50 bg-muted/10">
            {detailHref ? (
                <Link
                    href={detailHref}
                    aria-label={`Details for ${item.title}`}
                    className="block focus-visible:outline-2 focus-visible:outline-primary">
                    {image}
                </Link>
            ) : (
                image
            )}
            <div className="p-3 space-y-2.5">
                <div>
                    <h3 className="truncate text-sm font-medium" title={item.title}>
                        {item.title}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground mt-0.5 h-4">
                        {episode?.title || (episode ? "Episode" : (item.year ?? detail?.year ?? "Movie"))}
                    </p>
                </div>
                <progress
                    value={item.progress}
                    max={100}
                    aria-label={`${item.title}: ${progressLabel} watched`}
                    className="block h-1 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                />
                <div className="flex justify-between items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    <span>{progressLabel} watched</span>
                    {remaining !== null && <span>~{remaining} min left</span>}
                </div>
                {imdbId && item.episodeMapped !== false ? (
                    <WatchButton
                        request={{
                            imdbId,
                            type: item.type,
                            media,
                            ...(episode
                                ? {
                                      tvParams: {
                                          season: episode.season,
                                          episode: episode.number,
                                          title: episode.title,
                                      },
                                  }
                                : {}),
                        }}>
                        <Button size="sm" variant="outline" className="w-full gap-2">
                            <Play className="size-3 fill-current" />
                            Resume
                        </Button>
                    </WatchButton>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        {item.episodeMapped === false
                            ? "Episode mapping unavailable; choose the episode from its details."
                            : "No playable IMDb mapping available."}
                    </p>
                )}
            </div>
        </article>
    );
}
