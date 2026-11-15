"use client";

import { Check, Copy, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

interface ErrorScreenProps {
    /** "failed": something broke mid-way. "missing": nothing exists at the destination. */
    tone: "failed" | "missing";
    title: string;
    /** Large display text above the line; only when it carries meaning (e.g. "404") */
    code?: string;
    description?: ReactNode;
    /** Raw error text, shown verbatim */
    detail?: string;
    /** Server error digest, copyable for bug reports */
    reference?: string;
    actions: ReactNode;
    /** Cover the whole viewport, for errors raised above the router (auth/session) */
    overlay?: boolean;
}

// Where the transfer line halts, as % of its width
const HALT_AT = 62;

export function ErrorScreen({ tone, title, code, description, detail, reference, actions, overlay }: ErrorScreenProps) {
    const failed = tone === "failed";

    return (
        <div className={cn("flex min-h-svh flex-col bg-background", overlay && "fixed inset-0 z-50 overflow-y-auto")}>
            <UserMenu className="z-60" />

            <header className="px-6 pt-[max(env(safe-area-inset-top),1.25rem)] md:px-10">
                <Link href="/" className="inline-flex items-center gap-2.5 text-sm font-medium">
                    <Image src="/icon.svg" alt="" width={24} height={24} className="invert dark:invert-0" />
                    DebridUI
                </Link>
            </header>

            <main className="flex flex-1 items-center px-6 py-16 md:px-10">
                <div className="mx-auto w-full max-w-xl">
                    {code && (
                        <p className="mb-6 text-[clamp(5rem,20vw,8.5rem)] font-light leading-none tracking-tighter tabular-nums text-foreground/90">
                            {code}
                        </p>
                    )}

                    {/* Transfer line: fills, then halts — the page's one moment of motion */}
                    <div aria-hidden className="relative mb-10 h-3">
                        <div
                            className="absolute top-1/2 right-0 border-t border-dashed border-border"
                            style={{ left: `${HALT_AT}%` }}
                        />
                        <div
                            className={cn(
                                "absolute top-1/2 left-0 h-px -translate-y-1/2 origin-left motion-safe:animate-transfer-halt",
                                failed ? "bg-primary" : "bg-muted-foreground/50"
                            )}
                            style={{ width: `${HALT_AT}%` }}
                        />
                        <span
                            className="absolute top-1/2 flex size-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-background motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-50 motion-safe:delay-800 motion-safe:fill-mode-backwards"
                            style={{ left: `${HALT_AT}%` }}>
                            {failed ? (
                                <X className="size-3 text-destructive" strokeWidth={3} />
                            ) : (
                                <span className="size-2.5 rounded-full border border-muted-foreground" />
                            )}
                        </span>
                    </div>

                    <h1 className="text-2xl font-light tracking-tight sm:text-3xl">{title}</h1>
                    {description && (
                        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
                    )}

                    {detail && (
                        <pre className="mt-6 max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word rounded-sm border border-border/50 bg-muted/30 px-3 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
                            {detail}
                        </pre>
                    )}

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div>

                    {reference && <Reference value={reference} />}
                </div>
            </main>
        </div>
    );
}

function Reference({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            onClick={async () => {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            Reference <code className="text-foreground">{value}</code>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
    );
}
