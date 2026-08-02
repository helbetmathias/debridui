import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { recordSearchPickSchema, removeSearchPickSchema, searchHistoryEntrySchema } from "@/lib/schemas";
import type { SearchHistoryEntry } from "@/lib/types";

const SEARCH_HISTORY_QUERY_KEY = ["local-search-history", 1];
const SEARCH_HISTORY_STORAGE_KEY = "debridui.search-history.v1";
const MAX_SEARCH_HISTORY_ENTRIES = 20;

function readSearchHistory(): SearchHistoryEntry[] {
    if (typeof window === "undefined") return [];

    try {
        const stored = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
        if (!stored) return [];

        const parsed = searchHistoryEntrySchema.array().safeParse(JSON.parse(stored));
        if (!parsed.success) {
            window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
            return [];
        }

        return parsed.data.slice(0, MAX_SEARCH_HISTORY_ENTRIES);
    } catch (error) {
        console.error("Failed to read search history:", error);
        return [];
    }
}

function writeSearchHistory(history: SearchHistoryEntry[]) {
    window.localStorage.setItem(
        SEARCH_HISTORY_STORAGE_KEY,
        JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY_ENTRIES))
    );
}

/** Local search history for this browser. Account settings are synced separately. */
export function useSearchHistory() {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: SEARCH_HISTORY_QUERY_KEY,
        queryFn: async () => readSearchHistory(),
        staleTime: 0,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
    });

    useEffect(() => {
        const syncOpenTabs = (event: StorageEvent) => {
            if (event.key === SEARCH_HISTORY_STORAGE_KEY) {
                queryClient.setQueryData(SEARCH_HISTORY_QUERY_KEY, readSearchHistory());
            }
        };

        window.addEventListener("storage", syncOpenTabs);
        return () => window.removeEventListener("storage", syncOpenTabs);
    }, [queryClient]);

    return query;
}

/** Record a TMDB result before navigation. */
export function useRecordSearchPick() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: z.infer<typeof recordSearchPickSchema>) => {
            const validated = recordSearchPickSchema.parse(input);
            const current = readSearchHistory();
            const entry: SearchHistoryEntry = {
                ...validated,
                id: crypto.randomUUID(),
                updatedAt: new Date().toISOString(),
            };
            const next = [
                entry,
                ...current.filter(
                    (item) => !(item.provider === validated.provider && item.providerId === validated.providerId)
                ),
            ];

            writeSearchHistory(next);
            return entry;
        },
        onSuccess: () => {
            queryClient.setQueryData(SEARCH_HISTORY_QUERY_KEY, readSearchHistory());
        },
        onError: (error) => {
            toast.error("Failed to save search history");
            console.error(error);
        },
    });
}

/** Remove a single local entry. */
export function useRemoveFromSearchHistory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: z.infer<typeof removeSearchPickSchema>) => {
            const validated = removeSearchPickSchema.parse(input);
            const next = readSearchHistory().filter(
                (entry) => !(entry.provider === validated.provider && entry.providerId === validated.providerId)
            );
            writeSearchHistory(next);
            return next;
        },
        onSuccess: (history) => {
            queryClient.setQueryData(SEARCH_HISTORY_QUERY_KEY, history);
        },
        onError: (error) => {
            toast.error("Failed to remove entry");
            console.error(error);
        },
    });
}

/** Clear search history in this browser only. */
export function useClearSearchHistory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
        },
        onSuccess: () => {
            queryClient.setQueryData(SEARCH_HISTORY_QUERY_KEY, []);
            toast.success("Search history cleared");
        },
        onError: (error) => {
            toast.error("Failed to clear history");
            console.error(error);
        },
    });
}
