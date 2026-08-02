import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserSettings, saveUserSettings } from "@/lib/actions/settings";
import { useSettingsStore } from "@/lib/stores/settings";
import type { ServerSettings } from "@/lib/types";

const USER_SETTINGS_KEY = ["user-settings"];

/**
 * Hydrate Zustand store from server settings.
 * Add new mappings here when persisting more settings server-side.
 */
export function hydrateSettingsFromServer(settings: ServerSettings | null) {
    if (!settings) return;
    const { set } = useSettingsStore.getState();
    if (settings.tmdb_api_key !== undefined) set("tmdbApiKey", settings.tmdb_api_key);
}

export function useUserSettings() {
    return useQuery({
        queryKey: USER_SETTINGS_KEY,
        queryFn: () => getUserSettings(),
        staleTime: 60 * 1000,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
    });
}

export function useSaveUserSettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (settings: Partial<ServerSettings>) => saveUserSettings(settings),
        onMutate: async (updates) => {
            await queryClient.cancelQueries({ queryKey: USER_SETTINGS_KEY });
            const previousSettings = queryClient.getQueryData<ServerSettings | null>(USER_SETTINGS_KEY);

            queryClient.setQueryData<ServerSettings | null>(USER_SETTINGS_KEY, (current) => ({
                ...(current ?? {}),
                ...updates,
            }));

            return { previousSettings };
        },
        onError: (_error, _updates, context) => {
            queryClient.setQueryData(USER_SETTINGS_KEY, context?.previousSettings ?? null);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: USER_SETTINGS_KEY }),
    });
}
