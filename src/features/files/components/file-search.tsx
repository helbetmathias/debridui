"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthGuaranteed } from "@/features/auth/components/auth-provider";
import type { DebridFile } from "@/lib/debrid/types";

interface FileSearchProps {
    onSearchResults: (results: DebridFile[] | null, isSearching: boolean) => void;
}

export const FileSearch = memo(function FileSearch({ onSearchResults }: FileSearchProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const queryParam = searchParams.get("q") || "";
    const [searchQuery, setSearchQuery] = useState<string>(queryParam);
    const { client, currentAccount } = useAuthGuaranteed();

    // Check if this is an ID search
    const isIdSearch = queryParam.trim().startsWith("id:");
    const torrentId = isIdSearch ? queryParam.trim().substring(3) : null;

    // Search files query
    const { data: searchResults, isLoading: isSearching } = useQuery<DebridFile[]>({
        queryKey: [currentAccount.id, isIdSearch ? "findTorrentById" : "findTorrents", queryParam],
        queryFn: async () => {
            if (isIdSearch && torrentId) {
                const result = await client.findTorrentById(torrentId);
                return result ? [result] : [];
            }
            return client.findTorrents(queryParam);
        },
        enabled: !!queryParam,
        staleTime: 5_000,
    });

    // Update URL when search query changes
    useEffect(() => {
        if (searchQuery === queryParam) return;

        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (searchQuery) {
                params.set("q", searchQuery);
            } else {
                params.delete("q");
            }
            params.delete("page");
            router.replace(`?${params.toString()}`, { scroll: false });
        }, 750);
        return () => clearTimeout(timer);
    }, [searchQuery, queryParam, searchParams, router]);

    // Update local state when URL param changes
    useEffect(() => {
        setSearchQuery(queryParam);
    }, [queryParam]);

    // Notify parent of search results
    useEffect(() => {
        onSearchResults(queryParam ? (searchResults ?? null) : null, isSearching);
    }, [queryParam, searchResults, isSearching, onSearchResults]);

    return <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search files..." />;
});

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    onSubmit?: (value: string) => void;
}

function SearchBar({ value, onChange, placeholder = "Search files...", onSubmit }: SearchBarProps) {
    const hasValue = value.length > 0;
    return (
        <div className="flex-1 relative min-w-0 group">
            <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 size-4 transition-colors duration-200 ${
                    hasValue ? "text-foreground" : "text-muted-foreground group-focus-within:text-foreground"
                }`}
            />
            <Input
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pl-10 pr-9 text-sm border-border/50 bg-transparent transition-[box-shadow,border-color] duration-200"
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        onSubmit?.(value);
                    }
                }}
            />
            {hasValue && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-muted-foreground hover:text-foreground animate-in fade-in-0 zoom-in-90 duration-200"
                    onClick={() => onChange("")}>
                    <X className="size-3.5" />
                </Button>
            )}
        </div>
    );
}
