import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/components/auth-provider";
import type { SimklPlayback, SimklRecommendation, SimklStatus } from "@/lib/simkl/types";

async function read<T>(action: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`/api/simkl/${action}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error("SIMKL is temporarily unavailable");
    return response.json();
}

export function useSimklRecommendations(id: string, type: "movie" | "show", enabled: boolean) {
    const { session, isLoading } = useAuth();
    const userId = session?.user.id;
    const supportedId = /^(?:tt[0-9]{1,12}|[1-9][0-9]{0,10})$/.test(id);
    const query = useQuery({
        queryKey: ["simkl", userId, "recommendations", type, id],
        queryFn: ({ signal }) => {
            const params = new URLSearchParams({ id, type });
            return read<SimklRecommendation[]>(`recommendations?${params}`, signal);
        },
        enabled: enabled && supportedId && !!userId,
        staleTime: (query) => (query.state.data?.length ? 6 * 60 * 60_000 : 60_000),
        retry: false,
        refetchOnWindowFocus: false,
    });
    return {
        items: userId && !query.isError ? query.data : undefined,
        isPending: enabled && supportedId && (userId ? query.isPending && !query.isPaused : isLoading),
    };
}

export function useSimklImdbRating(id: string, type: "movie" | "show", enabled: boolean) {
    const { session } = useAuth();
    const userId = session?.user.id;
    return useQuery({
        queryKey: ["simkl", userId, "imdb-rating", type, id],
        queryFn: ({ signal }) => read<number | null>(`rating?${new URLSearchParams({ id, type })}`, signal),
        enabled: enabled && !!userId && !!id,
        staleTime: 6 * 60 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    }).data;
}

export function useSimklStatus() {
    const { session } = useAuth();
    return useQuery({
        queryKey: ["simkl", session?.user.id, "status"],
        queryFn: () => read<SimklStatus>("status"),
        enabled: !!session,
        staleTime: 60_000,
        retry: false,
        refetchOnWindowFocus: true,
    });
}

export interface SimklPlaybackStartup {
    userId: string;
    savedPlayback?: SimklPlayback;
}

export function useSimklPlayback(startup: SimklPlaybackStartup) {
    const { session } = useAuth();
    const userId = session?.user.id ?? startup.userId;
    return useQuery({
        queryKey: ["simkl", userId, "playback"],
        queryFn: () => read<SimklPlayback>("playback"),
        enabled: !!session,
        initialData: userId === startup.userId ? startup.savedPlayback : undefined,
        initialDataUpdatedAt: 0,
        staleTime: 60_000,
        retry: false,
        refetchOnWindowFocus: true,
    });
}
