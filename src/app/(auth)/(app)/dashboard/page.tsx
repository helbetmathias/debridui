"use client";

import dynamic from "next/dynamic";
import { HeroCarouselSkeleton } from "@/features/media/components/hero-carousel-skeleton";
import { MediaFooter } from "@/features/media/components/media-footer";
import { AddonCatalogs } from "./_components/addon-catalogs";

const HeroCarousel = dynamic(
    () => import("@/features/media/components/hero-carousel").then((m) => ({ default: m.HeroCarousel })),
    { loading: () => <HeroCarouselSkeleton />, ssr: false }
);

export default function DashboardPage() {
    return (
        <div className="pb-12">
            <HeroCarousel autoFocus />
            <div className="lg:px-6 space-y-16">
                <AddonCatalogs />
                <MediaFooter className="pt-10 border-t border-border/50" />
            </div>
        </div>
    );
}
