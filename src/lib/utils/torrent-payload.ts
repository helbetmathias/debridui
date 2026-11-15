import { bareMagnet, toInfoHash } from "./infohash";

/** What the user supplied. */
type TorrentItem = {
    hash: string;
    /** True only when the service has confirmed it already holds this torrent. */
    cached: boolean;
    source: File | string;
};

type AddPayload = { uris: string[]; files: File[] };

/**
 * Builds what gets sent when adding torrents.
 *
 * Cached items are rebuilt from the hash alone: a service that is wrong about holding one, or
 * re-fetches it later, would otherwise announce to the tracker we handed over. Uncached items keep
 * their trackers, without which the service cannot find peers.
 */
export function buildAddPayload(items: TorrentItem[]): AddPayload {
    const uris: string[] = [];
    const files: File[] = [];

    for (const item of items) {
        if (item.cached) uris.push(bareMagnet(item.hash));
        else if (typeof item.source !== "string") files.push(item.source);
        // A bare hash has no trackers to keep, and is not a URI the services accept
        else uris.push(item.source.startsWith("magnet:") ? item.source : bareMagnet(item.hash));
    }

    assertNoCachedLeak(items, uris, files);
    return { uris, files };
}

/** Re-derives the guarantee from the output, so a leak fails loudly instead of shipping. */
function assertNoCachedLeak(items: TorrentItem[], uris: string[], files: File[]) {
    const cachedHashes = new Set(items.filter((item) => item.cached).map((item) => item.hash));
    if (!cachedHashes.size) return;

    for (const file of files) {
        if (items.some((item) => item.cached && item.source === file)) {
            throw new Error(`Refusing to upload the .torrent for cached ${file.name}`);
        }
    }

    for (const uri of uris) {
        const hash = toInfoHash(uri);
        if (hash && cachedHashes.has(hash) && uri !== bareMagnet(hash)) {
            throw new Error(`Refusing to send anything but a bare magnet for cached ${hash}`);
        }
    }
}
