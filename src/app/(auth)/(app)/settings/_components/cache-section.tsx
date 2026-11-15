"use client";

import { del } from "idb-keyval";
import { Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SectionDivider } from "@/components/layout/section-divider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthGuaranteed } from "@/features/auth/components/auth-provider";
import { queryClient } from "@/lib/query-client";
import { useSettingsStore } from "@/stores/settings";

export function CacheSection() {
    const { currentAccount } = useAuthGuaranteed();
    const set = useSettingsStore((s) => s.set);
    const downloadLinkMaxAge = useSettingsStore((s) => s.settings.downloadLinkMaxAge);
    const downloadLinkMaxAgePresets = useSettingsStore((s) => s.getPresets)("downloadLinkMaxAge") || [];

    const handleClearCache = async (key?: string[]) => {
        const toastId = toast.loading("Clearing cache...");
        try {
            if (key) {
                queryClient.removeQueries({ queryKey: key });
            } else {
                await del("DEBRIDUI_CACHE");
                queryClient.clear();
            }
            toast.success("Cache cleared successfully", { id: toastId });
        } catch (error) {
            toast.error("Failed to clear cache", { id: toastId });
            console.error("Error clearing cache:", error);
        }
    };

    return (
        <section className="space-y-4">
            <SectionDivider label="Cache" />

            {/* Download Link Cache Duration */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <Label htmlFor="download-link-max-age" className="text-sm">
                        Cache Duration
                    </Label>
                </div>
                <Select
                    value={String(downloadLinkMaxAge)}
                    onValueChange={(value) => set("downloadLinkMaxAge", Number(value))}>
                    <SelectTrigger id="download-link-max-age" className="w-full max-w-xs">
                        <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                        {downloadLinkMaxAgePresets.map((preset) => (
                            <SelectItem key={preset.value} value={String(preset.value)} title={preset.description}>
                                {preset.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    Links will be kept in memory for this duration before being garbage collected
                </p>
            </div>

            {/* Cache Management */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                    <Trash2 className="size-4 text-muted-foreground" />
                    <span className="text-sm">Clear Cache</span>
                </div>

                <div className="space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-sm border border-border/50 p-3">
                        <div>
                            <p className="text-sm">Download Links Cache</p>
                            <p className="text-xs text-muted-foreground">Remove all cached download links</p>
                        </div>
                        <Button
                            onClick={() => handleClearCache([currentAccount.id, "getDownloadLink"])}
                            variant="outline">
                            Clear Links
                        </Button>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-sm border border-destructive/30 bg-destructive/5 p-3">
                        <div>
                            <p className="text-sm">All Cached Data</p>
                            <p className="text-xs text-muted-foreground">Remove all cached data from browser</p>
                        </div>
                        <Button onClick={() => handleClearCache()} variant="destructive">
                            Clear All
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
