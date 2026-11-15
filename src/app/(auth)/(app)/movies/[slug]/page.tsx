"use client";

import { useParams } from "next/navigation";
import { MediaDetailView } from "@/features/media/components/media-detail-view";

export default function MoviePage() {
    const { slug } = useParams<{ slug: string }>();
    return <MediaDetailView id={slug} type="movie" />;
}
