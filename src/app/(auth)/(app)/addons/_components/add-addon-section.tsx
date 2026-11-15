"use client";

import { ClipboardPaste, Loader2, Plus, Puzzle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SectionDivider } from "@/components/layout/section-divider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddAddon, useUserAddons } from "@/features/addons/hooks/use-addons";
import { AddonClient } from "@/lib/addons/client";
import type { CreateAddon } from "@/types";

const ADDON_PRESETS = [
    {
        name: "Torrentio",
        url: "https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex|qualityfilter=480p,other,scr,cam|limit=4/manifest.json",
    },
    {
        name: "Streaming Catalogs",
        url: "https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/bmZ4LGRucCxhbXAsYXRwLGhibSxwbXAsamhzLHplZSxjcnUscGNwLHNvbnlsaXY6OjoxNzcwMjQ2NjcwMTU5OjA6MDo%3D/manifest.json",
    },
] as const;

export function AddAddonSection() {
    const { data: serverAddons = [] } = useUserAddons();
    const addAddonMutation = useAddAddon();
    const [newAddonUrl, setNewAddonUrl] = useState("");
    const [validating, setValidating] = useState(false);

    const handleAddAddon = async (url?: string) => {
        const addonUrl = url || newAddonUrl;

        if (!addonUrl.trim()) {
            toast.error("Please enter an addon URL");
            return;
        }

        setValidating(true);
        try {
            const client = new AddonClient({ url: addonUrl });
            const manifest = await client.fetchManifest();

            // Check if addon URL already exists
            const addonExists = serverAddons.some((addon) => addon.url === addonUrl);
            if (addonExists) {
                toast.error(`${manifest.name} addon is already added`);
                setValidating(false);
                return;
            }

            const newAddon: CreateAddon = {
                name: manifest.name,
                url: addonUrl,
                enabled: true,
            };

            await addAddonMutation.mutateAsync(newAddon);
            toast.success(`Added ${manifest.name} addon`);
            setNewAddonUrl("");
        } catch (error) {
            toast.error(`Failed to add addon: ${error instanceof Error ? error.message : "Invalid addon URL"}`);
        } finally {
            setValidating(false);
        }
    };

    return (
        <section className="space-y-4">
            <SectionDivider label="Add Addon" />

            <div className="space-y-3">
                {/* URL Input — always visible */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input
                            type="url"
                            placeholder="https://addon.example.com/manifest.json"
                            value={newAddonUrl}
                            onChange={(e) => setNewAddonUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && newAddonUrl.trim() && handleAddAddon()}
                            disabled={validating}
                            className="font-mono text-sm pr-9"
                        />
                        <button
                            type="button"
                            onClick={
                                newAddonUrl
                                    ? () => setNewAddonUrl("")
                                    : async () => {
                                          try {
                                              const text = await navigator.clipboard.readText();
                                              if (text.trim()) setNewAddonUrl(text.trim());
                                          } catch {
                                              toast.error("Unable to read clipboard");
                                          }
                                      }
                            }
                            disabled={validating}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                            {newAddonUrl ? <X className="size-4" /> : <ClipboardPaste className="size-4" />}
                        </button>
                    </div>
                    <Button onClick={() => handleAddAddon()} disabled={validating || !newAddonUrl.trim()}>
                        {validating && !newAddonUrl.trim() ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : validating ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                <span className="hidden sm:inline">Add</span>
                            </>
                        ) : (
                            <>
                                <Plus className="size-4" />
                                <span className="hidden sm:inline">Add</span>
                            </>
                        )}
                    </Button>
                </div>

                {/* Quick add presets */}
                <div className="space-y-2">
                    <p className="text-xs tracking-widest uppercase text-muted-foreground">Quick add</p>
                    <div className="flex flex-wrap gap-2">
                        {ADDON_PRESETS.map((preset) => (
                            <Button
                                key={preset.name}
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddAddon(preset.url)}
                                disabled={validating}>
                                {validating && !newAddonUrl.trim() ? (
                                    <Loader2 className="size-3 animate-spin" />
                                ) : (
                                    <Puzzle className="size-3" />
                                )}
                                {preset.name}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
