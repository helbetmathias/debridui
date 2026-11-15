"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Clock, MapPin, Monitor, Smartphone, Tablet } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { SectionDivider } from "@/components/layout/section-divider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { parseUserAgent } from "@/lib/media/player";

const USER_SESSIONS_KEY = ["user-sessions"];

// Sessions Section
export function SessionsSection({ currentToken }: { currentToken?: string }) {
    const queryClient = useQueryClient();

    const {
        data: sessions = [],
        isLoading,
        error: sessionsError,
    } = useQuery({
        queryKey: USER_SESSIONS_KEY,
        queryFn: async () => {
            const response = await authClient.listSessions();
            if (response.error) throw new Error(response.error.message || "Failed to fetch sessions");
            return response.data || [];
        },
        staleTime: 1 * 60 * 1000,
    });

    const sortedSessions = useMemo(
        () => [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [sessions]
    );

    const revokeMutation = useMutation({
        mutationFn: async (token: string) => {
            const { error } = await authClient.revokeSession({ token });
            if (error) throw new Error(error.message || "Failed to revoke session");
        },
        onSuccess: () => {
            toast.success("Session revoked successfully", {
                description: "Note: The session may still have access until cookies expire",
            });
            queryClient.invalidateQueries({ queryKey: USER_SESSIONS_KEY });
        },
        onError: (error: Error) => toast.error(`Failed to revoke session: ${error.message}`),
    });

    const revokeAllMutation = useMutation({
        mutationFn: async () => {
            const { error } = await authClient.revokeOtherSessions();
            if (error) throw new Error(error.message || "Failed to revoke sessions");
        },
        onSuccess: () => {
            toast.success("All other sessions revoked successfully");
            queryClient.invalidateQueries({ queryKey: USER_SESSIONS_KEY });
        },
        onError: (error: Error) => toast.error(`Failed to revoke sessions: ${error.message}`),
    });

    return (
        <section className="space-y-4">
            <SectionDivider label="Active Sessions" />
            <div className="space-y-3">
                {isLoading ? (
                    [1, 2].map((i) => (
                        <div key={i} className="rounded-sm border border-border/50 p-4">
                            <div className="flex items-start gap-4">
                                <Skeleton className="size-10 rounded-sm shrink-0" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-3 w-56" />
                                </div>
                                <Skeleton className="h-8 w-16 shrink-0" />
                            </div>
                        </div>
                    ))
                ) : sessionsError ? (
                    <p className="text-sm text-destructive py-4">Could not load sessions: {sessionsError.message}</p>
                ) : sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No active sessions found</p>
                ) : (
                    <>
                        {sortedSessions.map((sessionItem) => {
                            const isCurrent = sessionItem.token === currentToken;
                            const parsed = parseUserAgent(sessionItem.userAgent);
                            const DeviceIcon =
                                parsed.device === "Phone" ? Smartphone : parsed.device === "Tablet" ? Tablet : Monitor;

                            return (
                                <div
                                    key={sessionItem.id}
                                    className={`rounded-sm border p-3 sm:p-4 transition-colors ${isCurrent ? "border-primary/30 bg-primary/3" : "border-border/50 hover:border-border"}`}>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex size-9 shrink-0 items-center justify-center rounded-sm ${isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                            <DeviceIcon className="size-4" strokeWidth={1.5} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-light truncate text-sm">{parsed.summary}</p>
                                                {isCurrent && (
                                                    <Badge
                                                        variant="default"
                                                        className="text-[10px] tracking-widest uppercase px-1.5 py-0 shrink-0">
                                                        Current
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground/50 truncate">
                                                {sessionItem.userAgent || "Unknown user agent"}
                                            </p>
                                        </div>
                                        {!isCurrent && (
                                            <Button
                                                onClick={() => revokeMutation.mutate(sessionItem.token)}
                                                variant="destructive"
                                                size="sm"
                                                disabled={revokeMutation.isPending}
                                                className="shrink-0">
                                                Revoke
                                            </Button>
                                        )}
                                    </div>
                                    <div className="mt-2 ml-12 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                        {sessionItem.ipAddress && (
                                            <span className="inline-flex items-center gap-1">
                                                <MapPin className="size-3 shrink-0" />
                                                {sessionItem.ipAddress}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1">
                                            <Clock className="size-3 shrink-0" />
                                            {formatDistanceToNow(new Date(sessionItem.createdAt), { addSuffix: true })}
                                            <span className="text-border">·</span>
                                            {new Date(sessionItem.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {sessions.length > 1 && (
                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={() => revokeAllMutation.mutate()}
                                    variant="destructive"
                                    size="sm"
                                    disabled={revokeAllMutation.isPending}>
                                    {revokeAllMutation.isPending ? "Revoking..." : "Revoke All Other Sessions"}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
