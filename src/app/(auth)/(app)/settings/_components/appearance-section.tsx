"use client";

import { Info, Monitor, Moon, Play, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { SectionDivider } from "@/components/layout/section-divider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { detectPlatform, isSupportedPlayer, PLAYER_PLATFORM_SUPPORT } from "@/lib/media/player";
import type { MediaPlayer } from "@/lib/schemas";
import { useSettingsStore } from "@/stores/settings";
import { getPlayerSetupInstruction } from "./player-setup-instructions";

const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
];

export function AppearanceSection() {
    const { theme, setTheme } = useTheme();
    const set = useSettingsStore((s) => s.set);
    const mediaPlayer = useSettingsStore((s) => s.settings.mediaPlayer);
    const mediaPlayerPresets = useSettingsStore((s) => s.getPresets)("mediaPlayer") || [];
    const platform = detectPlatform();
    const setupInstruction = getPlayerSetupInstruction(mediaPlayer, platform);
    const isPlayerSupported = isSupportedPlayer(mediaPlayer, platform);

    return (
        <section className="space-y-4">
            <SectionDivider label="Appearance" />

            <div className="grid gap-6 md:grid-cols-2">
                {/* Theme */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Monitor className="size-4 text-muted-foreground" />
                        <Label htmlFor="theme" className="text-sm">
                            Theme
                        </Label>
                    </div>
                    <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger id="theme" className="w-full">
                            <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                            {themes.map((themeOption) => {
                                const Icon = themeOption.icon;
                                return (
                                    <SelectItem key={themeOption.value} value={themeOption.value}>
                                        <div className="flex items-center gap-2">
                                            <Icon className="size-3.5" />
                                            <span>{themeOption.label}</span>
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Select your preferred color scheme for the interface
                    </p>
                </div>

                {/* Media Player */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Play className="size-4 text-muted-foreground" />
                        <Label htmlFor="media-player" className="text-sm">
                            Default Player
                        </Label>
                    </div>
                    <Select value={mediaPlayer} onValueChange={(value) => set("mediaPlayer", value as MediaPlayer)}>
                        <SelectTrigger id="media-player" className="w-full">
                            <SelectValue placeholder="Select media player">
                                {mediaPlayerPresets.find((p) => p.value === mediaPlayer)?.label}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {mediaPlayerPresets.map((preset) => (
                                <SelectItem key={preset.value} value={preset.value}>
                                    <div className="flex flex-col gap-0.5">
                                        <span>{preset.label}</span>
                                        <span className="text-xs text-muted-foreground">{preset.description}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        External players require the application to be installed
                    </p>
                </div>
            </div>

            {!isPlayerSupported && (
                <div className="flex items-start gap-3 rounded-sm border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-500">
                    <Info className="size-3.5 shrink-0 mt-0.5" />
                    <p>
                        {mediaPlayer} is not officially supported on {platform}. Supported platforms:{" "}
                        {PLAYER_PLATFORM_SUPPORT[mediaPlayer]?.join(", ")}
                    </p>
                </div>
            )}

            {setupInstruction && (
                <div className="flex items-start gap-3 rounded-sm border border-border/50 p-3 text-sm text-muted-foreground">
                    <Info className="size-3.5 shrink-0 mt-0.5" />
                    <p>{setupInstruction}</p>
                </div>
            )}
        </section>
    );
}
