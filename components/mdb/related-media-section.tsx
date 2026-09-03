"use client";

import { memo, useEffect, useRef, useState } from "react";
import { ScrollCarousel } from "@/components/common/scroll-carousel";
import { SectionDivider } from "@/components/section-divider";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaRecommendations } from "@/hooks/use-media";
import { MediaCard } from "./media-card";

interface RelatedMediaSectionProps {
    mediaId: string;
    type: "movie" | "show";
}

export const RelatedMediaSection = memo(function RelatedMediaSection({ mediaId, type }: RelatedMediaSectionProps) {
    const sectionRef = useRef<HTMLElement>(null);
    const [shouldLoad, setShouldLoad] = useState(false);
    const { data, isLoading, error } = useMediaRecommendations(mediaId, type, shouldLoad);

    useEffect(() => {
        const section = sectionRef.current;
        if (!section || shouldLoad) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry?.isIntersecting) return;
                setShouldLoad(true);
                observer.disconnect();
            },
            { rootMargin: "600px 0px" }
        );

        observer.observe(section);
        return () => observer.disconnect();
    }, [shouldLoad]);

    if (shouldLoad && !isLoading && (error || !data?.length)) return null;

    return (
        <section ref={sectionRef} className="relative z-10 space-y-6">
            <SectionDivider label="More Like This" />
            <ScrollCarousel className="-mx-4 lg:mx-0">
                <div className="flex w-max gap-3 px-4 pb-4 lg:pl-2 lg:pr-0">
                    {!shouldLoad || isLoading
                        ? Array.from({ length: 8 }).map((_, index) => (
                              <Skeleton
                                  // biome-ignore lint/suspicious/noArrayIndexKey: position-based key in static placeholder list
                                  key={index}
                                  className="w-28 shrink-0 aspect-2/3 rounded-sm sm:w-32 md:w-36"
                              />
                          ))
                        : data?.map((item) => {
                              const media = type === "movie" ? item.movie : item.show;
                              if (!media) return null;
                              return (
                                  <MediaCard
                                      key={media.ids?.tmdb ?? `${media.title}-${media.year}`}
                                      media={media}
                                      type={type}
                                      className="w-28 shrink-0 sm:w-32 md:w-36"
                                  />
                              );
                          })}
                </div>
            </ScrollCarousel>
        </section>
    );
});
