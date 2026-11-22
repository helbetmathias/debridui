"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import type { useSimklPlayback } from "@/features/media/hooks/use-simkl";
import {
    parseHiddenPlaybacks,
    playbackVisibilityKey,
    readHiddenPlaybacks,
    setPlaybackHidden,
    subscribeHiddenPlaybacks,
} from "@/features/media/utils/hidden-playbacks";
import type { SimklPlaybackItem } from "@/lib/simkl/types";
import { ContinueWatchingCard } from "./continue-watching-card";

export function ContinueWatching({
    playback,
    userId,
}: {
    playback: ReturnType<typeof useSimklPlayback>;
    userId: string;
}) {
    const { data, isFetched, isFetching, error, refetch } = playback;
    const hiddenSnapshot = useSyncExternalStore(
        subscribeHiddenPlaybacks,
        () => readHiddenPlaybacks(userId),
        () => ""
    );
    if (!error && !data?.connected && !data?.reconnectRequired) return null;
    const hidden = new Set(parseHiddenPlaybacks(hiddenSnapshot));
    const visibleItems = data?.items.filter((item) => !hidden.has(playbackVisibilityKey(item))) ?? [];

    function hide(item: SimklPlaybackItem) {
        try {
            setPlaybackHidden(userId, item, true);
            toast.success("Hidden from Continue Watching", {
                duration: 7_000,
                action: {
                    label: "Undo",
                    onClick: () => {
                        try {
                            setPlaybackHidden(userId, item, false);
                        } catch {
                            toast.error("Could not restore this card");
                        }
                    },
                },
            });
        } catch {
            toast.error("Could not hide this card");
        }
    }

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
            {data?.reconnectRequired ? (
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
            ) : visibleItems.length ? (
                <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                    <CarouselContent className="-ml-3">
                        {visibleItems.map((item) => (
                            <CarouselItem key={item.id} className="pl-3 basis-[208px] sm:basis-[280px]">
                                <ContinueWatchingCard item={item} onHide={() => hide(item)} />
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-1 top-[58px] sm:top-[75px] size-9 bg-background/90 disabled:hidden after:absolute after:-inset-1 sm:after:hidden" />
                    <CarouselNext className="right-1 top-[58px] sm:top-[75px] size-9 bg-background/90 disabled:hidden after:absolute after:-inset-1 sm:after:hidden" />
                </Carousel>
            ) : (
                <p className="min-h-10 sm:min-h-5 text-sm text-muted-foreground">
                    {data?.stale || error
                        ? "SIMKL is temporarily unavailable. Try again shortly."
                        : data?.items.length
                          ? "No visible playbacks."
                          : !data?.syncedAt && !isFetched
                            ? "Checking SIMKL progress…"
                            : "No saved playback yet. Pause or stop a title in your connected scrobbler to see it here."}
                </p>
            )}
            {visibleItems.length > 0 && (data?.stale || error) && (
                <p className="text-xs text-muted-foreground" role="status">
                    Could not refresh SIMKL; showing saved progress.
                </p>
            )}
        </section>
    );
}
