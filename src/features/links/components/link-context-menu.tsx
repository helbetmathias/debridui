"use client";

import { Copy, Download, Link, Lock, LockOpen, PlayCircle, RotateCw, Trash2, View } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useLinkActions } from "@/features/links/hooks/use-link-actions";
import { useListContextMenu } from "@/hooks/use-list-context-menu";
import type { WebDownload } from "@/lib/debrid/types";

/** One menu for the whole list instead of a Radix root per row. Rows need `data-download-id`. */
export function LinkContextMenu({ downloads, children }: { downloads: WebDownload[]; children: React.ReactNode }) {
    const { targetId, onOpenChange, triggerProps } = useListContextMenu("data-download-id");
    const { actions, supportsAirlock, canPreview, usesExternalPlayer } = useLinkActions();
    const target = downloads.find((d) => d.id === targetId);

    const isReady = target?.status === "completed" || target?.status === "cached";
    const external = target ? usesExternalPlayer(target) : false;

    return (
        <ContextMenu onOpenChange={onOpenChange}>
            <ContextMenuTrigger asChild {...triggerProps}>
                {children}
            </ContextMenuTrigger>
            {target && (
                <ContextMenuContent className="w-60">
                    {isReady && (
                        <>
                            {canPreview(target) && (
                                <ContextMenuItem onSelect={() => actions.preview(target)}>
                                    {external ? <PlayCircle /> : <View />}
                                    {external ? "Play" : "Preview"}
                                </ContextMenuItem>
                            )}
                            <ContextMenuItem onSelect={() => actions.download(target)}>
                                <Download />
                                Download
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onSelect={() => actions.copy(target)}>
                                <Copy />
                                Copy link
                            </ContextMenuItem>
                        </>
                    )}
                    {target.originalLink && (
                        <ContextMenuItem onSelect={() => actions.copyOriginal(target)}>
                            <Link />
                            Copy original link
                        </ContextMenuItem>
                    )}
                    {((isReady && supportsAirlock) || (target.status === "failed" && target.originalLink)) && (
                        <ContextMenuSeparator />
                    )}
                    {isReady && supportsAirlock && (
                        <ContextMenuItem onSelect={() => actions.airlock(target)}>
                            {target.airlocked ? <LockOpen /> : <Lock />}
                            {target.airlocked ? "Remove from Airlock" : "Add to Airlock"}
                        </ContextMenuItem>
                    )}
                    {target.status === "failed" && target.originalLink && (
                        <ContextMenuItem onSelect={() => actions.retry(target)}>
                            <RotateCw />
                            Retry
                        </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" onSelect={() => actions.delete(target)}>
                        <Trash2 />
                        Remove
                    </ContextMenuItem>
                </ContextMenuContent>
            )}
        </ContextMenu>
    );
}
