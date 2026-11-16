import type { MediaItem } from "@/lib/media";

/** Round-robin keeps a large movie feed from crowding series out of the hero. */
export function mixHeroItems<T extends MediaItem>(groups: T[][], limit = 10): T[] {
    const result: T[] = [];
    const seen = new Set<string>();
    const longest = Math.max(0, ...groups.map((items) => items.length));
    for (let index = 0; index < longest && result.length < limit; index++) {
        for (const items of groups) {
            const item = items[index];
            const media = item?.movie ?? item?.show;
            if (!media) continue;
            const key = `${item.movie ? "movie" : "show"}:${media.ids?.imdb || media.ids?.slug || `${media.title}:${media.year}`}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(item);
            if (result.length === limit) break;
        }
    }
    return result;
}
