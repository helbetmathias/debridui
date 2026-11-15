"use client";

import { Calendar, ChevronDown, ChevronUp, MapPin, Skull, User } from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PersonDetails } from "@/lib/media";
import { resolveImageUrl } from "@/lib/media/images";
import { calculateAge, formatLocalizedDate } from "@/lib/utils";

// Person Header Component
export const PersonHeader = memo(function PersonHeader({
    person,
    isLoading,
}: {
    person?: PersonDetails;
    isLoading: boolean;
}) {
    const [bioExpanded, setBioExpanded] = useState(false);

    if (isLoading) {
        return (
            <div className="relative">
                {/* Backdrop skeleton */}
                <div className="absolute inset-0 left-1/2 -translate-x-1/2 w-screen overflow-hidden -mt-6">
                    <Skeleton className="w-full h-full rounded-none" />
                </div>
                {/* Content */}
                <div className="relative pt-[12vh] sm:pt-[20vh] md:pt-[30vh] pb-8">
                    <div className="grid md:grid-cols-[180px_1fr] lg:grid-cols-[240px_1fr] gap-6 md:gap-8">
                        {/* Headshot skeleton */}
                        <div className="space-y-4">
                            <Skeleton className="max-md:max-w-[45vw] aspect-2/3 rounded-sm" />
                        </div>
                        {/* Info skeleton */}
                        <div className="space-y-6">
                            {/* Department label */}
                            <div className="space-y-3">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-10 sm:h-12 w-3/4" />
                            </div>
                            {/* Metadata line */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-40" />
                            </div>
                            {/* Biography */}
                            <div className="space-y-2 max-w-2xl">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                            {/* External links */}
                            <div className="flex flex-wrap items-center gap-5 pt-2">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!person) return null;

    const headshotUrl = person.images?.headshot?.[0] ? resolveImageUrl(person.images.headshot[0]) : null;

    const fanartUrl = person.images?.fanart?.[0] ? resolveImageUrl(person.images.fanart[0]) : null;

    const age = calculateAge(person.birthday, person.death);
    const biographyLines = person.biography?.split("\n").filter(Boolean) || [];
    const shouldTruncate = biographyLines.length > 3 || (person.biography?.length || 0) > 400;
    const displayBio = bioExpanded ? person.biography : person.biography?.slice(0, 400);

    return (
        <div className="relative">
            {/* Backdrop - Image or Gradient Fallback */}
            {fanartUrl ? (
                <>
                    <div className="absolute inset-0 left-1/2 -translate-x-1/2 w-screen overflow-hidden -mt-6">
                        <img
                            src={fanartUrl}
                            alt=""
                            className="w-full h-full object-cover opacity-30"
                            loading="eager"
                            decoding="async"
                        />
                    </div>
                    <div className="absolute inset-0 left-1/2 -translate-x-1/2 w-screen bg-linear-to-t from-background via-background/60 to-transparent -mt-6" />
                    <div className="absolute inset-0 left-1/2 -translate-x-1/2 w-screen bg-linear-to-r from-background/80 via-transparent to-background/80 -mt-6" />
                </>
            ) : headshotUrl ? (
                <>
                    <div className="absolute inset-0 left-1/2 -translate-x-1/2 w-screen overflow-hidden -mt-6">
                        <img
                            src={headshotUrl}
                            alt=""
                            className="w-full h-full object-cover opacity-30 blur-2xl scale-110"
                            loading="eager"
                            decoding="async"
                        />
                    </div>
                    <div className="absolute inset-0 left-1/2 -translate-x-1/2 w-screen bg-linear-to-t from-background via-background/70 to-background/40 -mt-6" />
                    <div className="absolute inset-0 left-1/2 -translate-x-1/2 w-screen bg-linear-to-r from-background/70 via-transparent to-background/70 -mt-6" />
                </>
            ) : null}

            {/* Content */}
            <div className={fanartUrl || headshotUrl ? "relative pt-[12vh] sm:pt-[20vh] md:pt-[30vh] pb-8" : "pb-8"}>
                <div className="grid md:grid-cols-[180px_1fr] lg:grid-cols-[240px_1fr] gap-6 md:gap-8">
                    {/* Headshot Column */}
                    <div className="space-y-4">
                        <div className="max-md:max-w-[45vw] aspect-2/3 overflow-hidden rounded-sm bg-muted/50">
                            {headshotUrl ? (
                                <img
                                    src={headshotUrl}
                                    alt={person.name}
                                    className="w-full h-full object-cover"
                                    loading="eager"
                                    decoding="async"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted/30">
                                    <User className="size-16 text-muted-foreground/50" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info Column */}
                    <div className="space-y-6">
                        {/* Name & Department */}
                        <div className="space-y-3">
                            <div className="text-xs tracking-widest uppercase text-muted-foreground">
                                {person.known_for_department || "Person"}
                            </div>
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light leading-tight">{person.name}</h1>
                        </div>

                        {/* Metadata Line */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            {person.birthday && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="size-4 text-primary/70" />
                                    <span>{formatLocalizedDate(person.birthday)}</span>
                                    {age && !person.death && (
                                        <span className="text-foreground/60">({age} years old)</span>
                                    )}
                                </span>
                            )}
                            {person.birthplace && (
                                <>
                                    <span className="text-border">·</span>
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="size-4 text-primary/70" />
                                        <span>{person.birthplace}</span>
                                    </span>
                                </>
                            )}
                            {person.death && (
                                <>
                                    <span className="text-border">·</span>
                                    <span className="flex items-center gap-1.5">
                                        <Skull className="size-4 text-muted-foreground/70" />
                                        <span>{formatLocalizedDate(person.death)}</span>
                                        {age && <span className="text-foreground/60">(aged {age})</span>}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Biography */}
                        {person.biography && (
                            <div className="space-y-2">
                                <p className="text-sm sm:text-base text-foreground/80 leading-relaxed max-w-2xl whitespace-pre-line">
                                    {displayBio}
                                    {shouldTruncate && !bioExpanded && "..."}
                                </p>
                                {shouldTruncate && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setBioExpanded(!bioExpanded)}
                                        className="text-muted-foreground hover:text-foreground -ml-2">
                                        {bioExpanded ? (
                                            <>
                                                Show less <ChevronUp className="size-4 ml-1" />
                                            </>
                                        ) : (
                                            <>
                                                Read more <ChevronDown className="size-4 ml-1" />
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* External Links */}
                        <div className="flex flex-wrap items-center gap-5 pt-2">
                            {person.ids?.imdb && (
                                <Link
                                    href={`https://www.imdb.com/name/${person.ids.imdb}`}
                                    target="_blank"
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/imdb.svg"
                                        alt=""
                                        className="size-4 opacity-60 dark:invert"
                                    />
                                    IMDb
                                </Link>
                            )}
                            {person.ids?.tmdb && (
                                <Link
                                    href={`https://www.themoviedb.org/person/${person.ids.tmdb}`}
                                    target="_blank"
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/themoviedatabase.svg"
                                        alt=""
                                        className="size-4 opacity-60 dark:invert"
                                    />
                                    TMDB
                                </Link>
                            )}
                            {person.social_ids?.twitter && (
                                <Link
                                    href={`https://twitter.com/${person.social_ids.twitter}`}
                                    target="_blank"
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/x.svg"
                                        alt=""
                                        className="size-4 opacity-60 dark:invert"
                                    />
                                    Twitter
                                </Link>
                            )}
                            {person.social_ids?.instagram && (
                                <Link
                                    href={`https://instagram.com/${person.social_ids.instagram}`}
                                    target="_blank"
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/instagram.svg"
                                        alt=""
                                        className="size-4 opacity-60 dark:invert"
                                    />
                                    Instagram
                                </Link>
                            )}
                            {person.social_ids?.facebook && (
                                <Link
                                    href={`https://facebook.com/${person.social_ids.facebook}`}
                                    target="_blank"
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/facebook.svg"
                                        alt=""
                                        className="size-4 opacity-60 dark:invert"
                                    />
                                    Facebook
                                </Link>
                            )}
                            {person.social_ids?.wikipedia && (
                                <Link
                                    href={`https://en.wikipedia.org/wiki/${person.social_ids.wikipedia}`}
                                    target="_blank"
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <img
                                        src="https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/wikipedia.svg"
                                        alt=""
                                        className="size-4 opacity-60 dark:invert"
                                    />
                                    Wikipedia
                                </Link>
                            )}
                            {person.homepage && (
                                <Link
                                    href={person.homepage}
                                    target="_blank"
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <span className="size-4 flex items-center justify-center text-xs">🌐</span>
                                    Website
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
