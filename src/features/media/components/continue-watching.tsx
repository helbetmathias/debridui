"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { useSimklPlayback } from "@/features/media/hooks/use-simkl";
import { ContinueWatchingCard } from "./continue-watching-card";

export function ContinueWatching() {
    const { data, isLoading, isFetching, error, refetch } = useSimklPlayback();
    if (!isLoading && !error && !data?.connected && !data?.reconnectRequired) return null;
    return (
        <section aria-labelledby="continue-watching-heading" className="pt-4 sm:pt-6 space-y-3 sm:space-y-4">
            <div className="flex min-h-11 sm:min-h-9 items-center justify-between gap-3">
                <h2 id="continue-watching-heading" className="text-xs sm:text-sm tracking-widest uppercase">
                    Continue Watching
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">SIMKL</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative after:absolute after:-inset-1 sm:after:hidden"
                        aria-label="Refresh Continue Watching"
                        disabled={isFetching}
                        onClick={() => refetch()}>
                        <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>
            {isLoading ? (
                <div className="flex gap-3 overflow-hidden">
                    <p className="sr-only" role="status">
                        Loading saved progress
                    </p>
                    <Skeleton className="h-52 w-52 sm:h-72 sm:w-68 shrink-0" />
                    <Skeleton className="h-52 w-52 sm:h-72 sm:w-68 shrink-0" />
                </div>
            ) : data?.reconnectRequired ? (
                <p className="text-sm text-muted-foreground">
                    Reconnect SIMKL in{" "}
                    <Link href="/settings#simkl" className="text-primary underline">
                        Settings
                    </Link>{" "}
                    to read your progress.
                </p>
            ) : error && !data ? (
                <p className="text-sm text-muted-foreground" role="status">
                    Could not load SIMKL progress. Use refresh to try again.
                </p>
            ) : data?.items.length ? (
                <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                    <CarouselContent className="-ml-3">
                        {data.items.map((item) => (
                            <CarouselItem key={item.id} className="pl-3 basis-[208px] sm:basis-[280px]">
                                <ContinueWatchingCard item={item} />
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-1 top-[58px] sm:top-[75px] size-9 bg-background/90 disabled:hidden after:absolute after:-inset-1 sm:after:hidden" />
                    <CarouselNext className="right-1 top-[58px] sm:top-[75px] size-9 bg-background/90 disabled:hidden after:absolute after:-inset-1 sm:after:hidden" />
                </Carousel>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {data?.stale
                        ? "SIMKL is temporarily unavailable. Try again shortly."
                        : "No saved playback yet. Pause or stop a title in your connected scrobbler to see it here."}
                </p>
            )}
            {(data?.items.length ?? 0) > 0 && (data?.stale || error) && (
                <p className="text-xs text-muted-foreground" role="status">
                    Could not refresh SIMKL; showing saved progress.
                </p>
            )}
        </section>
    );
}
