"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionDivider } from "@/components/layout/section-divider";
import { AddonCard, AddonCardSkeleton } from "@/features/addons/components/addon-card";
import {
    useRemoveAddon,
    useToggleAddon,
    useUpdateAddonOrders,
    useUserAddons,
} from "@/features/addons/hooks/use-addons";
import type { Addon } from "@/lib/addons/types";

export function AddonListSection() {
    const { data: serverAddons = [], isLoading } = useUserAddons();
    const removeAddonMutation = useRemoveAddon();
    const toggleAddonMutation = useToggleAddon();
    const updateOrdersMutation = useUpdateAddonOrders();
    const [addonToDelete, setAddonToDelete] = useState<Addon | null>(null);

    // Memoize sorted addons to avoid re-sorting on every render
    const sortedAddons = useMemo(() => [...serverAddons].sort((a, b) => a.order - b.order), [serverAddons]);

    const handleRemoveAddon = (addon: Addon) => {
        setAddonToDelete(addon);
    };

    const confirmRemoveAddon = async () => {
        if (!addonToDelete) return;

        await removeAddonMutation.mutateAsync(addonToDelete.id);
        toast.success(`Removed ${addonToDelete.name} addon`);
        setAddonToDelete(null);
    };

    const handleToggleAddon = async (addon: Addon) => {
        await toggleAddonMutation.mutateAsync({ addonId: addon.id, enabled: !addon.enabled });
        toast.success(`${addon.enabled ? "Disabled" : "Enabled"} ${addon.name} addon`);
    };

    const handleMoveUp = async (addon: Addon) => {
        if (updateOrdersMutation.isPending) return;
        const currentIndex = sortedAddons.findIndex((a) => a.id === addon.id);

        if (currentIndex > 0) {
            const updates = [
                { id: sortedAddons[currentIndex].id, order: sortedAddons[currentIndex - 1].order },
                { id: sortedAddons[currentIndex - 1].id, order: sortedAddons[currentIndex].order },
            ];
            await updateOrdersMutation.mutateAsync(updates);
        }
    };

    const handleMoveDown = async (addon: Addon) => {
        if (updateOrdersMutation.isPending) return;
        const currentIndex = sortedAddons.findIndex((a) => a.id === addon.id);

        if (currentIndex < sortedAddons.length - 1) {
            const updates = [
                { id: sortedAddons[currentIndex].id, order: sortedAddons[currentIndex + 1].order },
                { id: sortedAddons[currentIndex + 1].id, order: sortedAddons[currentIndex].order },
            ];
            await updateOrdersMutation.mutateAsync(updates);
        }
    };
    return (
        <>
            <section className="space-y-4">
                <SectionDivider label="Your Addons" />

                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        {isLoading
                            ? "Loading..."
                            : sortedAddons.length === 0
                              ? "No addons configured yet"
                              : `${sortedAddons.filter((a) => a.enabled).length} of ${sortedAddons.length} addon(s) enabled`}
                    </p>
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <AddonCardSkeleton key={i} />
                        ))}
                    </div>
                ) : sortedAddons.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-sm font-light text-foreground">No addons added yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Add your first addon to start fetching sources
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sortedAddons.map((addon, index) => (
                            <AddonCard
                                key={addon.id}
                                addon={addon}
                                onToggle={handleToggleAddon}
                                onRemove={handleRemoveAddon}
                                onMoveUp={handleMoveUp}
                                onMoveDown={handleMoveDown}
                                isFirst={index === 0}
                                isLast={index === sortedAddons.length - 1}
                                isReordering={updateOrdersMutation.isPending}
                            />
                        ))}
                    </div>
                )}
            </section>

            <ConfirmDialog
                open={!!addonToDelete}
                onOpenChange={(open) => !open && setAddonToDelete(null)}
                title="Remove Addon"
                description={`Are you sure you want to remove "${addonToDelete?.name}"? This action cannot be undone.`}
                confirmText="Remove"
                cancelText="Cancel"
                variant="destructive"
                onConfirm={confirmRemoveAddon}
            />
        </>
    );
}
