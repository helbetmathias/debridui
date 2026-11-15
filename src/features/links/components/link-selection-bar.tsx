"use client";

import { Copy, Download, Lock, LockOpen, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SelectionBar, SelectionBarAction } from "@/components/selection-bar";
import type { WebDownload } from "@/lib/debrid/types";
import { copyLinksToClipboard, downloadLinks } from "@/lib/utils";
import { useLinks } from "./links-provider";

interface LinkSelectionBarProps {
    selectedDownloads: WebDownload[];
    onClearSelection: () => void;
}

export function LinkSelectionBar({ selectedDownloads, onClearSelection }: LinkSelectionBarProps) {
    const { deleteDownload, getDownloadLink, retryDownload, setAirlocked } = useLinks();
    const [loading, setLoading] = useState<"copy" | "download" | "retry" | "airlock" | "delete" | null>(null);

    const readyDownloads = selectedDownloads.filter((d) => d.status === "completed" || d.status === "cached");
    const failedDownloads = selectedDownloads.filter((d) => d.status === "failed" && d.originalLink);
    // Airlock needs a cached item; direction follows the selection, unlocking only when all are airlocked
    const airlockTargets = setAirlocked ? readyDownloads : [];
    const isUnairlocking = airlockTargets.length > 0 && airlockTargets.every((d) => d.airlocked);
    const plural = (n: number, unit: string) => `${n} ${unit}${n !== 1 ? "s" : ""}`;

    // Failed lookups are skipped so one bad item doesn't block the rest
    const resolveLinks = async () => {
        const links: { link: string; name: string; size: number }[] = [];
        for (const d of readyDownloads) {
            try {
                links.push({ link: await getDownloadLink(d), name: d.name, size: d.size ?? 0 });
            } catch {}
        }
        if (links.length === 0) toast.error("Failed to get any links");
        return links;
    };

    const withLoading = (action: NonNullable<typeof loading>, fn: () => Promise<void>) => async () => {
        setLoading(action);
        try {
            await fn();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Action failed");
        } finally {
            setLoading(null);
        }
    };

    const handleCopy = withLoading("copy", async () => {
        const links = await resolveLinks();
        if (links.length === 0) return;
        copyLinksToClipboard(links);
        toast.success(`Copied ${links.length} link${links.length !== 1 ? "s" : ""} to clipboard`);
    });

    const handleDownload = withLoading("download", async () => {
        const links = await resolveLinks();
        if (links.length === 0) return;
        downloadLinks(links);
        toast.success(`Started ${links.length} download${links.length !== 1 ? "s" : ""}`);
    });

    // Sequential: each retry re-adds the link, which providers may rate-limit
    const handleRetry = withLoading("retry", async () => {
        let retried = 0;
        for (const d of failedDownloads) {
            try {
                await retryDownload(d);
                retried++;
            } catch (error) {
                toast.error(error instanceof Error ? error.message : `Failed to retry ${d.name}`);
            }
        }
        if (retried > 0) toast.success(`Retrying ${plural(retried, "download")}`);
    });

    const handleAirlock = withLoading("airlock", async () => {
        let updated = 0;
        for (const d of airlockTargets) {
            try {
                await setAirlocked?.({ id: d.id, airlocked: !isUnairlocking });
                updated++;
            } catch {}
        }
        if (updated === 0) throw new Error("Failed to update Airlock");
        toast.success(
            `${isUnairlocking ? "Removed" : "Added"} ${plural(updated, "download")} ${isUnairlocking ? "from" : "to"} Airlock`
        );
    });

    const handleDelete = withLoading("delete", async () => {
        let deleted = 0;
        for (const d of selectedDownloads) {
            try {
                await deleteDownload(d.id);
                deleted++;
            } catch {}
        }
        if (deleted === 0) {
            toast.error("Failed to remove downloads");
            return;
        }
        toast.success(`Removed ${deleted} download${deleted !== 1 ? "s" : ""}`);
        onClearSelection();
    });

    return (
        <SelectionBar
            summary={[{ count: selectedDownloads.length, unit: "download" }]}
            onClear={onClearSelection}
            end={
                <>
                    {failedDownloads.length > 0 && (
                        <SelectionBarAction
                            label="Retry failed"
                            icon={RotateCcw}
                            isPending={loading === "retry"}
                            disabled={loading !== null}
                            onClick={handleRetry}
                        />
                    )}
                    {airlockTargets.length > 0 && (
                        <SelectionBarAction
                            label={isUnairlocking ? "Remove from Airlock" : "Add to Airlock"}
                            icon={isUnairlocking ? LockOpen : Lock}
                            isPending={loading === "airlock"}
                            disabled={loading !== null}
                            onClick={handleAirlock}
                        />
                    )}
                    <SelectionBarAction
                        label="Remove"
                        icon={Trash2}
                        destructive
                        isPending={loading === "delete"}
                        disabled={loading !== null}
                        onClick={handleDelete}
                    />
                </>
            }>
            {readyDownloads.length > 0 && (
                <>
                    <SelectionBarAction
                        label="Copy links"
                        icon={Copy}
                        isPending={loading === "copy"}
                        disabled={loading !== null}
                        onClick={handleCopy}
                    />
                    <SelectionBarAction
                        label="Download"
                        icon={Download}
                        isPending={loading === "download"}
                        disabled={loading !== null}
                        onClick={handleDownload}
                    />
                </>
            )}
        </SelectionBar>
    );
}
