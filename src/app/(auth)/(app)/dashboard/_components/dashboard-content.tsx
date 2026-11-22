"use client";

import { ContinueWatching } from "@/features/media/components/continue-watching";
import { HeroCarousel } from "@/features/media/components/hero-carousel";
import { MediaFooter } from "@/features/media/components/media-footer";
import { type SimklPlaybackStartup, useSimklPlayback } from "@/features/media/hooks/use-simkl";
import { AddonCatalogs } from "./addon-catalogs";

export function DashboardContent({ startup }: { startup: SimklPlaybackStartup }) {
    const playback = useSimklPlayback(startup);

    return (
        <div className="pb-12">
            <HeroCarousel autoFocus compact={startup.savedPlayback?.connected ?? false} />
            <div className="lg:px-6 space-y-8 md:space-y-12">
                <ContinueWatching playback={playback} userId={startup.userId} />
                <AddonCatalogs />
                <MediaFooter className="pt-10 border-t border-border/50" />
            </div>
        </div>
    );
}
