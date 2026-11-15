"use client";

import { Play, Sliders, Zap } from "lucide-react";
import { SectionDivider } from "@/components/layout/section-divider";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RESOLUTIONS, SOURCE_QUALITIES } from "@/lib/addons/parser";
import { Resolution, type SourceQuality } from "@/lib/addons/types";
import { cn } from "@/lib/utils";
import {
    QUALITY_PROFILES,
    type QualityProfileId,
    type QualityRange,
    type StreamingResolution,
    type StreamingSettings,
    useSettingsStore,
} from "@/stores/settings";

const RESOLUTION_OPTIONS: { value: StreamingResolution; label: string }[] = [
    { value: "any", label: "Any" },
    ...RESOLUTIONS.map((r) => ({ value: r, label: r === Resolution.UHD_4K ? "4K" : r })).reverse(),
];

const SOURCE_QUALITY_OPTIONS: { value: SourceQuality | "any"; label: string }[] = [
    { value: "any", label: "Any" },
    ...SOURCE_QUALITIES.map((q) => ({ value: q, label: q })),
];

export function StreamingSection() {
    const set = useSettingsStore((s) => s.set);
    const streaming = useSettingsStore((s) => s.settings.streaming);
    const isCustom = streaming.profileId === "custom";

    const updateStreaming = (updates: Partial<StreamingSettings>) => {
        set("streaming", { ...streaming, ...updates });
    };

    const updateCustomRange = (updates: Partial<QualityRange>) => {
        updateStreaming({
            customRange: { ...streaming.customRange, ...updates },
        });
    };

    const selectProfile = (profileId: QualityProfileId) => {
        if (profileId === "custom" && streaming.profileId !== "custom") {
            // Copy current profile's range to custom when switching to custom
            const currentProfile = QUALITY_PROFILES.find((p) => p.id === streaming.profileId);
            if (currentProfile) {
                updateStreaming({ profileId, customRange: { ...currentProfile.range } });
                return;
            }
        }
        updateStreaming({ profileId });
    };

    return (
        <section className="space-y-4">
            <SectionDivider label="Streaming" />

            {/* Quality Profile */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Sliders className="size-4 text-muted-foreground" />
                    <Label className="text-sm">Quality Profile</Label>
                </div>

                {/* Profile Chips */}
                <div className="flex flex-wrap gap-2">
                    {QUALITY_PROFILES.map((profile) => (
                        <button
                            type="button"
                            key={profile.id}
                            onClick={() => selectProfile(profile.id)}
                            className={cn(
                                "group relative px-3 py-1.5 text-sm rounded-sm border transition-all duration-300",
                                streaming.profileId === profile.id
                                    ? "border-primary bg-primary/5 text-foreground"
                                    : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                            )}>
                            <span className="font-medium">{profile.name}</span>
                            <span className="ml-1.5 text-xs opacity-60">{profile.description}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => selectProfile("custom")}
                        className={cn(
                            "group relative px-3 py-1.5 text-sm rounded-sm border transition-all duration-300",
                            isCustom
                                ? "border-primary bg-primary/5 text-foreground"
                                : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                        )}>
                        <span className="font-medium">Custom</span>
                    </button>
                </div>

                {/* Custom Range Panel */}
                <Collapsible open={isCustom}>
                    <CollapsibleContent>
                        <div className="mt-3 p-4 rounded-sm border border-border/50 bg-muted/10 space-y-5">
                            {/* Resolution Range */}
                            <div className="space-y-3">
                                <span className="text-xs tracking-widest uppercase text-muted-foreground">
                                    Resolution
                                </span>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <span className="text-xs text-muted-foreground">Minimum</span>
                                        <Select
                                            value={streaming.customRange.minResolution}
                                            onValueChange={(v) =>
                                                updateCustomRange({ minResolution: v as StreamingResolution })
                                            }>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {RESOLUTION_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-xs text-muted-foreground">Maximum</span>
                                        <Select
                                            value={streaming.customRange.maxResolution}
                                            onValueChange={(v) =>
                                                updateCustomRange({ maxResolution: v as StreamingResolution })
                                            }>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {RESOLUTION_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Source Quality Range */}
                            <div className="space-y-3">
                                <span className="text-xs tracking-widest uppercase text-muted-foreground">
                                    Source Quality
                                </span>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <span className="text-xs text-muted-foreground">Minimum</span>
                                        <Select
                                            value={streaming.customRange.minSourceQuality}
                                            onValueChange={(v) =>
                                                updateCustomRange({
                                                    minSourceQuality: v as SourceQuality | "any",
                                                })
                                            }>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SOURCE_QUALITY_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-xs text-muted-foreground">Maximum</span>
                                        <Select
                                            value={streaming.customRange.maxSourceQuality}
                                            onValueChange={(v) =>
                                                updateCustomRange({
                                                    maxSourceQuality: v as SourceQuality | "any",
                                                })
                                            }>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SOURCE_QUALITY_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Sources outside these ranges will be filtered out during auto-selection.
                            </p>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>

            {/* Toggle Settings */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between gap-3 rounded-sm border border-border/50 p-3">
                    <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                            <Zap className="size-4 text-muted-foreground shrink-0" />
                            <Label htmlFor="allow-uncached" className="text-sm">
                                Allow Uncached Sources
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Automatically play uncached sources without confirmation
                        </p>
                    </div>
                    <Switch
                        id="allow-uncached"
                        className="shrink-0"
                        checked={streaming.allowUncached}
                        onCheckedChange={(checked) => updateStreaming({ allowUncached: checked })}
                    />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-sm border border-border/50 p-3">
                    <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                            <Play className="size-4 text-muted-foreground shrink-0" />
                            <Label htmlFor="auto-play" className="text-sm">
                                Auto-play
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Automatically start playback when a cached source is found
                        </p>
                    </div>
                    <Switch
                        id="auto-play"
                        className="shrink-0"
                        checked={streaming.autoPlay}
                        onCheckedChange={(checked) => updateStreaming({ autoPlay: checked })}
                    />
                </div>
            </div>
        </section>
    );
}
