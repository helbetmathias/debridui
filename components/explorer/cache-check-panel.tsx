"use client";

import { ClipboardPaste, HelpCircle, Paperclip, Plus, SearchCheck, TriangleAlert, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { useAuthGuaranteed } from "@/components/auth/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCacheCheck } from "@/hooks/use-cache-check";
import { invalidateTorrentQueries } from "@/hooks/use-file-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CacheCheckResult, OperationResult } from "@/lib/types";
import { cn, formatSize, getTextFromClipboard } from "@/lib/utils";
import { toInfoHash, torrentFileInfoHash } from "@/lib/utils/infohash";
import { buildAddPayload } from "@/lib/utils/torrent-payload";

const TORRENT_ACCEPT = { "application/x-bittorrent": [".torrent"] };

const PROBE_EXPLAINER =
    "This service has no cache lookup. Checking adds a tracker-less magnet, reads whether it landed complete, then removes it again.";

/** `source` is the original input, forwarded only for items not known to be cached. */
type Row = { key: string; label: string; hash: string; source: File | string };

/** Magnets carry their name in `dn`, which reads better than the raw URI. */
const magnetLabel = (uri: string) => {
    try {
        // Malformed or non-UTF-8 escapes throw; a label is not worth losing the paste over
        return new URL(uri).searchParams.get("dn") || uri;
    } catch {
        return uri;
    }
};

/**
 * Opt-in cache lookup: paste magnets or pick .torrent files, see what the service holds, add only
 * the wanted ones. Checking sends infohashes alone; .torrent files are read locally.
 */
export function CacheCheckPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const isMobile = useIsMobile();
    const { client, currentAccount } = useAuthGuaranteed();

    const [rows, setRows] = useState<Row[]>([]);
    const [draft, setDraft] = useState("");
    const [manual, setManual] = useState<Map<string, boolean>>(() => new Map());
    const [isAdding, setIsAdding] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const { results, isNative, isChecking, pendingCount, failed, retry, run } = useCacheCheck(
        useMemo(() => (open ? rows.map((row) => row.hash) : []), [open, rows])
    );
    const isCached = (row: Row) => !!results.get(row.hash)?.cached;
    const cachedCount = rows.filter(isCached).length;

    /** Cached rows start selected; an explicit tick or untick outranks that from then on. */
    const isSelected = (row: Row) => manual.get(row.key) ?? isCached(row);

    const picked = rows.filter(isSelected);
    const uncachedPicked = picked.filter((row) => !isCached(row));

    const toggle = useCallback((key: string, next: boolean) => {
        setManual((prev) => new Map(prev).set(key, next));
    }, []);

    const remove = useCallback((key: string) => {
        setRows((prev) => prev.filter((row) => row.key !== key));
        setManual((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Map(prev);
            next.delete(key);
            return next;
        });
    }, []);

    const addRows = (incoming: Row[]) =>
        setRows((prev) => {
            // `key` is the React key, checkbox id and selection member, so duplicates must not pass
            const seen = new Set(prev.map((row) => row.hash));
            const fresh = incoming.filter((row) => !seen.has(row.hash) && seen.add(row.hash));
            return fresh.length ? [...prev, ...fresh] : prev;
        });

    /** Accepts one or many magnets or hashes, one per line. */
    const submitDraft = (text: string) => {
        // Split on lines, not whitespace: a magnet's `dn` may contain literal spaces
        const candidates = text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        const accepted = candidates.flatMap((uri) => {
            const hash = toInfoHash(uri);
            return hash ? [{ key: hash, label: magnetLabel(uri), hash, source: uri }] : [];
        });

        const rejected = candidates.length - accepted.length;
        if (rejected) toast.error(`${rejected} entr${rejected === 1 ? "y isn't" : "ies aren't"} a magnet link or hash`);

        addRows(accepted);
        if (accepted.length) setDraft("");
    };

    const { getInputProps, open: openFilePicker } = useDropzone({
        accept: TORRENT_ACCEPT,
        maxFiles: 100,
        noDrag: true, // a picker, not a drop target — the add panel owns dropping, where it commits
        onDrop: async (files) => {
            let hashed: { file: File; hash: string | null }[];
            try {
                hashed = await Promise.all(
                    files.map(async (file) => ({ file, hash: await torrentFileInfoHash(file) }))
                );
            } catch (error) {
                // Distinct from an unreadable file
                toast.error(error instanceof Error ? error.message : "Couldn't read those files");
                return;
            }

            addRows(
                hashed.flatMap(({ file, hash }) =>
                    hash ? [{ key: file.name, label: file.name, hash, source: file }] : []
                )
            );

            const unreadable = hashed.filter(({ hash }) => !hash).length;
            if (unreadable) toast.error(`${unreadable} file${unreadable === 1 ? "" : "s"} isn't a readable torrent`);
        },
    });

    const commit = async (picked: Row[]) => {
        if (!picked.length) return;

        setIsAdding(true);
        const toastId = toast.loading(`Adding ${picked.length} item${picked.length === 1 ? "" : "s"}`);
        try {
            const { uris, files } = buildAddPayload(
                picked.map((row) => ({ hash: row.hash, cached: isCached(row), source: row.source }))
            );

            const outcomes: Record<string, OperationResult> = {};
            if (uris.length) Object.assign(outcomes, await client.addTorrent(uris));
            if (files.length) Object.assign(outcomes, await client.uploadTorrentFiles(files));

            const failed = Object.entries(outcomes).filter(([, status]) => !status.success);
            for (const [name, status] of failed) toast.error(`${name}: ${status.message}`);

            const added = Object.keys(outcomes).length - failed.length;
            if (!added) {
                toast.error("Nothing was added", { id: toastId });
                return;
            }

            toast.success(`Added ${added} item${added === 1 ? "" : "s"}`, { id: toastId });
            invalidateTorrentQueries(currentAccount.id);
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to add", { id: toastId });
            console.error(error);
        } finally {
            setIsAdding(false);
        }
    };

    const title = "Check cache";
    const description = "Checking only ever sends the infohash — your tracker is never contacted.";

    const body = (
        <>
            <form
                className="px-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submitDraft(draft);
                }}>
                <InputGroup>
                    <InputGroupInput
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Paste a magnet link or hash"
                        className="font-mono"
                        aria-label="Magnet link or hash"
                    />
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            onClick={async () => {
                                const text = await getTextFromClipboard();
                                if (text) submitDraft(text);
                            }}
                            size="icon-xs"
                            aria-label="Paste from clipboard">
                            <ClipboardPaste />
                        </InputGroupButton>
                        <InputGroupButton
                            type="submit"
                            size="icon-xs"
                            disabled={!draft.trim()}
                            aria-label="Add to list">
                            <Plus />
                        </InputGroupButton>
                    </InputGroupAddon>
                </InputGroup>
            </form>

            <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
                <input {...getInputProps()} />
                <button
                    type="button"
                    onClick={openFilePicker}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 font-light text-foreground underline-offset-4 hover:underline">
                    <Paperclip className="size-3.5" strokeWidth={1.5} />
                    Add .torrent
                </button>

                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    <span className="font-light">
                        {pendingCount ? `${rows.length} to check` : `${cachedCount} of ${rows.length} cached`}
                    </span>
                    {!isNative && (
                        <TooltipProvider delayDuration={250}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label="How this check works"
                                        className="transition-colors hover:text-foreground">
                                        <HelpCircle className="size-3.5" strokeWidth={1.5} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-64">{PROBE_EXPLAINER}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {isChecking && <Spinner className="size-3.5" />}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto border-t border-border/50">
                {rows.length ? (
                    <ItemGroup>
                        {rows.map((row) => (
                            <CacheRow
                                key={row.key}
                                row={row}
                                result={results.get(row.hash)}
                                selected={isSelected(row)}
                                onToggle={toggle}
                                onRemove={remove}
                            />
                        ))}
                    </ItemGroup>
                ) : (
                    <Empty className="border-0">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <SearchCheck strokeWidth={1.5} />
                            </EmptyMedia>
                            <EmptyTitle className="font-light">Nothing to check yet</EmptyTitle>
                            <EmptyDescription>Add a magnet link above, or pick a .torrent file.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </div>

            {rows.length > 0 && (
                <div className="space-y-2 border-t border-border/50 p-3">
                    {uncachedPicked.length > 0 && (
                        <p className="flex items-start gap-2 text-xs font-light text-muted-foreground">
                            <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
                            <span>
                                {uncachedPicked.length} selected{" "}
                                {uncachedPicked.length === 1 ? "item isn't" : "items aren't"} confirmed cached — those
                                keep their trackers, so the service will announce.
                            </span>
                        </p>
                    )}

                    {failed && (
                        <p className="flex items-start gap-2 text-xs font-light text-muted-foreground">
                            <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.5} />
                            <span>The check didn't complete, so nothing here is confirmed cached.</span>
                        </p>
                    )}

                    <div className="flex items-center gap-2">
                        {(failed || (!isNative && pendingCount > 0)) && (
                            <Button
                                variant="outline"
                                disabled={isChecking || !pendingCount}
                                onClick={failed ? retry : run}
                                className="flex-1">
                                {failed ? "Retry check" : `Check ${pendingCount}`}
                            </Button>
                        )}
                        {(isNative || results.size > 0) && (
                            <Button
                                disabled={isAdding || !picked.length}
                                onClick={() => (uncachedPicked.length ? setConfirming(true) : commit(picked))}
                                className="flex-1">
                                {isAdding && <Spinner />}
                                Add {picked.length || ""} selected
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </>
    );

    return (
        <>
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title={`Add ${uncachedPicked.length} uncached torrent${uncachedPicked.length === 1 ? "" : "s"}?`}
                description="Anything not confirmed cached is sent as you supplied it, trackers included, so the service can find peers — that announce is what a private tracker counts as a snatch. Only confirmed-cached items are stripped to a bare hash."
                confirmText={`Add ${picked.length} anyway`}
                onConfirm={() => commit(picked)}
            />

            {isMobile ? (
                <Drawer open={open} onOpenChange={onOpenChange}>
                    <DrawerContent>
                        <DrawerHeader className="text-left">
                            <DrawerTitle>{title}</DrawerTitle>
                            <DrawerDescription>{description}</DrawerDescription>
                        </DrawerHeader>
                        {body}
                    </DrawerContent>
                </Drawer>
            ) : (
                <Sheet open={open} onOpenChange={onOpenChange}>
                    <SheetContent side="right" className="w-full sm:max-w-md">
                        <SheetHeader>
                            <SheetTitle>{title}</SheetTitle>
                            <SheetDescription>{description}</SheetDescription>
                        </SheetHeader>
                        {body}
                    </SheetContent>
                </Sheet>
            )}
        </>
    );
}

const CacheRow = memo(function CacheRow({
    row,
    result,
    selected,
    onToggle,
    onRemove,
}: {
    row: Row;
    result?: CacheCheckResult;
    selected: boolean;
    onToggle: (key: string, next: boolean) => void;
    onRemove: (key: string) => void;
}) {
    const size = Number(result?.filesize ?? 0);

    return (
        <Item
            size="sm"
            asChild
            className={cn("rounded-none border-b-border/50", selected ? "bg-muted/30" : "hover:bg-muted/20")}>
            <label htmlFor={row.key} className="cursor-pointer border-b">
                <ItemMedia>
                    <Checkbox id={row.key} checked={selected} onCheckedChange={() => onToggle(row.key, !selected)} />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle>{result?.filename || row.label}</ItemTitle>
                    <ItemDescription>
                        {size > 0 && (
                            <>
                                {formatSize(size)} <span className="text-border">·</span>{" "}
                            </>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                // Inside the row label; keep the click off the checkbox
                                e.preventDefault();
                                navigator.clipboard.writeText(row.hash);
                                toast.success("Infohash copied");
                            }}
                            title={row.hash}
                            className="cursor-pointer font-mono transition-colors hover:text-foreground">
                            {row.hash.slice(0, 8)}
                        </button>
                        {result && (
                            <>
                                {" "}
                                <span className="text-border">·</span>{" "}
                                <span className={cn(result.cached && "text-primary")}>
                                    {result.cached ? "Cached" : result.unknown ? "No answer" : "Not cached"}
                                </span>
                            </>
                        )}
                    </ItemDescription>
                </ItemContent>
                <ItemActions>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            onRemove(row.key);
                        }}
                        aria-label={`Remove ${row.label}`}
                        className="text-muted-foreground hover:text-foreground">
                        <X className="size-3.5" />
                    </Button>
                </ItemActions>
            </label>
        </Item>
    );
});
