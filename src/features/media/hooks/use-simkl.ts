import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/components/auth-provider";
import type { SimklPlayback, SimklStatus } from "@/lib/simkl/types";

async function read<T>(action: string): Promise<T> {
    const response = await fetch(`/api/simkl/${action}`, { cache: "no-store" });
    if (!response.ok) throw new Error("SIMKL is temporarily unavailable");
    return response.json();
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
