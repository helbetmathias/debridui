"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <ErrorScreen
            tone="failed"
            title="This page stopped loading"
            description="Something broke while rendering it. Trying again usually fixes it."
            detail={error.message || undefined}
            reference={error.digest}
            actions={
                <>
                    <Button onClick={reset}>Try again</Button>
                    <Button variant="outline" asChild>
                        <Link href="/dashboard">Go to dashboard</Link>
                    </Button>
                </>
            }
        />
    );
}
