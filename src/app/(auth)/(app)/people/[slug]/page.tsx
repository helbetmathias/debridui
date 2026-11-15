"use client";
import { useParams } from "next/navigation";
import { memo } from "react";
import { MediaFooter } from "@/features/media/components/media-footer";
import { useMediaPerson } from "@/features/media/hooks/use-media";
import { FilmographyTabs } from "./_components/filmography";
import { PersonHeader } from "./_components/person-header";

const PersonPage = memo(function PersonPage() {
    const params = useParams();
    const slug = params.slug as string;

    const { data: person, isLoading, error } = useMediaPerson(slug);

    if (error) {
        return (
            <div className="w-full lg:px-6 max-w-6xl mx-auto">
                <div className="py-20 text-center">
                    <h1 className="text-2xl font-light text-muted-foreground">Person not found</h1>
                    <p className="text-sm text-muted-foreground/60 mt-2">
                        The person you&apos;re looking for doesn&apos;t exist or has been removed.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full lg:px-6 max-w-6xl mx-auto">
            <PersonHeader person={person} isLoading={isLoading} />

            <div className="mt-8">
                <FilmographyTabs slug={slug} />
            </div>

            <MediaFooter className="py-12 mt-8 border-t border-border/50" />
        </div>
    );
});

export default PersonPage;
