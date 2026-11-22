"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { memo, useEffect, useRef, useState } from "react";
import { SectionDivider } from "@/components/layout/section-divider";
import { ScrollCarousel } from "@/components/scroll-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaRecommendations } from "@/features/media/hooks/use-media";
import { useSimklRecommendations } from "@/features/media/hooks/use-simkl";
import { MediaCard } from "./media-card";

interface RelatedMediaSectionProps {
    mediaId: string;
    type: "movie" | "show";
}

export const RelatedMediaSection = memo(function RelatedMediaSection({ mediaId, type }: RelatedMediaSectionProps) {
    const sectionRef = useRef<HTMLElement>(null);
    const [shouldLoad, setShouldLoad] = useState(false);
    const simkl = useSimklRecommendations(mediaId, type, shouldLoad);
    const shouldLoadTmdb = shouldLoad && !simkl.isPending && !simkl.items?.length;
    const tmdb = useMediaRecommendations(mediaId, type, shouldLoadTmdb);
    const isLoading = simkl.isPending || (shouldLoadTmdb && tmdb.isLoading);
    const cards = simkl.items?.length
        ? simkl.items.map(({ media, simklUrl }) => ({ media, simklUrl, key: simklUrl }))
        : tmdb.data?.flatMap((item) => {
              const media = type === "movie" ? item.movie : item.show;
              return media
                  ? [{ media, simklUrl: undefined, key: media.ids?.tmdb ?? `${media.title}-${media.year}` }]
                  : [];
          });

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

    if (shouldLoad && !isLoading && !cards?.length) return null;

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
                        : cards?.map(({ media, simklUrl, key }) => (
                              <div key={key} className="w-28 shrink-0 sm:w-32 md:w-36">
                                  <MediaCard media={media} type={type} />
                                  {simklUrl && (
                                      <a
                                          href={simklUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          aria-label={`View ${media.title} on SIMKL (opens in a new tab)`}
                                          className="mt-1 inline-flex items-center gap-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline">
                                          <Image
                                              src="https://us.simkl.in/img_favicon/v2/favicon-192x192.png"
                                              width={12}
                                              height={12}
                                              alt=""
                                              loading="lazy"
                                              unoptimized
                                          />
                                          SIMKL <ArrowUpRight aria-hidden className="size-3" />
                                      </a>
                                  )}
                              </div>
                          ))}
                </div>
            </ScrollCarousel>
        </section>
    );
});
