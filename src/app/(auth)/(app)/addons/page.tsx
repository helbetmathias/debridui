"use client";

import { Puzzle, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { CatalogSettings } from "@/components/catalog-settings";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useUserAddons } from "@/features/addons/hooks/use-addons";
import { AddAddonSection } from "./_components/add-addon-section";
import { AddonInfoSection } from "./_components/addon-info-section";
import { AddonListSection } from "./_components/addon-list-section";

export default function AddonsPage() {
    const { isLoading, refetch } = useUserAddons();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    }, [refetch]);

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6 lg:space-y-8 pb-16">
            <PageHeader
                icon={Puzzle}
                title="Stremio Addons"
                description="Manage your Stremio addons to fetch sources from multiple providers"
                primaryAction={
                    <Button
                        onClick={handleRefresh}
                        disabled={isRefreshing || isLoading}
                        variant="ghost"
                        size="icon"
                        aria-label="Refresh"
                        className="size-8 sm:size-9 -mr-1.5 text-muted-foreground hover:text-foreground">
                        <RefreshCw className={`size-5! sm:size-[22px]! ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                }
            />

            <AddAddonSection />
            <AddonListSection />
            <CatalogSettings />
            <AddonInfoSection />
        </div>
    );
}
