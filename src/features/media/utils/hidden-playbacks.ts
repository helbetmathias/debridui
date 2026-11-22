import { z } from "zod";
import type { SimklPlaybackItem } from "@/lib/simkl/types";

const CHANGE_EVENT = "debridui:hidden-playbacks";
const KEY_PREFIX = "debridui.hidden-playbacks.v1:";
const LIMIT = 100;
const hiddenKeys = z.array(z.string()).max(LIMIT);
type Playback = Pick<SimklPlaybackItem, "id" | "pausedAt">;

export function playbackVisibilityKey(item: Playback) {
    return JSON.stringify([item.id, item.pausedAt]);
}

export function readHiddenPlaybacks(userId: string) {
    try {
        return window.localStorage.getItem(KEY_PREFIX + userId) ?? "";
    } catch {
        return "";
    }
}

export function parseHiddenPlaybacks(snapshot: string): string[] {
    try {
        return snapshot ? (hiddenKeys.safeParse(JSON.parse(snapshot)).data ?? []) : [];
    } catch {
        return [];
    }
}

export function subscribeHiddenPlaybacks(notify: () => void) {
    function onStorage(event: StorageEvent) {
        if (event.key === null || event.key.startsWith(KEY_PREFIX)) notify();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, notify);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(CHANGE_EVENT, notify);
    };
}

export function setPlaybackHidden(userId: string, item: Playback, hidden: boolean) {
    const key = playbackVisibilityKey(item);
    const rest = parseHiddenPlaybacks(readHiddenPlaybacks(userId)).filter((entry) => entry !== key);
    const next = hidden ? [key, ...rest].slice(0, LIMIT) : rest;
    window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
}
