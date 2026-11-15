"use client";

import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";

interface SplashErrorScreenProps {
    title: string;
    description?: string;
    error?: Error | null;
    onRetry?: () => void;
    onDelete?: () => void;
}

/** Full-viewport error raised above the router, e.g. while the session or account loads. */
export function SplashErrorScreen({ title, description, error, onRetry, onDelete }: SplashErrorScreenProps) {
    return (
        <ErrorScreen
            overlay
            tone="failed"
            title={title}
            description={description}
            detail={error?.message}
            actions={
                <>
                    {onRetry && <Button onClick={onRetry}>Try again</Button>}
                    {onDelete && (
                        <Button
                            variant="outline"
                            onClick={onDelete}
                            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                            Remove account
                        </Button>
                    )}
                </>
            }
        />
    );
}
