"use client";

import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { memo, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaPersonMovies, useMediaPersonShows } from "@/features/media/hooks/use-media";
import type { MediaDetails, PersonMovieCredit, PersonShowCredit } from "@/lib/media";
import { getPosterUrl } from "@/lib/media/images";

// Credit Card Component - reuses MediaCard pattern
const CreditCard = memo(function CreditCard({
    media,
    type,
    role,
    episodeCount,
}: {
    media: MediaDetails;
    type: "movie" | "show";
    role?: string;
    episodeCount?: number;
}) {
    const slug = media.ids?.slug || media.ids?.imdb;
    const linkHref = slug ? `/${type}s/${slug}` : "#";
    const posterUrl =
        getPosterUrl(media.images) ||
        `https://placehold.co/300x450/1a1a1a/3e3e3e?text=${encodeURIComponent(media.title)}`;

    return (
        <Link href={linkHref} className="block group">
            <div className="relative overflow-hidden transition-transform duration-300 ease-out hover:scale-hover [content-visibility:auto] [contain-intrinsic-size:120px_180px]">
                <div className="aspect-2/3 relative overflow-hidden bg-muted/50 rounded-sm">
                    <Image
                        src={posterUrl}
                        alt={media.title}
                        fill
                        sizes="(max-width: 640px) 120px, (max-width: 768px) 150px, 180px"
                        className="object-cover transition-opacity duration-300"
                        loading="lazy"
                        unoptimized
                    />

                    {/* Type badge */}
                    <span className="absolute top-0 left-0 z-10 text-[10px] font-medium tracking-widest uppercase text-primary bg-black/50 backdrop-blur-md px-2 py-1 rounded-br-sm rounded-tl-sm">
                        {type === "movie" ? "Film" : "Series"}
                    </span>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Content on hover */}
                    <div className="absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <h3 className="font-medium text-sm text-white leading-tight line-clamp-2 mb-1.5">
                            {media.title}
                        </h3>

                        <div className="flex items-center gap-2 text-xs text-white/70">
                            {media.year && <span>{media.year}</span>}
                            {!!media.rating && (
                                <>
                                    <span className="text-white/30">·</span>
                                    <span className="flex items-center gap-1">
                                        <Star className="size-3.5 fill-[#F5C518] text-[#F5C518] -translate-y-px" />
                                        {media.rating.toFixed(1)}
                                    </span>
                                </>
                            )}
                        </div>

                        {role && <p className="text-xs text-white/60 mt-1 line-clamp-1">{role}</p>}
                        {!!episodeCount && (
                            <p className="text-xs text-white/50 mt-0.5">
                                {episodeCount} episode{episodeCount !== 1 ? "s" : ""}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
});

// Credits Grid Component
const CreditsGrid = memo(function CreditsGrid({
    credits,
    isLoading,
}: {
    credits: Array<{
        media: MediaDetails;
        type: "movie" | "show";
        role?: string;
        year?: number;
        episodeCount?: number;
    }>;
    isLoading: boolean;
}) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
                {Array.from({ length: 14 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: position-based key in static placeholder list
                    <Skeleton key={i} className="aspect-2/3 rounded-sm" />
                ))}
            </div>
        );
    }

    if (credits.length === 0) {
        return <p className="text-sm text-muted-foreground py-8 text-center">No credits found</p>;
    }

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {credits.map((credit, index) => (
                <CreditCard
                    key={`${credit.type}-${credit.media.ids?.tmdb || index}`}
                    media={credit.media}
                    type={credit.type}
                    role={credit.role}
                    episodeCount={credit.episodeCount}
                />
            ))}
        </div>
    );
});

// Filmography Tabs Component
export const FilmographyTabs = memo(function FilmographyTabs({ slug }: { slug: string }) {
    const { data: movieCredits, isLoading: moviesLoading } = useMediaPersonMovies(slug);
    const { data: showCredits, isLoading: showsLoading } = useMediaPersonShows(slug);

    const isLoading = moviesLoading || showsLoading;

    // Process and organize credits by department
    const organizedCredits = useMemo(() => {
        const acting: Array<{
            media: MediaDetails;
            type: "movie" | "show";
            role?: string;
            year?: number;
            episodeCount?: number;
        }> = [];
        const directing: typeof acting = [];
        const writing: typeof acting = [];
        const production: typeof acting = [];
        const crew: typeof acting = [];

        // Process movie cast
        movieCredits?.cast?.forEach((credit) => {
            acting.push({
                media: credit.movie,
                type: "movie",
                role: credit.characters?.join(", "),
                year: credit.movie.year,
            });
        });

        // Process show cast
        showCredits?.cast?.forEach((credit) => {
            acting.push({
                media: credit.show,
                type: "show",
                role: credit.characters?.join(", "),
                year: credit.show.year,
                episodeCount: credit.episode_count,
            });
        });

        // Process movie crew
        const processMovieCrew = (crewList: PersonMovieCredit[] | undefined, target: typeof acting) => {
            crewList?.forEach((credit) => {
                target.push({
                    media: credit.movie,
                    type: "movie",
                    role: credit.jobs?.join(", "),
                    year: credit.movie.year,
                });
            });
        };

        // Process show crew
        const processShowCrew = (crewList: PersonShowCredit[] | undefined, target: typeof acting) => {
            crewList?.forEach((credit) => {
                target.push({
                    media: credit.show,
                    type: "show",
                    role: credit.jobs?.join(", "),
                    year: credit.show.year,
                    episodeCount: credit.episode_count,
                });
            });
        };

        // Directing
        processMovieCrew(movieCredits?.crew?.directing, directing);
        processShowCrew(showCredits?.crew?.directing, directing);

        // Writing
        processMovieCrew(movieCredits?.crew?.writing, writing);
        processShowCrew(showCredits?.crew?.writing, writing);

        // Production
        processMovieCrew(movieCredits?.crew?.production, production);
        processShowCrew(showCredits?.crew?.production, production);

        // Other crew (art, sound, camera, etc.)
        const otherCrewDepts = [
            "art",
            "sound",
            "camera",
            "editing",
            "visual effects",
            "costume & make-up",
            "crew",
        ] as const;
        otherCrewDepts.forEach((dept) => {
            processMovieCrew(
                movieCredits?.crew?.[dept as keyof typeof movieCredits.crew] as PersonMovieCredit[] | undefined,
                crew
            );
            processShowCrew(
                showCredits?.crew?.[dept as keyof typeof showCredits.crew] as PersonShowCredit[] | undefined,
                crew
            );
        });

        // Created by (shows only)
        processShowCrew(showCredits?.crew?.["created by"], production);

        // Sort all by year (newest first), dedupe by TMDB id
        const sortAndDedupe = (arr: typeof acting) => {
            const seen = new Set<number>();
            return arr
                .filter((item) => {
                    const id = item.media.ids?.tmdb;
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                })
                .sort((a, b) => (b.year || 0) - (a.year || 0));
        };

        return {
            acting: sortAndDedupe(acting),
            directing: sortAndDedupe(directing),
            writing: sortAndDedupe(writing),
            production: sortAndDedupe(production),
            crew: sortAndDedupe(crew),
        };
    }, [movieCredits, showCredits]);

    // Determine available tabs
    const availableTabs = useMemo(() => {
        const tabs: Array<{ id: string; label: string; count: number }> = [];
        if (organizedCredits.acting.length > 0) {
            tabs.push({ id: "acting", label: "Acting", count: organizedCredits.acting.length });
        }
        if (organizedCredits.directing.length > 0) {
            tabs.push({ id: "directing", label: "Directing", count: organizedCredits.directing.length });
        }
        if (organizedCredits.writing.length > 0) {
            tabs.push({ id: "writing", label: "Writing", count: organizedCredits.writing.length });
        }
        if (organizedCredits.production.length > 0) {
            tabs.push({ id: "production", label: "Production", count: organizedCredits.production.length });
        }
        if (organizedCredits.crew.length > 0) {
            tabs.push({ id: "crew", label: "Crew", count: organizedCredits.crew.length });
        }
        return tabs;
    }, [organizedCredits]);

    const defaultTab = availableTabs[0]?.id || "acting";

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-xs tracking-widest uppercase text-muted-foreground">Filmography</span>
                    <div className="h-px flex-1 bg-border/50" />
                </div>
                <div className="flex gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: position-based key in static placeholder list
                        <Skeleton key={i} className="h-9 w-24 rounded-md" />
                    ))}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
                    {Array.from({ length: 14 }).map((_, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: position-based key in static placeholder list
                        <Skeleton key={i} className="aspect-2/3 rounded-sm" />
                    ))}
                </div>
            </div>
        );
    }

    if (availableTabs.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-xs tracking-widest uppercase text-muted-foreground">Filmography</span>
                    <div className="h-px flex-1 bg-border/50" />
                </div>
                <p className="text-sm text-muted-foreground py-8 text-center">No filmography available</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-xs tracking-widest uppercase text-muted-foreground">Filmography</span>
                <div className="h-px flex-1 bg-border/50" />
            </div>

            <Tabs defaultValue={defaultTab} className="w-full">
                <div className="-mx-4 px-4 overflow-x-auto scrollbar-none md:mx-0 md:px-0 md:overflow-visible">
                    <TabsList variant="line" className="mb-6 w-max md:w-auto">
                        {availableTabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="gap-2 whitespace-nowrap">
                                {tab.label}
                                <span className="text-xs text-muted-foreground/70 tabular-nums">{tab.count}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value="acting">
                    <CreditsGrid credits={organizedCredits.acting} isLoading={false} />
                </TabsContent>
                <TabsContent value="directing">
                    <CreditsGrid credits={organizedCredits.directing} isLoading={false} />
                </TabsContent>
                <TabsContent value="writing">
                    <CreditsGrid credits={organizedCredits.writing} isLoading={false} />
                </TabsContent>
                <TabsContent value="production">
                    <CreditsGrid credits={organizedCredits.production} isLoading={false} />
                </TabsContent>
                <TabsContent value="crew">
                    <CreditsGrid credits={organizedCredits.crew} isLoading={false} />
                </TabsContent>
            </Tabs>
        </div>
    );
});
