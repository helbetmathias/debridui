"use client";

import { Copy, Download, ListMusic, Lock, LockOpen, RotateCcw, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { SelectionBar, SelectionBarAction } from "@/components/selection-bar";
import { canAirlock, useFileLinkActions, useFileMutationActions } from "@/features/files/hooks/use-file-actions";
import { useSelectionStore } from "@/features/files/stores/selection";
import type { DebridFile } from "@/lib/debrid/types";

interface FileSelectionBarProps {
    files: DebridFile[];
}

export function FileSelectionBar({ files }: FileSelectionBarProps) {
    const { selectedFileIds, selectedNodesByFile, registeredNodesByFile, clearAll } = useSelectionStore(
        useShallow((state) => ({
            selectedFileIds: state.selectedFileIds,
            selectedNodesByFile: state.selectedNodesByFile,
            registeredNodesByFile: state.registeredNodesByFile,
            clearAll: state.clearAll,
        }))
    );

    // Scoped to the visible page; the store spans pages
    const selectedNodeIdsArray = useMemo(
        () => files.flatMap((file) => Array.from(selectedNodesByFile.get(file.id) ?? [])),
        [files, selectedNodesByFile]
    );

    const fullySelectedFileIds = useMemo(() => {
        return Array.from(selectedFileIds).filter((fileId) => {
            const selectedNodes = selectedNodesByFile.get(fileId);
            const totalNodes = registeredNodesByFile.get(fileId)?.length || 0;
            return totalNodes === 0 || (selectedNodes && selectedNodes.size === totalNodes);
        });
    }, [selectedFileIds, selectedNodesByFile, registeredNodesByFile]);

    const hasNodes = selectedNodeIdsArray.length > 0;

    const { fullySelectedFiles, canRetry } = useMemo(() => {
        const fullySelectedFiles = files.filter((file) => fullySelectedFileIds.includes(file.id));
        const allSelectedAreFailed =
            fullySelectedFiles.length > 0 && fullySelectedFiles.every((file) => file.status === "failed");

        return {
            fullySelectedFiles,
            canRetry: allSelectedAreFailed ? fullySelectedFiles : [],
        };
    }, [files, fullySelectedFileIds]);

    const { deleteMutation, retryMutation, airlockMutation, supportsAirlock } = useFileMutationActions();
    const { copyMutation, downloadMutation, playlistMutation } = useFileLinkActions(selectedNodeIdsArray);

    // Toggle direction follows the selection: unlock only when every eligible file is already airlocked
    const airlockTargets = useMemo(
        () => (supportsAirlock ? fullySelectedFiles.filter(canAirlock) : []),
        [supportsAirlock, fullySelectedFiles]
    );
    const isUnairlocking = airlockTargets.length > 0 && airlockTargets.every((file) => file.airlocked);

    return (
        <SelectionBar
            summary={[
                { count: selectedNodeIdsArray.length, unit: "link" },
                { count: fullySelectedFiles.length, unit: "file" },
            ]}
            onClear={clearAll}
            end={
                (canRetry.length > 0 || airlockTargets.length > 0 || fullySelectedFiles.length > 0) && (
                    <>
                        {canRetry.length > 0 && (
                            <SelectionBarAction
                                label="Retry failed"
                                icon={RotateCcw}
                                isPending={retryMutation.isPending}
                                onClick={() => retryMutation.mutate(canRetry.map((f) => f.id))}
                            />
                        )}
                        {airlockTargets.length > 0 && (
                            <SelectionBarAction
                                label={isUnairlocking ? "Remove from Airlock" : "Add to Airlock"}
                                icon={isUnairlocking ? LockOpen : Lock}
                                isPending={airlockMutation.isPending}
                                onClick={() =>
                                    airlockMutation.mutate({
                                        fileIds: airlockTargets.map((f) => f.id),
                                        airlocked: !isUnairlocking,
                                    })
                                }
                            />
                        )}
                        {fullySelectedFiles.length > 0 && (
                            <SelectionBarAction
                                label="Delete"
                                icon={Trash2}
                                destructive
                                isPending={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(fullySelectedFiles.map((f) => f.id))}
                            />
                        )}
                    </>
                )
            }>
            {hasNodes && (
                <>
                    <SelectionBarAction
                        label="Copy links"
                        icon={Copy}
                        isPending={copyMutation.isPending}
                        onClick={() => copyMutation.mutate()}
                    />
                    <SelectionBarAction
                        label="Download"
                        icon={Download}
                        isPending={downloadMutation.isPending}
                        onClick={() => downloadMutation.mutate()}
                    />
                    <SelectionBarAction
                        label="Download M3U playlist"
                        icon={ListMusic}
                        isPending={playlistMutation.isPending}
                        onClick={() => playlistMutation.mutate()}
                    />
                </>
            )}
        </SelectionBar>
    );
}
