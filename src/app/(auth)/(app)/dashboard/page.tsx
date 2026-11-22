"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ContinueWatching } from "@/features/media/components/continue-watching";
import { HeroStartupPlaceholder } from "@/features/media/components/hero-carousel-skeleton";
import { MediaFooter } from "@/features/media/components/media-footer";
import { useSimklPlayback } from "@/features/media/hooks/use-simkl";
import { AddonCatalogs } from "./_components/addon-catalogs";

const HeroCarousel = dynamic(
    () => import("@/features/media/components/hero-carousel").then((m) => ({ default: m.HeroCarousel })),
    { loading: HeroStartupPlaceholder, ssr: false }
);

const HERO_LAYOUT_WAIT_MS = 1500;

export default function DashboardPage() {
    const playback = useSimklPlayback();
    const resolvedCompact = playback.data
        ? playback.data.connected && playback.data.items.length > 0
        : playback.isError
          ? false
          : null;
    const [compact, setCompact] = useState(resolvedCompact);

    // Keep the first layout for this visit; background refreshes must not resize the banner.
    if (compact === null && resolvedCompact !== null) setCompact(resolvedCompact);

    useEffect(() => {
        if (compact !== null) return;
        const timeout = window.setTimeout(() => setCompact((layout) => layout ?? false), HERO_LAYOUT_WAIT_MS);
        return () => window.clearTimeout(timeout);
    }, [compact]);

    return (
        <div className="pb-12">
            <HeroCarousel autoFocus compact={compact} />
            <div className="lg:px-6 space-y-8 md:space-y-12">
                <ContinueWatching playback={playback} />
                <AddonCatalogs />
                <MediaFooter className="pt-10 border-t border-border/50" />
            </div>
        </div>
    );
}
