import type {
    Account,
    CacheCheckMode,
    CacheCheckResult,
    DebridFile,
    DebridFileAddStatus,
    DebridFileList,
    DebridFileNode,
    DebridLinkInfo,
    DebridNode,
    OperationResult,
    WebDownloadAddResult,
    WebDownloadList,
} from "@/lib/types";
import { bareMagnet } from "@/lib/utils/infohash";

/**
 * Sliding-window rate limiter. Serializes calls through a promise chain
 * so concurrent callers never race on the timestamp array.
 */
export class RateLimiter {
    private timestamps: number[] = [];
    private pending: Promise<void> = Promise.resolve();

    constructor(
        private readonly maxRequests: number,
        private readonly intervalMs: number
    ) {}

    acquire(): Promise<void> {
        this.pending = this.pending.then(
            () => this.wait(),
            () => this.wait()
        );
        return this.pending;
    }

    private async wait(): Promise<void> {
        const now = Date.now();
        this.timestamps = this.timestamps.filter((t) => now - t < this.intervalMs);

        if (this.timestamps.length >= this.maxRequests) {
            const delay = this.timestamps[0] + this.intervalMs - now;
            if (delay > 0) {
                await new Promise((r) => setTimeout(r, delay));
            }
        }

        this.timestamps.push(Date.now());
    }
}

interface BaseClientOptions {
    account: Account;
    rateLimiter?: { maxRequests: number; intervalMs: number };
}

export default abstract class BaseClient {
    protected readonly account: Account;
    protected readonly rateLimiter: RateLimiter;

    // Web download capabilities - override in subclasses
    readonly refreshInterval: number | false = false;
    readonly supportsEphemeralLinks: boolean = false;

    /** Overridden to "native" by clients with a by-hash cache endpoint. */
    readonly cacheCheckMode: CacheCheckMode = "probe";

    constructor({ account, rateLimiter = { maxRequests: 250, intervalMs: 60000 } }: BaseClientOptions) {
        this.account = account;
        this.rateLimiter = new RateLimiter(rateLimiter.maxRequests, rateLimiter.intervalMs);
    }

    protected async downloadFile(uri: string): Promise<File> {
        const response = await fetch(uri);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const contentType = response.headers.get("content-type") || "application/x-bittorrent";

        return new File([blob], uri, { type: contentType });
    }

    async addTorrent(uris: string[]): Promise<Record<string, DebridFileAddStatus>> {
        const httpUris: string[] = [];
        const magnetUris: string[] = [];

        for (const uri of uris) {
            const trimmedUri = uri.trim();
            if (trimmedUri.startsWith("http")) {
                httpUris.push(trimmedUri);
            } else {
                magnetUris.push(trimmedUri);
            }
        }

        const [httpResults, magnetResults] = await Promise.allSettled([
            httpUris.length > 0 ? this.addHttpDownloads(httpUris) : Promise.resolve({}),
            magnetUris.length > 0 ? this.addMagnetLinks(magnetUris) : Promise.resolve({}),
        ]);

        const settle = (uris: string[], result: PromiseSettledResult<Record<string, DebridFileAddStatus>>) =>
            result.status === "fulfilled"
                ? result.value
                : Object.fromEntries(
                      uris.map((uri) => [
                          uri,
                          {
                              success: false,
                              message: result.reason instanceof Error ? result.reason.message : "Failed to add",
                              is_cached: false,
                          },
                      ])
                  );

        return { ...settle(httpUris, httpResults), ...settle(magnetUris, magnetResults) };
    }

    protected async addHttpDownloads(httpUris: string[]): Promise<Record<string, DebridFileAddStatus>> {
        const results: Record<string, DebridFileAddStatus> = {};
        const downloadedFiles: File[] = [];

        await Promise.allSettled(
            httpUris.map(async (uri) => {
                try {
                    const file = await this.downloadFile(uri);
                    downloadedFiles.push(file);
                } catch (error) {
                    results[uri] = {
                        success: false,
                        message: error instanceof Error ? error.message : `Failed to download ${uri}`,
                        is_cached: false,
                    };
                }
            })
        );

        if (downloadedFiles.length > 0) {
            const uploadResults = await this.uploadTorrentFiles(downloadedFiles);
            Object.assign(results, uploadResults);
        }

        return results;
    }

    /**
     * Cache check for services with no by-hash endpoint (Real-Debrid disabled theirs, AllDebrid
     * never had one): add the magnet, read whether it landed complete, remove it again. Only
     * `bareMagnet` output is sent, leaving the service no tracker to announce to.
     */
    async checkCache(hashes: string[]): Promise<CacheCheckResult[]> {
        const results: CacheCheckResult[] = [];
        for (const hash of hashes) {
            // One bad hash must not discard answers already paid for with add/remove cycles
            try {
                results.push(await this.probeCache(hash));
            } catch (error) {
                console.error(`Cache probe failed for ${hash}`, error);
                results.push({ hash, cached: false, filename: "", filesize: "0", unknown: true });
            }
        }
        return results;
    }

    private async probeCache(hash: string): Promise<CacheCheckResult> {
        const status = await this.probeAdd(bareMagnet(hash));
        if (!status?.success || status.id === undefined) {
            return { hash, cached: false, filename: "", filesize: "0", unknown: true };
        }

        const id = String(status.id);

        try {
            await this.probeCommit(id);

            // Services report `waiting` while converting the magnet; a cached one settles shortly after
            let torrent = await this.findTorrentById(id);
            for (let attempt = 0; attempt < 4 && (!torrent || torrent.status === "waiting"); attempt++) {
                await new Promise((r) => setTimeout(r, 1500));
                torrent = await this.findTorrentById(id);
            }

            const cached = status.is_cached || torrent?.status === "completed";
            return {
                hash,
                cached,
                filename: torrent?.name ?? "",
                filesize: String(torrent?.size ?? 0),
                // Never settled tells us nothing; "not cached" would send trackers for a torrent it may hold
                unknown: !cached && (!torrent || torrent.status === "waiting"),
            };
        } finally {
            await this.removeProbe(id);
        }
    }

    /** Adds a magnet for probing, without committing it to a download where that is separable. */
    protected async probeAdd(magnet: string): Promise<DebridFileAddStatus | undefined> {
        // Keyed by the service's echo of the magnet, which may differ from ours
        return Object.values(await this.addMagnetLinks([magnet]))[0];
    }

    /** Some services only reveal cache state once the torrent is committed to downloading. */
    protected async probeCommit(_id: string): Promise<void> {}

    /** A stranded probe torrent keeps downloading, so a failed removal is reported, not swallowed. */
    private async removeProbe(id: string) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await this.removeTorrent(id);
            } catch {
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
        throw new Error(`Probe torrent ${id} could not be removed — check your torrent list`);
    }

    abstract addMagnetLinks(magnetUris: string[]): Promise<Record<string, DebridFileAddStatus>>;
    abstract uploadTorrentFiles(files: File[]): Promise<Record<string, DebridFileAddStatus>>;
    abstract findTorrents(searchQuery: string): Promise<DebridFile[]>;
    abstract findTorrentById(torrentId: string): Promise<DebridFile | null>;
    abstract getDownloadLink(params: { fileNode: DebridFileNode; resolve?: boolean }): Promise<DebridLinkInfo>;

    abstract getTorrentList(params?: { offset?: number; limit?: number }): Promise<DebridFileList>;
    abstract getTorrentFiles(torrentId: string): Promise<DebridNode[]>;
    abstract removeTorrent(torrentId: string): Promise<string>;
    abstract restartTorrents(torrentIds: string[]): Promise<Record<string, OperationResult>>;

    // Web download methods
    abstract addWebDownloads(links: string[]): Promise<WebDownloadAddResult[]>;
    abstract getWebDownloadList(params: { offset: number; limit: number }): Promise<WebDownloadList>;
    abstract deleteWebDownload(id: string): Promise<void>;

    // Optional: Save links (AllDebrid only)
    saveWebDownloadLinks?(links: string[]): Promise<void>;

    // Optional: Airlock (TorBox only)
    setAirlocked?(params: { id: string; target: "torrent" | "webdl"; airlocked: boolean }): Promise<void>;
}
