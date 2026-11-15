"use client";

import { memo } from "react";

// Content section with modern divider
interface ContentSectionProps {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    delay?: number;
}

export const ContentSection = memo(function ContentSection({
    label,
    icon: Icon,
    children,
    delay = 0,
}: ContentSectionProps) {
    return (
        <div
            className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-4"
            style={{
                animationDelay: `${delay}ms`,
                animationDuration: "600ms",
                animationFillMode: "backwards",
            }}>
            {/* Section divider with animated accent */}
            <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-linear-to-r from-transparent via-border/50 to-border/50" />
                <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm">
                    {Icon && (
                        <span className="text-primary">
                            <Icon className="size-3.5" />
                        </span>
                    )}
                    <span className="text-xs tracking-widest uppercase text-muted-foreground">{label}</span>
                </div>
                <div className="h-px flex-1 bg-linear-to-l from-transparent via-border/50 to-border/50" />
            </div>
            {children}
        </div>
    );
});
