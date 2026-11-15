"use client";

import { Info } from "lucide-react";
import { SectionDivider } from "@/components/layout/section-divider";
import { CachedBadge } from "@/features/addons/components/cached-badge";

export function AddonInfoSection() {
    return (
        <section className="space-y-4">
            <SectionDivider label="Information" />

            <div className="rounded-sm border border-border/50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="space-y-2 text-xs text-muted-foreground">
                        <p>
                            Stremio addons follow a standard protocol. Sources from all enabled addons will be merged
                            and displayed together in the order listed above. Use the arrow buttons to reorder addons.
                        </p>
                        <p>
                            <strong className="text-foreground">Cached sources</strong> (marked with <CachedBadge />)
                            are detected by checking if the source name contains &quot;instant&quot; or &quot;+&quot;,
                            or if the name/description includes ✅ or ⚡️ emojis. Cached sources are instantly available
                            for download from your debrid service.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
