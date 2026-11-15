"use client";

import { Suspense } from "react";
import { MediaDetails } from "@/features/media/components/media-details";
import { MediaFooter } from "@/features/media/components/media-footer";
import { useMediaDetails } from "@/features/media/hooks/use-media";
import type { MediaIdType } from "@/lib/media";

interface MediaDetailViewProps {
    id: string;
    type?: "movie" | "show";
    idType?: MediaIdType;
}

// Shared detail page body for all media routes (/movies, /shows, /title).
export function MediaDetailView({ id, type, idType }: MediaDetailViewProps) {
    const { media, type: resolvedType, error } = useMediaDetails({ id, type, idType });

    return (
        <div className="w-full lg:px-6 max-w-6xl mx-auto">
            <Suspense fallback={null}>
                <MediaDetails media={media} mediaId={id} type={resolvedType} error={error} />
            </Suspense>
            <MediaFooter className="py-12 mt-8 border-t border-border/50" />
        </div>
    );
}
