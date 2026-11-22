import { toast } from "sonner";
import { create } from "zustand";
import { getStreamCapableAddons } from "@/features/addons/hooks/use-addons";
import { findRememberedRelease, rememberPlayedRelease } from "@/features/media/utils/remembered-release";
import { selectBestSource } from "@/features/media/utils/source-selector";
import { usePreviewStore } from "@/features/preview/stores/preview";
import { AddonClient } from "@/lib/addons/client";
import { parseStreams } from "@/lib/addons/parser";
import type { Addon, AddonSource, TvSearchParams } from "@/lib/addons/types";
import type { Media } from "@/lib/media";
import { openInPlayer } from "@/lib/media/player";
import { queryClient } from "@/lib/query-client";
import { MediaPlayer } from "@/lib/schemas";
import { useSettingsStore } from "@/stores/settings";
import { FileType } from "@/types";

export interface StreamingRequest {
    imdbId: string;
    type: "movie" | "show";
    media: Media;
    tvParams?: TvSearchParams;
    resume?: boolean;
}

interface StreamingState {
    activeRequest: StreamingRequest | null;
    selectedSource: AddonSource | null;

    play: (request: StreamingRequest, addons: Addon[], userId?: string) => Promise<void>;
    playSource: (source: AddonSource, request: StreamingRequest, userId?: string) => void;
    cancel: () => void;
}

// Module-level state for request cancellation and toast timing
let toastId: string | number | null = null;
let toastCreatedAt = 0;
let requestId = 0;

// Minimum time toast must be visible before dismissing (allows mount animation)
const MIN_TOAST_DURATION = 300;
const TOAST_POSITION = "bottom-center" as const;

function formatTitle(request: StreamingRequest, includeYear = false): string {
    const title = request.media.title || "Untitled";
    const yearSuffix = includeYear && request.media.year ? ` (${request.media.year})` : "";
    const baseTitle = yearSuffix && !title.endsWith(yearSuffix) ? title + yearSuffix : title;

    if (request.type === "show" && request.tvParams) {
        const seasonStr = String(request.tvParams.season).padStart(2, "0");
        const episodeStr = String(request.tvParams.episode).padStart(2, "0");
        let title = `${baseTitle} S${seasonStr}E${episodeStr}`;

        if (request.tvParams.title) {
            title = `${title} - ${request.tvParams.title}`;
        }

        return title;
    }

    return baseTitle;
}

function dismissToast() {
    if (!toastId) return;

    const elapsed = Date.now() - toastCreatedAt;
    const id = toastId;
    toastId = null;

    if (elapsed < MIN_TOAST_DURATION) {
        setTimeout(() => toast.dismiss(id), MIN_TOAST_DURATION - elapsed);
    } else {
        toast.dismiss(id);
    }
}

interface ShowSourceToastParams {
    source: AddonSource;
    title: string;
    isCached: boolean;
    autoPlay: boolean;
    allowUncached: boolean;
    resumeChoice?: string;
    onPlay: () => void;
}

function showSourceToast({
    source,
    title,
    isCached,
    autoPlay,
    allowUncached,
    resumeChoice,
    onPlay,
}: ShowSourceToastParams) {
    const meta = [source.addonName, source.resolution, source.quality, source.size].filter(Boolean).join(" · ");
    const description = [meta, isCached ? "Cached" : "Not cached"].filter(Boolean).join(" · ");
    if (autoPlay && (isCached || allowUncached)) {
        dismissToast();
        onPlay();
        if (resumeChoice) toast.success(resumeChoice, { position: TOAST_POSITION, description, duration: 5_000 });
        return;
    }

    const detail = [resumeChoice, description].filter(Boolean).join(" · ");

    if (isCached || allowUncached) {
        toast.success(title, {
            id: toastId ?? undefined,
            position: TOAST_POSITION,
            description: detail,
            action: { label: "Play", onClick: onPlay },
            duration: Infinity,
        });
    } else {
        toast.warning(title, {
            id: toastId ?? undefined,
            position: TOAST_POSITION,
            description: detail,
            action: { label: "Play Anyway", onClick: onPlay },
            duration: Infinity,
        });
    }
}

export const useStreamingStore = create<StreamingState>()((set, get) => ({
    activeRequest: null,
    selectedSource: null,

    playSource: (source, request, userId) => {
        if (!source.url) return;

        const mediaPlayer = useSettingsStore.getState().get("mediaPlayer");

        const title = formatTitle(request);

        // Build descriptive filename with source metadata
        const metaLabel = [source.resolution, source.quality, source.size].filter(Boolean).join(" ");
        const fileName = metaLabel ? `${title} [${metaLabel}]` : title;

        if (mediaPlayer === MediaPlayer.BROWSER) {
            usePreviewStore.getState().openSinglePreview({
                url: source.url,
                title: fileName,
                fileType: FileType.VIDEO,
            });
        } else {
            openInPlayer({
                url: source.url,
                // The series premiere year helps MPS reject same-named shows.
                fileName: mediaPlayer === MediaPlayer.MPV_SIMKL ? formatTitle(request, true) : fileName,
                player: mediaPlayer,
            });
        }
        void rememberPlayedRelease(request, source, userId);
    },

    play: async (request, addons, userId) => {
        const { imdbId, type, tvParams, resume } = request;
        const title = formatTitle(request);

        // Filter to enabled addons, then to stream-capable via manifest check (cache-first)
        const enabled = addons.filter((a) => a.enabled).sort((a, b) => a.order - b.order);
        const enabledAddons = await getStreamCapableAddons(enabled, queryClient);

        if (enabledAddons.length === 0) {
            toast.error("No addons enabled", {
                description: "Configure addons with stream support in settings",
            });
            return;
        }

        // Cancel previous request: dismiss old toast and increment request ID
        dismissToast();
        const currentRequestId = ++requestId;

        set({ activeRequest: request, selectedSource: null });
        toastId = toast.loading("Finding best source...", {
            description: title,
            position: TOAST_POSITION,
            cancel: { label: "Cancel", onClick: () => get().cancel() },
        });
        toastCreatedAt = Date.now();

        try {
            const sourcePromises = enabledAddons.map(async (addon) => {
                const queryKey = ["addon", addon.id, "sources", imdbId, type, tvParams] as const;

                if (!resume) {
                    const cached = queryClient.getQueryData<AddonSource[]>(queryKey);
                    if (cached) return cached;
                }

                try {
                    const client = new AddonClient({ url: addon.url });
                    const response = await client.fetchStreams(imdbId, type, tvParams, resume ? "no-store" : undefined);
                    const parsed = parseStreams(response.streams, addon.id, addon.name);
                    queryClient.setQueryData(queryKey, parsed);
                    return parsed;
                } catch {
                    return [] as AddonSource[];
                }
            });

            const results = await Promise.all(sourcePromises);

            // Ignore results if a newer request was started
            if (currentRequestId !== requestId) return;

            const allSources = results.flat();

            const streamingSettings = useSettingsStore.getState().get("streaming");
            const result = selectBestSource(allSources, streamingSettings);

            if (!result.hasMatches) {
                set({ activeRequest: null });
                toast.error("No sources found", {
                    id: toastId ?? undefined,
                    position: TOAST_POSITION,
                    description:
                        allSources.length > 0
                            ? "No sources match your quality preferences"
                            : "No sources available from enabled addons",
                });
                return;
            }

            const remembered = resume
                ? await findRememberedRelease(
                      request,
                      streamingSettings.allowUncached
                          ? [...result.cachedMatches, ...result.uncachedMatches]
                          : result.cachedMatches,
                      userId
                  )
                : undefined;
            if (currentRequestId !== requestId) return;

            const source = remembered ?? result.source!;

            set({ activeRequest: null, selectedSource: source });

            showSourceToast({
                source,
                title,
                isCached: !!source.isCached,
                autoPlay: streamingSettings.autoPlay,
                allowUncached: streamingSettings.allowUncached,
                resumeChoice: resume ? (remembered ? "Reused last source" : "Picked best available source") : undefined,
                onPlay: () => get().playSource(source, request, userId),
            });
        } catch (error) {
            // Only show error if this is still the current request
            if (currentRequestId === requestId) {
                toast.error("Failed to fetch sources", {
                    id: toastId ?? undefined,
                    position: TOAST_POSITION,
                    description: error instanceof Error ? error.message : "Unknown error",
                });
                set({ activeRequest: null });
            }
        }
    },

    cancel: () => {
        requestId++; // Increment to ignore pending request results
        set({ selectedSource: null, activeRequest: null });
        dismissToast();
    },
}));
