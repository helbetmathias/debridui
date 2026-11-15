"use client";

import { Copy, Download, List, Lock, LockOpen, RotateCw, Trash2 } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { canAirlock, useFileLinkActions, useFileMutationActions } from "@/features/files/hooks/use-file-actions";
import { useListContextMenu } from "@/hooks/use-list-context-menu";
import type { DebridFile } from "@/lib/debrid/types";

/** One menu for the whole list instead of a Radix root + six mutations per row. Rows need `data-file-id`. */
export function FileContextMenu({ files, children }: { files: DebridFile[]; children: React.ReactNode }) {
    const { targetId, onOpenChange, triggerProps } = useListContextMenu("data-file-id");
    const file = files.find((f) => f.id === targetId);
    const { copyMutation, downloadMutation, playlistMutation } = useFileLinkActions(targetId ?? "", {
        fileName: file?.name,
    });
    const { deleteMutation, retryMutation, airlockMutation, supportsAirlock } = useFileMutationActions();

    return (
        <ContextMenu onOpenChange={onOpenChange}>
            <ContextMenuTrigger asChild {...triggerProps}>
                {children}
            </ContextMenuTrigger>
            {file && (
                <ContextMenuContent className="w-60">
                    {file.status === "completed" && (
                        <>
                            <ContextMenuItem onSelect={() => downloadMutation.mutate()}>
                                <Download />
                                Download
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => copyMutation.mutate()}>
                                <Copy />
                                Copy links
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => playlistMutation.mutate()}>
                                <List />
                                Download playlist
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                        </>
                    )}
                    {file.status === "failed" && (
                        <ContextMenuItem onSelect={() => retryMutation.mutate([file.id])}>
                            <RotateCw />
                            Retry
                        </ContextMenuItem>
                    )}
                    {supportsAirlock && canAirlock(file) && (
                        <ContextMenuItem
                            onSelect={() => airlockMutation.mutate({ fileIds: [file.id], airlocked: !file.airlocked })}>
                            {file.airlocked ? <LockOpen /> : <Lock />}
                            {file.airlocked ? "Remove from Airlock" : "Add to Airlock"}
                        </ContextMenuItem>
                    )}
                    {(file.status === "failed" || (supportsAirlock && canAirlock(file))) && <ContextMenuSeparator />}
                    <ContextMenuItem variant="destructive" onSelect={() => deleteMutation.mutate([file.id])}>
                        <Trash2 />
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            )}
        </ContextMenu>
    );
}
