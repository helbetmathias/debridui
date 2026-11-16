"use client";

import dynamic from "next/dynamic";
import { ContinueWatching } from "@/features/media/components/continue-watching";
import { HeroCarouselSkeleton } from "@/features/media/components/hero-carousel-skeleton";
import { MediaFooter } from "@/features/media/components/media-footer";
import { useSimklPlayback } from "@/features/media/hooks/use-simkl";
import { AddonCatalogs } from "./_components/addon-catalogs";

const HeroCarousel = dynamic(
    () => import("@/features/media/components/hero-carousel").then((m) => ({ default: m.HeroCarousel })),
    { loading: () => <HeroCarouselSkeleton />, ssr: false }
);

export default function DashboardPage() {
    const { data: playback } = useSimklPlayback();
    const hasContinueWatching = !!playback?.connected && playback.items.length > 0;

    return (
        <div className="pb-12">
            <HeroCarousel autoFocus compact={hasContinueWatching} />
            <div className="lg:px-6 space-y-8 md:space-y-12">
                <ContinueWatching />
                <AddonCatalogs />
                <MediaFooter className="pt-10 border-t border-border/50" />
            </div>
        </div>
    );
}
