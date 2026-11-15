import { CircleCheckIcon, ClockIcon, DownloadIcon, type LucideIcon, OctagonAlertIcon, Zap } from "lucide-react";
import { memo } from "react";
import type { WebDownloadStatus } from "@/lib/debrid/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<WebDownloadStatus, { icon: LucideIcon; label: string; text: string }> = {
    pending: { icon: ClockIcon, label: "Pending", text: "text-slate-600 dark:text-slate-400" },
    processing: { icon: DownloadIcon, label: "Processing", text: "text-blue-600 dark:text-blue-400" },
    completed: { icon: CircleCheckIcon, label: "Ready", text: "text-green-600 dark:text-green-400" },
    cached: { icon: Zap, label: "Cached", text: "text-emerald-600 dark:text-emerald-400" },
    failed: { icon: OctagonAlertIcon, label: "Failed", text: "text-red-600 dark:text-red-400" },
};

export const LinkStatusLabel = memo(function LinkStatusLabel({ status }: { status: WebDownloadStatus }) {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <span className={cn("inline-flex items-center gap-1 font-medium shrink-0", config.text)}>
            <Icon className="size-3.5 shrink-0" strokeWidth={2.25} />
            {config.label}
        </span>
    );
});
