"use client";
import { Key } from "lucide-react";
import { useCallback, useRef } from "react";
import { SectionDivider } from "@/components/layout/section-divider";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useSaveUserSettings } from "@/features/settings/hooks/use-user-settings";
import { useSettingsStore } from "@/stores/settings";

export function ApiKeysSection() {
    const set = useSettingsStore((s) => s.set);
    const tmdbApiKey = useSettingsStore((s) => s.settings.tmdbApiKey);
    const { mutate: saveSettings } = useSaveUserSettings();
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

    const handleTmdbApiKeyChange = useCallback(
        (value: string) => {
            set("tmdbApiKey", value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                saveSettings({ tmdb_api_key: value });
            }, 500);
        },
        [set, saveSettings]
    );

    return (
        <section className="space-y-4">
            <SectionDivider label="API Keys" />

            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Key className="size-4 text-muted-foreground" />
                    <Label htmlFor="tmdb-api-key" className="text-sm">
                        TMDB API Key
                    </Label>
                </div>
                <div className="max-w-md">
                    <PasswordInput
                        id="tmdb-api-key"
                        placeholder="Enter your TMDB API key"
                        value={tmdbApiKey}
                        onChange={(e) => handleTmdbApiKeyChange(e.target.value)}
                    />
                </div>
                <p className="text-xs text-muted-foreground">
                    Needed for episode grouping and enhanced TV show metadata—particularly useful for anime.{" "}
                    <a
                        href="https://www.themoviedb.org/settings/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline">
                        Get your API key
                    </a>
                </p>
            </div>
        </section>
    );
}
