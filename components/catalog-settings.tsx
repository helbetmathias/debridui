"use client";

import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { SectionDivider } from "@/components/section-divider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAddonCatalogDefs } from "@/hooks/use-addons";
import { useSaveUserSettings, useUserSettings } from "@/hooks/use-user-settings";
import {
    catalogPreferenceKey,
    isCatalogVisible,
    type CatalogVisibilityPreferences,
} from "@/lib/addons/catalog-preferences";

const CAPABILITY_LABELS = {
    catalogs: "Catalogs",
    streams: "Streams",
    metadata: "Metadata",
    subtitles: "Subtitles",
} as const;

export function CatalogSettings() {
    const { addonManifests, isLoading: manifestsLoading } = useAddonCatalogDefs({ includeDisabled: true });
    const { data: settings, isLoading: settingsLoading } = useUserSettings();
    const saveSettings = useSaveUserSettings();
    const preferences = settings?.catalog_visibility;

    const enabledCatalogs = useMemo(
        () => addonManifests.filter((addon) => addon.addonEnabled).flatMap((addon) => addon.catalogs),
        [addonManifests]
    );
    const visibleCount = enabledCatalogs.filter((catalog) => isCatalogVisible(catalog, preferences)).length;

    const persistPreferences = async (next: CatalogVisibilityPreferences) => {
        try {
            await saveSettings.mutateAsync({ catalog_visibility: next });
        } catch {
            toast.error("Failed to save catalog visibility");
        }
    };

    const handleToggle = (key: string, visible: boolean) => {
        void persistPreferences({ ...preferences, [key]: visible });
    };

    const handleReset = () => {
        void persistPreferences({});
    };

    const isLoading = manifestsLoading || settingsLoading;

    return (
        <section className="space-y-4">
            <SectionDivider label="Dashboard Catalogs" />

            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm text-foreground">Choose what appears on your dashboard</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {isLoading
                            ? "Loading addon capabilities..."
                            : `${visibleCount} of ${enabledCatalogs.length} available catalog(s) visible`}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={isLoading || saveSettings.isPending}>
                    <RotateCcw className="size-3.5" />
                    Reset
                </Button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2].map((item) => (
                        <div key={item} className="h-32 animate-pulse rounded-sm border border-border/50 bg-card/40" />
                    ))}
                </div>
            ) : addonManifests.length === 0 ? (
                <div className="rounded-sm border border-border/50 p-6 text-center text-sm text-muted-foreground">
                    Add an addon to configure its dashboard catalogs.
                </div>
            ) : (
                <div className="space-y-3">
                    {addonManifests.map((addon) => (
                        <div
                            key={addon.addonId}
                            className={`rounded-sm border border-border/50 bg-card/30 ${addon.addonEnabled ? "" : "opacity-55"}`}>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">{addon.addonName}</p>
                                    {!addon.addonEnabled && <Badge variant="outline">Addon disabled</Badge>}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(addon.capabilities).map(([capability, available]) => (
                                        <Badge
                                            key={capability}
                                            variant="outline"
                                            className={
                                                available ? "text-foreground" : "text-muted-foreground/45 line-through"
                                            }>
                                            {CAPABILITY_LABELS[capability as keyof typeof CAPABILITY_LABELS]}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {addon.catalogs.length === 0 ? (
                                <p className="px-4 py-4 text-xs text-muted-foreground">
                                    No dashboard catalogs declared by this addon.
                                </p>
                            ) : (
                                <div className="divide-y divide-border/40">
                                    {addon.catalogs.map((catalog) => {
                                        const preferenceKey = catalogPreferenceKey(catalog);
                                        const visible = isCatalogVisible(catalog, preferences);

                                        return (
                                            <div
                                                key={preferenceKey}
                                                className="flex items-center justify-between gap-4 px-4 py-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm text-foreground">{catalog.name}</p>
                                                    <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                                                        {catalog.type === "series" ? "TV series" : catalog.type}
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={visible}
                                                    onCheckedChange={(checked) => handleToggle(preferenceKey, checked)}
                                                    disabled={!addon.addonEnabled || saveSettings.isPending}
                                                    aria-label={`${visible ? "Hide" : "Show"} ${catalog.name} on dashboard`}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
