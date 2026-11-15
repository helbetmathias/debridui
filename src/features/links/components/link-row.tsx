"use client";

import {
    Copy,
    Download,
    Loader2,
    Lock,
    LockOpen,
    type LucideIcon,
    PlayCircle,
    RotateCw,
    Trash2,
    View,
} from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { type LinkAction, useLinkActions } from "@/features/links/hooks/use-link-actions";
import type { WebDownload } from "@/lib/debrid/types";
import { cn, formatSize } from "@/lib/utils";
import { LinkStatusLabel } from "./link-status-label";

interface LinkRowProps {
    download: WebDownload;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
}

function hostOf(url: string) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return undefined;
    }
}

function IconAction({
    icon: Icon,
    label,
    busy,
    className,
    ...props
}: { icon: LucideIcon; label: string; busy: boolean } & React.ComponentProps<typeof Button>) {
    return (
        <Button
            variant="ghost"
            size="icon"
            title={label}
            aria-label={label}
            className={cn("size-8 text-muted-foreground hover:text-foreground", className)}
            {...props}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
        </Button>
    );
}

export const LinkRow = memo(function LinkRow({ download, isSelected = false, onToggleSelect }: LinkRowProps) {
    const [busy, setBusy] = useState<LinkAction | null>(null);
    const [errorExpanded, setErrorExpanded] = useState(false);
    const { actions, supportsAirlock, canPreview, usesExternalPlayer } = useLinkActions();

    const isReady = download.status === "completed" || download.status === "cached";
    const isFailed = download.status === "failed";
    const showProgress = download.status === "processing" && download.progress !== undefined;
    const host = download.host ?? hostOf(download.originalLink);
    const external = usesExternalPlayer(download);

    const run = (action: LinkAction) => async () => {
        setBusy(action);
        await actions[action](download);
        setBusy(null);
    };

    const isFetchingLink = busy === "copy" || busy === "download" || busy === "preview";

    return (
        <div
            data-download-id={download.id}
            className="flex items-start gap-3 px-3 py-2.5 border-b border-border/50 last:border-b-0 transition-colors duration-300 bg-muted/30 hover:bg-card data-menu-open:bg-muted/40">
            {onToggleSelect && (
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(download.id)}
                    aria-label={`Select ${download.name}`}
                    className="mt-0.5"
                />
            )}

            {/* Mobile: name spans full width, actions share the meta row. sm+: actions span name + meta rows */}
            <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <p
                    className="col-span-2 sm:col-span-1 text-sm font-medium leading-snug line-clamp-2 wrap-break-word"
                    title={download.name}>
                    {download.name}
                </p>

                <div className="col-start-1 flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground">
                    <LinkStatusLabel status={download.status} />
                    {showProgress && (
                        <>
                            <span className="text-border">·</span>
                            <span className="tabular-nums text-foreground/70">{Math.round(download.progress!)}%</span>
                        </>
                    )}
                    {download.size ? (
                        <>
                            <span className="text-border">·</span>
                            <span className="tabular-nums shrink-0">{formatSize(download.size)}</span>
                        </>
                    ) : null}
                    {host && (
                        <>
                            <span className="text-border">·</span>
                            <button
                                type="button"
                                onClick={run("copyOriginal")}
                                title={download.originalLink}
                                className="truncate cursor-pointer hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                                {host}
                            </button>
                        </>
                    )}
                </div>

                <div className="row-start-2 col-start-2 sm:row-start-1 sm:row-span-2 flex items-center gap-0.5 -my-1 -mr-1.5">
                    {isFailed && download.originalLink && (
                        <IconAction
                            icon={RotateCw}
                            label="Retry"
                            busy={busy === "retry"}
                            disabled={busy === "retry"}
                            onClick={run("retry")}
                        />
                    )}
                    {isReady && (
                        <>
                            {canPreview(download) && (
                                <IconAction
                                    icon={external ? PlayCircle : View}
                                    label={external ? "Play" : "Preview"}
                                    busy={busy === "preview"}
                                    disabled={isFetchingLink}
                                    onClick={run("preview")}
                                />
                            )}
                            <IconAction
                                icon={Copy}
                                label="Copy link"
                                busy={busy === "copy"}
                                disabled={isFetchingLink}
                                onClick={run("copy")}
                            />
                            <IconAction
                                icon={Download}
                                label="Download"
                                busy={busy === "download"}
                                disabled={isFetchingLink}
                                onClick={run("download")}
                            />
                            {supportsAirlock && (
                                <IconAction
                                    icon={download.airlocked ? Lock : LockOpen}
                                    label={download.airlocked ? "Remove from Airlock" : "Add to Airlock"}
                                    busy={busy === "airlock"}
                                    disabled={busy === "airlock"}
                                    onClick={run("airlock")}
                                    className={cn(download.airlocked && "text-foreground")}
                                />
                            )}
                        </>
                    )}
                    <IconAction
                        icon={Trash2}
                        label="Remove"
                        busy={busy === "delete"}
                        disabled={busy === "delete"}
                        onClick={run("delete")}
                        className="hover:text-destructive"
                    />
                </div>

                {download.error && (
                    <button
                        type="button"
                        onClick={() => setErrorExpanded((v) => !v)}
                        aria-expanded={errorExpanded}
                        className={cn(
                            "col-span-2 sm:col-span-1 cursor-pointer mt-0.5 pl-2 border-l-2 border-destructive/40 text-left text-xs text-destructive/80 hover:text-destructive wrap-break-word transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-r-sm",
                            !errorExpanded && "line-clamp-1"
                        )}>
                        {download.error}
                    </button>
                )}

                {showProgress && (
                    <div className="col-span-2 sm:col-span-1 mt-1 h-0.5 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full bg-primary transition-[width] duration-500"
                            style={{ width: `${download.progress}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

export function LinkRowSkeleton() {
    return (
        <div className="flex items-start gap-3 px-3 py-2.5 border-b border-border/50 last:border-b-0">
            <Skeleton className="size-4 rounded-sm mt-0.5" />
            <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                <Skeleton className="col-span-2 sm:col-span-1 h-4 w-3/4" />
                <Skeleton className="col-start-1 h-3 w-40" />
                <div className="row-start-2 col-start-2 sm:row-start-1 sm:row-span-2 flex gap-0.5">
                    <Skeleton className="size-8 rounded-sm" />
                    <Skeleton className="size-8 rounded-sm" />
                    <Skeleton className="size-8 rounded-sm" />
                </div>
            </div>
        </div>
    );
}
