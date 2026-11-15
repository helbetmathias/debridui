"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Clock } from "lucide-react";
import { SectionDivider } from "@/components/layout/section-divider";

// Injected at build time via next.config.ts; falls back to now in dev
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();

export function AboutSection() {
    const buildDate = new Date(BUILD_TIME);

    return (
        <section className="space-y-4">
            <SectionDivider label="About" />

            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Clock className="size-3.5 shrink-0" />
                    <span>Last updated {formatDistanceToNow(buildDate, { addSuffix: true })}</span>
                </div>
                <span className="text-border hidden sm:inline">·</span>
                <span className="text-xs pl-5.5 sm:pl-0">{format(buildDate, "PPpp")}</span>
            </div>
        </section>
    );
}
