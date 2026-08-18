"use client";

import { SearchCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// The sheet pulls in a drawer, a dropzone and a bencode parser for a feature most sessions
// never open, so it stays out of the explorer's bundle until it is wanted.
const CacheCheckPanel = dynamic(() => import("./cache-check-panel").then((m) => m.CacheCheckPanel), { ssr: false });

export function CacheCheck() {
    const [open, setOpen] = useState(false);
    // Bumped per open so the panel remounts with clean state instead of resetting itself
    const [session, setSession] = useState(0);

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                    setSession((n) => n + 1);
                    setOpen(true);
                }}
                aria-label="Check cache"
                className="size-8 sm:size-9 text-muted-foreground hover:text-foreground">
                <SearchCheck className="size-5 sm:size-[22px]" strokeWidth={1.5} />
            </Button>

            {session > 0 ? <CacheCheckPanel key={session} open={open} onOpenChange={setOpen} /> : null}
        </>
    );
}
