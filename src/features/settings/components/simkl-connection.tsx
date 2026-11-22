"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSimklStatus } from "@/features/media/hooks/use-simkl";

export function SimklConnection() {
    const { data, isLoading, error, refetch } = useSimklStatus();
    const queryClient = useQueryClient();
    const router = useRouter();
    const search = useSearchParams();
    const [disconnecting, setDisconnecting] = useState(false);

    async function disconnect() {
        setDisconnecting(true);
        try {
            const response = await fetch("/api/simkl/disconnect", { method: "POST" });
            if (!response.ok) throw new Error("Disconnect failed");
            const result: { revoked: boolean } = await response.json();
            queryClient.removeQueries({ queryKey: ["simkl"] });
            await queryClient.invalidateQueries({ queryKey: ["simkl"] });
            router.refresh();
            toast.success("SIMKL disconnected. Your SIMKL progress was not deleted.");
            if (!result.revoked)
                toast.warning("Also remove DebridUI in SIMKL Connected Apps; token revocation could not be confirmed.");
        } catch {
            toast.error("Could not disconnect SIMKL. Please try again.");
        } finally {
            setDisconnecting(false);
        }
    }

    return (
        <div id="simkl" className="border-t border-border/50 pt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">SIMKL · Continue Watching</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {isLoading
                            ? "Checking connection…"
                            : data?.connected
                              ? "Connected · read-only progress sync"
                              : "Show your saved movie and episode progress on the dashboard."}
                    </p>
                </div>
                {data?.connected ? (
                    <Button variant="outline" size="sm" onClick={disconnect} disabled={disconnecting}>
                        {disconnecting ? "Disconnecting…" : "Disconnect"}
                    </Button>
                ) : error ? (
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        Retry connection check
                    </Button>
                ) : (
                    <form action="/api/simkl/connect" method="post">
                        <Button size="sm" variant="outline" type="submit" disabled={isLoading || !data?.configured}>
                            {data?.reconnectRequired ? "Reconnect SIMKL" : "Connect SIMKL"}
                        </Button>
                    </form>
                )}
            </div>
            {!isLoading && !error && !data?.configured && (
                <p className="text-xs text-muted-foreground">
                    Server setup required: add the SIMKL environment variables and database migration. See the
                    repository’s SIMKL setup guide.
                </p>
            )}
            {search.get("simkl") === "failed" && (
                <p className="text-xs text-destructive" role="alert">
                    SIMKL authorization was cancelled or expired. Try connecting again.
                </p>
            )}
            <p className="text-xs text-muted-foreground">
                Your MPV scrobbler still records playback and handles SIMKL resume. This connection only reads saved
                progress; it does not mark anything watched.
            </p>
        </div>
    );
}
