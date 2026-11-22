"use client";

import { useQuery } from "@tanstack/react-query";
import { Ellipsis, EyeOff, Film, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mediaClient } from "@/lib/media";
import { getBackdropUrl } from "@/lib/media/images";
import type { SimklPlaybackItem } from "@/lib/simkl/types";
import { WatchButton } from "./watch-button";

export function ContinueWatchingCard({ item, onHide }: { item: SimklPlaybackItem; onHide: () => void }) {
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
        : "";
    // Movie runtime is approximate; a show's overall runtime is not an episode runtime.
    const remaining =
        item.type === "movie" && detail?.runtime ? Math.ceil((detail.runtime * (100 - item.progress)) / 100) : null;
    const detailHref = id
        ? `/${item.type}s/${id}${episode ? `?season=${episode.season}#episode-${episode.number}` : ""}`
        : null;
    const progressLabel = `${Math.round(item.progress)}%`;
    const canResume = !!imdbId && item.episodeMapped !== false;
    const request = {
        imdbId: imdbId ?? "",
        type: item.type,
        media,
        resume: true,
        ...(episode ? { tvParams: { season: episode.season, episode: episode.number, title: episode.title } } : {}),
    };
    const image = (
        <div className="relative aspect-video bg-muted/30 overflow-hidden">
            {art ? (
                <img
                    src={art}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover motion-safe:transition-transform duration-300 group-hover/watch-card:motion-safe:scale-105"
                />
            ) : (
                <Film className="absolute inset-0 m-auto size-8 text-muted-foreground" />
            )}
            {episode && (
                <span className="absolute bottom-2 left-2 rounded-sm bg-background/85 px-2 py-1 text-xs tabular-nums">
                    {episodeLabel}
                </span>
            )}
        </div>
    );
    return (
        <article className="group/watch-card overflow-hidden rounded-sm border border-border/50 bg-muted/10">
            <div className="relative">
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
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Options for ${item.title}`}
                            className="absolute right-2 top-2 rounded-sm border-border/60 bg-background/70 backdrop-blur-md hover:bg-background/85 motion-safe:transition-opacity after:absolute after:-inset-1 [@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover/watch-card:pointer-events-auto group-hover/watch-card:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100">
                            <Ellipsis aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-sm bg-popover/90 backdrop-blur-md">
                        <DropdownMenuItem onSelect={onHide}>
                            <EyeOff aria-hidden="true" />
                            Hide from this row
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                {canResume && (
                    <WatchButton request={request}>
                        <Button
                            size="icon"
                            variant="outline"
                            aria-label={`Resume ${item.title}`}
                            className="sm:hidden absolute bottom-2 right-2 rounded-full bg-background/90 after:absolute after:-inset-1">
                            <Play className="size-4 fill-current" />
                        </Button>
                    </WatchButton>
                )}
            </div>
            <div className="p-2.5 sm:p-3 space-y-2 sm:space-y-2.5">
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
                {canResume ? (
                    <WatchButton request={request}>
                        <Button
                            size="sm"
                            variant="outline"
                            className="hidden sm:flex w-full gap-2"
                            aria-label={`Resume ${item.title}`}>
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
