"use client";

import { toast } from "sonner";
import { useLinks } from "@/features/links/components/links-provider";
import { usePreviewStore } from "@/features/preview/stores/preview";
import { canPreviewFile } from "@/features/preview/utils/registry";
import type { WebDownload } from "@/lib/debrid/types";
import { openInPlayer } from "@/lib/media/player";
import { MediaPlayer } from "@/lib/schemas";
import { downloadLinks, getFileType } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { FileType } from "@/types";

export type LinkAction = "preview" | "copy" | "copyOriginal" | "download" | "airlock" | "retry" | "delete";

/** Shared by row buttons and the list context menu. Actions toast their own errors and never throw. */
export function useLinkActions() {
    const { getDownloadLink, deleteDownload, retryDownload, setAirlocked } = useLinks();
    const openSinglePreview = usePreviewStore((s) => s.openSinglePreview);
    const mediaPlayer = useSettingsStore((s) => s.settings.mediaPlayer);

    const guard = async (fn: () => Promise<unknown>, fallback: string) => {
        try {
            await fn();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : fallback);
        }
    };

    const usesExternalPlayer = (d: WebDownload) =>
        getFileType(d.name) === FileType.VIDEO && mediaPlayer !== MediaPlayer.BROWSER;

    const actions: Record<LinkAction, (d: WebDownload) => Promise<void>> = {
        preview: (d) =>
            guard(async () => {
                const url = await getDownloadLink(d);
                if (usesExternalPlayer(d)) openInPlayer({ url, fileName: d.name, player: mediaPlayer });
                else openSinglePreview({ url, title: d.name, fileType: getFileType(d.name) });
            }, "Failed to get link"),
        copy: (d) =>
            guard(async () => {
                await navigator.clipboard.writeText(await getDownloadLink(d));
                toast.success("Link copied to clipboard");
            }, "Failed to get link"),
        copyOriginal: (d) =>
            guard(async () => {
                await navigator.clipboard.writeText(d.originalLink);
                toast.success("Original link copied");
            }, "Failed to copy link"),
        download: (d) =>
            guard(async () => downloadLinks([{ link: await getDownloadLink(d), name: d.name }]), "Failed to get link"),
        airlock: (d) =>
            guard(async () => {
                await setAirlocked?.({ id: d.id, airlocked: !d.airlocked });
                toast.success(d.airlocked ? "Removed from Airlock" : "Added to Airlock");
            }, "Failed to update Airlock"),
        retry: (d) =>
            guard(async () => {
                await retryDownload(d);
                toast.success("Retrying");
            }, "Failed to retry"),
        delete: (d) =>
            guard(async () => {
                await deleteDownload(d.id);
                toast.success("Removed");
            }, "Failed to remove"),
    };

    return {
        actions,
        supportsAirlock: setAirlocked !== null,
        canPreview: (d: WebDownload) => canPreviewFile(getFileType(d.name)),
        usesExternalPlayer,
    };
}
