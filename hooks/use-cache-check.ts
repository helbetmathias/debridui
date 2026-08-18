"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthGuaranteed } from "@/components/auth/auth-provider";
import type { CacheCheckResult } from "@/lib/types";

/**
 * Cached state for infohashes, answered once per hash so adding a torrent to a checked list only
 * asks about the new one — probe mode pays for every lookup with an add and a remove.
 *
 * A mutation rather than a query: the query cache is mirrored to IndexedDB, which would put the
 * user's infohashes on disk.
 */
export function useCacheCheck(hashes: string[]) {
    const { client, currentAccount } = useAuthGuaranteed();
    const isNative = client.cacheCheckMode === "native";

    const [known, setKnown] = useState<Map<string, CacheCheckResult>>(() => new Map());
    const [account, setAccount] = useState(currentAccount.id);

    // Answers belong to one account; adjusting during render beats an effect that renders twice
    const attempted = useRef(new Set<string>());
    const inFlight = useRef(false);

    if (account !== currentAccount.id) {
        setAccount(currentAccount.id);
        setKnown(new Map());
        attempted.current = new Set();
    }

    const pending = useMemo(() => [...new Set(hashes)].filter((hash) => !known.has(hash)), [hashes, known]);

    const check = useMutation({
        mutationFn: (batch: string[]) => client.checkCache(batch),
        onSuccess: (answers) =>
            setKnown((prev) => {
                const next = new Map(prev);
                for (const answer of answers) next.set(answer.hash, answer);
                return next;
            }),
    });

    // Snapshot the batch: rows added mid-flight must not change what this run answers
    const { mutate } = check;
    const start = useCallback(
        (batch: string[]) => {
            if (!batch.length || inFlight.current) return;
            for (const hash of batch) attempted.current.add(hash);
            inFlight.current = true;
            mutate([...batch], {
                onSettled: () => {
                    inFlight.current = false;
                },
            });
        },
        [mutate]
    );

    // Skips hashes already tried, so a failure never loops and a retry is the only way back
    const run = useCallback(() => start(pending.filter((hash) => !attempted.current.has(hash))), [start, pending]);

    // Re-attempts hashes `run` would skip; mutating clears the error state on its own
    const retry = useCallback(() => start(pending), [start, pending]);

    // Probe mode mutates the account to answer, so it only runs when the user asks
    useEffect(() => {
        if (isNative) run();
    }, [isNative, run]);

    const results = useMemo(() => {
        const found = new Map<string, CacheCheckResult>();
        for (const hash of hashes) {
            const answer = known.get(hash);
            if (answer) found.set(hash, answer);
        }
        return found;
    }, [hashes, known]);

    return {
        results,
        isNative,
        isChecking: check.isPending,
        pendingCount: pending.length,
        /** Last attempt failed; nothing retries on its own. */
        failed: check.isError,
        retry,
        run,
    };
}
