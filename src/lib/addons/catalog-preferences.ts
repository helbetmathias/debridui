export type CatalogVisibilityPreferences = Record<string, boolean>;

interface HeroCatalogIdentity extends CatalogIdentity {
    name: string;
    addonEnabled: boolean;
}

export function getHeroCatalogKeys(catalogs: HeroCatalogIdentity[], saved?: string[]): string[] {
    if (saved !== undefined) {
        const available = new Set(catalogs.map(catalogPreferenceKey));
        return [...new Set(saved)].filter((key) => available.has(key)).slice(0, 2);
    }
    const defaults = catalogs.filter(
        (catalog) =>
            catalog.addonEnabled &&
            catalog.addonName.trim().toLowerCase() === "cinemeta" &&
            catalog.name.trim().toLowerCase() === "popular" &&
            (catalog.type === "movie" || catalog.type === "series")
    );
    return [...new Set(defaults.map(catalogPreferenceKey))].slice(0, 2);
}

interface CatalogIdentity {
    manifestId: string;
    type: string;
    id: string;
    addonName: string;
}

const DEFAULT_DASHBOARD_ADDONS = new Set(["cinemeta", "streaming catalogs"]);

export function catalogPreferenceKey(catalog: Pick<CatalogIdentity, "manifestId" | "type" | "id">): string {
    return [catalog.manifestId, catalog.type, catalog.id].map(encodeURIComponent).join("~");
}

export function defaultCatalogVisibility(catalog: Pick<CatalogIdentity, "addonName">): boolean {
    return DEFAULT_DASHBOARD_ADDONS.has(catalog.addonName.trim().toLowerCase());
}

export function isCatalogVisible(
    catalog: CatalogIdentity,
    preferences: CatalogVisibilityPreferences | undefined
): boolean {
    return preferences?.[catalogPreferenceKey(catalog)] ?? defaultCatalogVisibility(catalog);
}
