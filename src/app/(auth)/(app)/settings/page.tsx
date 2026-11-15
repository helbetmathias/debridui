"use client";

import { useIsMutating } from "@tanstack/react-query";
import { Loader2, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { USER_SETTINGS_KEY } from "@/features/settings/hooks/use-user-settings";
import { AboutSection } from "./_components/about-section";
import { ApiKeysSection } from "./_components/api-keys-section";
import { AppearanceSection } from "./_components/appearance-section";
import { BackupSection } from "./_components/backup-section";
import { CacheSection } from "./_components/cache-section";
import { DataSection } from "./_components/data-section";
import { StreamingSection } from "./_components/streaming-section";

export default function SettingsPage() {
    const isSaving = useIsMutating({ mutationKey: USER_SETTINGS_KEY }) > 0;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6 lg:space-y-8 pb-16">
            <PageHeader
                icon={Settings}
                title="Settings"
                description="Manage your application preferences"
                primaryAction={
                    isSaving ? (
                        <span className="flex items-center gap-1.5 pr-1 text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />
                            Saving
                        </span>
                    ) : undefined
                }
            />

            <AppearanceSection />
            <ApiKeysSection />
            <StreamingSection />
            <CacheSection />
            <BackupSection />
            <DataSection />
            <AboutSection />
        </div>
    );
}
