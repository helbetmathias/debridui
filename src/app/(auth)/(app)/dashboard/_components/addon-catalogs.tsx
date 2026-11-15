"use client";

import { Film, Puzzle, Tv } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    type AddonCatalogDef,
    catalogSlug,
    useAddonCatalog,
    useAddonCatalogDefs,
} from "@/features/addons/hooks/use-addons";
import { MediaSection } from "@/features/media/components/media-section";
import { useUserSettings } from "@/features/settings/hooks/use-user-settings";
import { isCatalogVisible } from "@/lib/addons/catalog-preferences";
import { ContentSection } from "./content-section";

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
export const AddonCatalogs = memo(function AddonCatalogs() {
    const { catalogs, isLoading } = useAddonCatalogDefs();
    const { data: settings, isLoading: settingsLoading } = useUserSettings();
    const dashboardCatalogs = useMemo(
        () => catalogs.filter((catalog) => isCatalogVisible(catalog, settings?.catalog_visibility)),
        [catalogs, settings?.catalog_visibility]
    );
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

    if (isLoading || settingsLoading || dashboardCatalogs.length === 0) return null;

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
