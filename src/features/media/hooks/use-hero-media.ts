import { useQueries } from "@tanstack/react-query";
import { addonCatalogQueryOptions, useAddonCatalogDefs } from "@/features/addons/hooks/use-addons";
import { useUserSettings } from "@/features/settings/hooks/use-user-settings";
import { catalogPreferenceKey, getHeroCatalogKeys } from "@/lib/addons/catalog-preferences";
import { type MediaItem, mediaClient } from "@/lib/media";
import { mixHeroItems } from "@/lib/media/hero";
import { getBackdropUrl } from "@/lib/media/images";

export function useHeroMedia() {
    const { catalogs, isLoading: manifestsLoading } = useAddonCatalogDefs();
    const { data: settings, isLoading: settingsLoading } = useUserSettings();
    const keys = getHeroCatalogKeys(catalogs, settings?.hero_catalogs);
    const selected = keys.flatMap((key) => {
        const catalog = catalogs.find((item) => catalogPreferenceKey(item) === key);
        return catalog && (catalog.type === "movie" || catalog.type === "series") ? [catalog] : [];
    });
    const feeds = useQueries({
        queries: selected.map((catalog) => addonCatalogQueryOptions(catalog, !settingsLoading)),
    });
    const candidates = mixHeroItems(
        feeds.map((feed) => feed.data?.items ?? []),
        12
    );
    const details = useQueries({
        queries: candidates.map((item) => {
            const type = item.movie ? "movie" : "show";
            const media = (item.movie ?? item.show)!;
            const id = media.ids?.imdb || media.ids?.slug || "";
            return {
                queryKey: ["tmdb", "media", id, type],
                queryFn: () => (type === "movie" ? mediaClient.getMovie(id) : mediaClient.getShow(id)),
                enabled: !!id && !getBackdropUrl(media.images),
                staleTime: 24 * 60 * 60 * 1000,
                retry: false,
            };
        }),
    });
    const items = candidates
        .flatMap((item, index): MediaItem[] => {
            const detail = details[index]?.data;
            const enriched: MediaItem = detail ? (item.movie ? { movie: detail } : { show: detail }) : item;
            const media = enriched.movie ?? enriched.show;
            return media && getBackdropUrl(media.images) ? [enriched] : [];
        })
        .slice(0, 10);
    return {
        items,
        isLoading:
            manifestsLoading ||
            settingsLoading ||
            feeds.some((feed) => feed.isLoading) ||
            (items.length === 0 && details.some((detail) => detail.isLoading)),
    };
}
