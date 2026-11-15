export type CatalogVisibilityPreferences = Record<string, boolean>;

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
