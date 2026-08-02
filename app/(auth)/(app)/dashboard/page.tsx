"use client";

import { Film, Puzzle, Tv } from "lucide-react";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContinueWatching } from "@/components/mdb/continue-watching";
import { HeroCarouselSkeleton } from "@/components/mdb/hero-carousel-skeleton";
import { MdbFooter } from "@/components/mdb/mdb-footer";
import { MediaSection } from "@/components/mdb/media-section";
import { type AddonCatalogDef, catalogSlug, useAddonCatalog, useAddonCatalogDefs } from "@/hooks/use-addons";

const HeroCarousel = dynamic(
    () => import("@/components/mdb/hero-carousel").then((m) => ({ default: m.HeroCarousel })),
    {
        loading: () => <HeroCarouselSkeleton />,
        ssr: false,
    }
);

// Content section with modern divider
interface ContentSectionProps {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    delay?: number;
}

const ContentSection = memo(function ContentSection({ label, icon: Icon, children, delay = 0 }: ContentSectionProps) {
    return (
        <div
            className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-4"
            style={{
                animationDelay: `${delay}ms`,
                animationDuration: "600ms",
                animationFillMode: "backwards",
            }}>
            {/* Section divider with animated accent */}
            <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-linear-to-r from-transparent via-border/50 to-border/50" />
                <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm">
                    {Icon && (
                        <span className="text-primary">
                            <Icon className="size-3.5" />
                        </span>
                    )}
                    <span className="text-xs tracking-widest uppercase text-muted-foreground">{label}</span>
                </div>
                <div className="h-px flex-1 bg-linear-to-l from-transparent via-border/50 to-border/50" />
            </div>
            {children}
        </div>
    );
});

// Individual catalog row — receives visibility from parent observer
const AddonCatalogRow = memo(function AddonCatalogRow({
    catalog,
    isVisible,
}: {
    catalog: AddonCatalogDef;
    isVisible: boolean;
}) {
    const { data, error } = useAddonCatalog(catalog, isVisible);
    const items = data?.items;

    return (
        <MediaSection
            title={catalog.name}
            titleIcon={catalog.type === "movie" ? Film : Tv}
            items={items}
            isLoading={isVisible && !data && !error}
            error={error}
            rows={1}
            viewAllHref={`/discover/addon/${catalogSlug(catalog)}`}
        />
    );
});

// Single shared IntersectionObserver for all catalog rows
const AddonCatalogs = memo(function AddonCatalogs() {
    const { catalogs, isLoading } = useAddonCatalogDefs();
    const dashboardCatalogs = useMemo(() => {
        return catalogs.filter((catalog) => {
            const addonName = catalog.addonName.trim().toLowerCase();
            return addonName === "cinemeta" || addonName === "streaming catalogs";
        });
    }, [catalogs]);
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
    const observerRef = useRef<IntersectionObserver>(undefined);
    const pendingRef = useRef<Element[]>([]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const newKeys: string[] = [];
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const key = (entry.target as HTMLElement).dataset.catalogKey;
                        if (key) newKeys.push(key);
                        observer.unobserve(entry.target);
                    }
                }
                if (newKeys.length > 0) {
                    setVisibleKeys((prev) => {
                        const next = new Set(prev);
                        for (const k of newKeys) next.add(k);
                        return next;
                    });
                }
            },
            { rootMargin: "100% 0px" }
        );
        observerRef.current = observer;
        // Observe elements that mounted before the observer was ready
        for (const el of pendingRef.current) observer.observe(el);
        pendingRef.current = [];
        return () => observer.disconnect();
    }, []);

    const observeRef = useCallback((el: HTMLDivElement | null) => {
        if (!el) return;
        if (observerRef.current) {
            observerRef.current.observe(el);
        } else {
            pendingRef.current.push(el);
        }
    }, []);

    if (isLoading || dashboardCatalogs.length === 0) return null;

    return (
        <ContentSection label="From Your Addons" icon={Puzzle}>
            <div className="space-y-1 md:space-y-3">
                {dashboardCatalogs.map((catalog) => {
                    const key = `${catalog.addonId}-${catalog.type}-${catalog.id}`;
                    return (
                        <div key={key} ref={observeRef} data-catalog-key={key}>
                            <AddonCatalogRow catalog={catalog} isVisible={visibleKeys.has(key)} />
                        </div>
                    );
                })}
            </div>
        </ContentSection>
    );
});

const DashboardPage = memo(function DashboardPage() {
    return (
        <div className="pb-12">
            {/* Hero Carousel */}
            <HeroCarousel autoFocus />

            {/* Continue Watching */}
            <ContinueWatching />

            {/* Content Sections with lazy loading */}
            <div className="lg:px-6 space-y-16">
                {/* Addon Catalogs */}
                <AddonCatalogs />

                {/* Footer */}
                <MdbFooter className="pt-10 border-t border-border/50" />
            </div>
        </div>
    );
});

export default DashboardPage;
