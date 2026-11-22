"use client";

import { Slot } from "radix-ui";
import { memo, type ReactElement, useCallback } from "react";
import { useUserAddons } from "@/features/addons/hooks/use-addons";
import { useAuth } from "@/features/auth/components/auth-provider";
import { type StreamingRequest, useStreamingStore } from "@/features/media/stores/streaming";

interface WatchButtonProps {
    request: StreamingRequest;
    children: ReactElement<{ onClick?: React.MouseEventHandler; disabled?: boolean; "data-loading"?: boolean }>;
}

export const WatchButton = memo(function WatchButton({ request, children }: WatchButtonProps) {
    const play = useStreamingStore((s) => s.play);
    const activeRequest = useStreamingStore((s) => s.activeRequest);
    const userId = useAuth().session?.user.id;
    const { data: addons = [], isPending: isAddonsLoading } = useUserAddons();

    const isLoading =
        isAddonsLoading ||
        (activeRequest?.imdbId === request.imdbId &&
            activeRequest?.type === request.type &&
            activeRequest?.tvParams?.season === request.tvParams?.season &&
            activeRequest?.tvParams?.episode === request.tvParams?.episode);

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (isLoading) return;
            play(request, addons, userId);
        },
        [play, request, addons, isLoading, userId]
    );

    return (
        <Slot.Root onClick={handleClick} data-loading={isLoading || undefined} data-disabled={isLoading || undefined}>
            {children}
        </Slot.Root>
    );
});
