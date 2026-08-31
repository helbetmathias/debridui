import Fuse from "fuse.js";
import {
    type Account,
    AccountType,
    type CacheCheckResult,
    DebridAuthError,
    DebridError,
    type DebridFile,
    type DebridFileAddStatus,
    type DebridFileList,
    type DebridFileNode,
    type DebridFileStatus,
    type DebridLinkInfo,
    type DebridNode,
    DebridRateLimitError,
    type FullAccount,
    type OperationResult,
    type WebDownloadAddResult,
    type WebDownloadList,
} from "@/lib/types";
import { bareMagnet, toInfoHash } from "@/lib/utils/infohash";
import { USER_AGENT } from "../constants";
import BaseClient from "./base";
import { buildTree } from "./tree";

const API_URL = "https://debrid-link.com/api/v2";
const PER_PAGE = 100; // API clamps perPage to 20..100

interface TorrentFile {
    id: string;
    name: string;
    size: number;
    downloadUrl: string;
    downloaded: boolean;
    downloadPercent: number;
}

interface Torrent {
    id: string;
    name: string;
    hashString: string;
    created: number;
    status: number;
    error: number;
    errorString: string;
    wait: boolean;
    totalSize: number;
    downloadPercent: number;
    peersConnected: number;
    downloadSpeed: number;
    uploadSpeed: number;
    uploadRatio: number;
    isZip?: boolean;
    files: TorrentFile[];
}

/** The published sample and the live API disagree on field names, so both spellings occur. */
interface DownloaderLink {
    id: string;
    link?: string;
    url?: string;
    downloadUrl?: string;
    downloadLink?: string;
    filename?: string;
    name?: string;
    size: number;
    host: string;
    time?: number;
    created?: number;
    expired: boolean;
}

interface Pagination {
    page: number;
    pages: number;
    next: number;
    previous: number;
}

interface ApiResponse<T> {
    success: boolean;
    value: T;
    pagination?: Pagination;
    error?: string;
    error_description?: string;
}

const AUTH_ERRORS = ["badToken", "hidedToken", "badSign", "unauthorized"];

/** The only add failure meaning the service does not hold the torrent. */
const NOT_CACHED_ERROR = "notAddTorrent";

class DebridLinkApiError extends DebridError {
    constructor(
        message: string,
        readonly code?: string
    ) {
        super(message, AccountType.DEBRIDLINK);
    }
}

export default class DebridLinkClient extends BaseClient {
    // Download URLs ship inline with the torrent list and stay valid
    readonly refreshInterval = false as const;
    readonly supportsEphemeralLinks = false;

    constructor(account: Account) {
        super({ account });
    }

    private async makeRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        await this.rateLimiter.acquire();

        const response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${this.account.apiKey}`,
                "User-Agent": USER_AGENT,
                ...options.headers,
            },
        });

        if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            throw new DebridRateLimitError(
                "Rate limit exceeded",
                AccountType.DEBRIDLINK,
                retryAfter ? parseInt(retryAfter, 10) : undefined
            );
        }

        const data: ApiResponse<T> = await response.json().catch(() => ({
            success: false,
            value: undefined as T,
            error: response.statusText,
        }));

        if (!data.success) throw DebridLinkClient.toError(data);
        return data;
    }

    private static toError(data: { error?: string; error_description?: string }): DebridError {
        const message = data.error_description || data.error || "API request failed";
        if (data.error && AUTH_ERRORS.includes(data.error)) {
            return new DebridAuthError(message, AccountType.DEBRIDLINK);
        }
        if (data.error === "floodDetected") {
            return new DebridRateLimitError(message, AccountType.DEBRIDLINK);
        }
        return new DebridLinkApiError(message, data.error);
    }

    /** Form-encoded body: the API rejects JSON and multipart on every endpoint but the file upload. */
    private static form(fields: Record<string, string>): RequestInit {
        return {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(fields).toString(),
        };
    }

    static async getUser(apiKey: string): Promise<FullAccount> {
        const response = await fetch(`${API_URL}/account/infos`, {
            headers: { Authorization: `Bearer ${apiKey}`, "User-Agent": USER_AGENT },
        });

        const data = await response.json().catch(() => ({ success: false, error: response.statusText }));
        if (!data.success) throw DebridLinkClient.toError(data);

        const { username, email, accountType, premiumLeft } = data.value;
        const isPremium = accountType > 0 || premiumLeft > 0;

        return {
            id: `${AccountType.DEBRIDLINK}:${username}`,
            apiKey,
            type: AccountType.DEBRIDLINK,
            name: username,
            email: email || username,
            language: "en", // not exposed by /account/infos
            isPremium,
            premiumExpiresAt: new Date(Date.now() + (premiumLeft || 0) * 1000),
        };
    }

    private async listTorrents(query: string): Promise<{ torrents: Torrent[]; pagination?: Pagination }> {
        const response = await this.makeRequest<Torrent[]>(`/seedbox/list?${query}`);
        return { torrents: response.value ?? [], pagination: response.pagination };
    }

    async getTorrentList({ offset = 0, limit = 20 } = {}): Promise<DebridFileList> {
        const page = Math.floor(offset / PER_PAGE);
        const { torrents, pagination } = await this.listTorrents(`page=${page}&perPage=${PER_PAGE}`);

        const start = offset - page * PER_PAGE;
        const slice = torrents.slice(start, start + limit);
        const morePages = pagination ? pagination.next !== -1 : false;

        return {
            files: slice.map(DebridLinkClient.mapToDebridFile),
            offset,
            limit,
            hasMore: start + limit < torrents.length || morePages,
        };
    }

    async findTorrents(searchQuery: string): Promise<DebridFile[]> {
        const all: Torrent[] = [];
        for (let page = 0; ; page++) {
            const { torrents, pagination } = await this.listTorrents(`page=${page}&perPage=${PER_PAGE}`);
            all.push(...torrents);
            if (!pagination || pagination.next === -1) break;
        }

        const fuse = new Fuse(all, { keys: ["name"], threshold: 0.3, minMatchCharLength: 2 });
        return fuse.search(searchQuery).map((result) => DebridLinkClient.mapToDebridFile(result.item));
    }

    /** An `ids=` filter matching nothing is dropped and the full list returns, so match the id back. */
    private async getTorrent(torrentId: string): Promise<Torrent | undefined> {
        const { torrents } = await this.listTorrents(`ids=${encodeURIComponent(torrentId)}`);
        return torrents.find((torrent) => torrent.id === torrentId);
    }

    async findTorrentById(torrentId: string): Promise<DebridFile | null> {
        const torrent = await this.getTorrent(torrentId);
        return torrent ? DebridLinkClient.mapToDebridFile(torrent) : null;
    }

    /** Bulk listing collapses large torrents to a single zip entry; fetching by id returns every file. */
    async getTorrentFiles(torrentId: string): Promise<DebridNode[]> {
        const files = (await this.getTorrent(torrentId))?.files ?? [];

        return buildTree(files.map((file) => ({ path: file.name, id: file.downloadUrl, size: file.size })));
    }

    /** Files already carry their download URL, so the node id is the link. */
    async getDownloadLink({ fileNode }: { fileNode: DebridFileNode; resolve?: boolean }): Promise<DebridLinkInfo> {
        return { link: fileNode.id, name: fileNode.name, size: fileNode.size || 0 };
    }

    async addMagnetLinks(magnetUris: string[]): Promise<Record<string, DebridFileAddStatus>> {
        const results: Record<string, DebridFileAddStatus> = {};

        await Promise.all(
            magnetUris.map(async (uri) => {
                try {
                    const { value } = await this.makeRequest<Torrent>(
                        "/seedbox/add",
                        DebridLinkClient.form({ url: uri })
                    );
                    results[uri] = {
                        success: true,
                        id: value.id,
                        message: `Successfully added: ${value.name}`,
                        is_cached: value.downloadPercent === 100,
                    };
                } catch (error) {
                    results[uri] = {
                        success: false,
                        message: error instanceof Error ? error.message : "Failed to add",
                        is_cached: false,
                    };
                }
            })
        );

        return results;
    }

    async uploadTorrentFiles(files: File[]): Promise<Record<string, DebridFileAddStatus>> {
        const results: Record<string, DebridFileAddStatus> = {};

        await Promise.all(
            files.map(async (file) => {
                const formData = new FormData();
                formData.append("file", file);

                try {
                    const { value } = await this.makeRequest<Torrent>("/seedbox/add", {
                        method: "POST",
                        body: formData,
                    });
                    results[file.name] = {
                        success: true,
                        id: value.id,
                        message: `Successfully uploaded: ${value.name}`,
                        is_cached: value.downloadPercent === 100,
                    };
                } catch (error) {
                    results[file.name] = {
                        success: false,
                        message: error instanceof Error ? error.message : "Failed to upload",
                        is_cached: false,
                    };
                }
            })
        );

        return results;
    }

    async removeTorrent(torrentId: string): Promise<string> {
        await this.makeRequest(`/seedbox/${encodeURIComponent(torrentId)}/remove`, { method: "DELETE" });
        return "Torrent removed";
    }

    /** There is no restart endpoint; re-adding the hash restarts it, since the service dedups by hash. */
    async restartTorrents(torrentIds: string[]): Promise<Record<string, OperationResult>> {
        const results: Record<string, OperationResult> = {};
        const hashes = new Map<string, string>();

        // `ids` is capped at 100; over that the filter is dropped and the wrong page comes back
        for (let i = 0; i < torrentIds.length; i += 100) {
            const batch = torrentIds
                .slice(i, i + 100)
                .map(encodeURIComponent)
                .join(",");
            const { torrents } = await this.listTorrents(`ids=${batch}&perPage=${PER_PAGE}`);
            for (const torrent of torrents) hashes.set(torrent.id, torrent.hashString);
        }

        await Promise.all(
            torrentIds.map(async (id) => {
                const hash = hashes.get(id);
                if (!hash) {
                    results[id] = { success: false, message: "Torrent not found" };
                    return;
                }

                try {
                    await this.makeRequest<Torrent>("/seedbox/add", DebridLinkClient.form({ url: bareMagnet(hash) }));
                    results[id] = { success: true, message: "Torrent restarted" };
                } catch (error) {
                    results[id] = {
                        success: false,
                        message: error instanceof Error ? error.message : "Failed to restart",
                    };
                }
            })
        );

        return results;
    }

    /**
     * A bare infohash is accepted only when the service already holds the torrent, so one add call
     * answers each hash without starting a download. Accepted hashes are removed again.
     */
    async checkCache(hashes: string[]): Promise<CacheCheckResult[]> {
        const owned = new Map<string, Torrent>();
        for (let page = 0; ; page++) {
            const { torrents, pagination } = await this.listTorrents(`page=${page}&perPage=${PER_PAGE}`);
            for (const torrent of torrents) owned.set(torrent.hashString?.toLowerCase(), torrent);
            if (!pagination || pagination.next === -1) break;
        }

        const added: string[] = [];
        const results: CacheCheckResult[] = [];
        const unanswered = (hash: string): CacheCheckResult => ({
            hash,
            cached: false,
            filename: "",
            filesize: "0",
            unknown: true,
        });

        for (const hash of hashes) {
            const infoHash = toInfoHash(hash);
            if (!infoHash) {
                results.push(unanswered(hash));
                continue;
            }

            const held = owned.get(infoHash);
            if (held) {
                results.push(DebridLinkClient.toCacheResult(hash, held));
                continue;
            }

            try {
                const { value } = await this.makeRequest<Torrent>(
                    "/seedbox/add",
                    DebridLinkClient.form({ url: infoHash })
                );
                added.push(value.id);
                results.push(DebridLinkClient.toCacheResult(hash, value));
            } catch (error) {
                // Anything but an explicit refusal is no answer; a false "not cached" would send
                // the user's trackers on the follow-up add
                const notCached = error instanceof DebridLinkApiError && error.code === NOT_CACHED_ERROR;
                results.push(notCached ? { hash, cached: false, filename: "", filesize: "0" } : unanswered(hash));
            }
        }

        if (added.length > 0) {
            await this.makeRequest(`/seedbox/${added.join(",")}/remove`, { method: "DELETE" }).catch((error) =>
                console.error("Failed to remove cache-check torrents", error)
            );
        }

        return results;
    }

    async addWebDownloads(links: string[]): Promise<WebDownloadAddResult[]> {
        return Promise.all(
            links.map(async (link) => {
                try {
                    const { value } = await this.makeRequest<DownloaderLink>(
                        "/downloader/add",
                        DebridLinkClient.form({ url: link })
                    );
                    return {
                        link,
                        success: true,
                        downloadLink: value.downloadUrl ?? value.downloadLink,
                        name: value.name ?? value.filename,
                        size: value.size,
                        id: value.id,
                    };
                } catch (error) {
                    return {
                        link,
                        success: false,
                        error: error instanceof Error ? error.message : "Failed to unlock link",
                    };
                }
            })
        );
    }

    async getWebDownloadList({ offset, limit }: { offset: number; limit: number }): Promise<WebDownloadList> {
        const page = Math.floor(offset / PER_PAGE);
        const response = await this.makeRequest<DownloaderLink[]>(`/downloader/list?page=${page}&perPage=${PER_PAGE}`);
        const links = response.value ?? [];

        const start = offset - page * PER_PAGE;
        const slice = links.slice(start, start + limit);

        return {
            downloads: slice.map((link) => ({
                id: link.id,
                name: link.name ?? link.filename ?? link.id,
                originalLink: link.url ?? link.link ?? "",
                downloadLink: link.downloadUrl ?? link.downloadLink,
                size: link.size,
                status: link.expired ? ("failed" as const) : ("completed" as const),
                createdAt: new Date((link.created ?? link.time ?? 0) * 1000),
                host: link.host,
            })),
            offset,
            limit,
            hasMore: start + limit < links.length || (response.pagination?.next ?? -1) !== -1,
        };
    }

    async deleteWebDownload(id: string): Promise<void> {
        await this.makeRequest(`/downloader/${encodeURIComponent(id)}/remove`, { method: "DELETE" });
    }

    /** A torrent still transferring is no cache hit, but no proof of a miss either. */
    private static toCacheResult(hash: string, torrent: Torrent): CacheCheckResult {
        const complete = torrent.downloadPercent === 100;
        return {
            hash,
            cached: complete,
            filename: torrent.name ?? "",
            filesize: String(torrent.totalSize ?? 0),
            ...(complete ? {} : { unknown: true }),
        };
    }

    private static mapToDebridFile(torrent: Torrent): DebridFile {
        const status = DebridLinkClient.mapStatus(torrent);

        return {
            id: torrent.id,
            name: torrent.name,
            size: torrent.totalSize ?? 0,
            status,
            progress: torrent.downloadPercent,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            uploaded: torrent.uploadRatio ? torrent.uploadRatio * (torrent.totalSize ?? 0) : undefined,
            downloaded: ((torrent.downloadPercent ?? 0) / 100) * (torrent.totalSize ?? 0),
            peers: torrent.peersConnected,
            createdAt: new Date(torrent.created * 1000),
            completedAt: undefined,
            error: status === "failed" ? torrent.errorString || "Torrent failed" : undefined,
            files: undefined, // the bulk listing may hold only a zip entry
        };
    }

    private static mapStatus(torrent: Torrent): DebridFileStatus {
        if (torrent.error) return "failed";
        if (torrent.wait) return "waiting";

        const statusMap: Record<number, DebridFileStatus> = {
            0: "paused",
            1: "waiting", // queued
            2: "processing", // verification
            4: "downloading",
            8: "seeding",
            100: "completed",
        };

        // Statuses combine as bit flags (6 = verification|downloading)
        return statusMap[torrent.status] ?? (torrent.downloadPercent === 100 ? "completed" : "downloading");
    }
}
