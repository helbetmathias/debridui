"use client";

import { HardDrive } from "lucide-react";
import { memo } from "react";
import type { DebridFile } from "@/lib/debrid/types";
import { cn, formatSize } from "@/lib/utils";
import { SearchItemWrapper } from "./search-item-wrapper";

interface SearchFileItemProps {
    file: DebridFile;
    onSelect: (file: DebridFile) => void;
    variant?: "modal" | "page";
    className?: string;
}

export const SearchFileItem = memo(function SearchFileItem({
    file,
    onSelect,
    variant = "modal",
    className,
}: SearchFileItemProps) {
    const sizeDisplay = formatSize(file.size);

    return (
        <SearchItemWrapper
            data={file}
            variant={variant}
            onSelect={onSelect}
            commandValue={`file-${file.id}`}
            commandKeywords={[file.name, file.id.toString()]}
            className={cn("py-2.5 lg:py-3", className)}>
            <div data-file-id={file.id} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted/50 ring-1 ring-border/30">
                    <HardDrive className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="truncate mb-0.5 text-sm font-light">{file.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">{sizeDisplay}</span>
                        {file.status && (
                            <>
                                <span className="text-border">·</span>
                                <span className="capitalize">{file.status}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </SearchItemWrapper>
    );
});
