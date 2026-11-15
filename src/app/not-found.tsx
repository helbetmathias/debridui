"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    const pathname = usePathname();

    return (
        <ErrorScreen
            tone="missing"
            code="404"
            title="Nothing at this address"
            description={
                <>
                    <code className="font-mono text-foreground break-all">{pathname}</code>
                    {" doesn't match any page. The link may be mistyped, or the page may have moved."}
                </>
            }
            actions={
                <>
                    <Button asChild>
                        <Link href="/dashboard">Go to dashboard</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/files">Browse files</Link>
                    </Button>
                </>
            }
        />
    );
}
