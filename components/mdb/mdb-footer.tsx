import { memo } from "react";
import { cn } from "@/lib/utils";

interface MdbFooterProps {
    className?: string;
}

export const MdbFooter = memo(function MdbFooter({ className }: MdbFooterProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground", className)}>
            <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <img src="https://cdn.simpleicons.org/themoviedatabase" alt="TMDB" className="h-5 w-5" />
                <span className="font-medium">Powered by TMDB</span>
            </a>
            <span className="text-center text-xs">
                This product uses the TMDB API but is not endorsed or certified by TMDB.
            </span>
        </div>
    );
});
