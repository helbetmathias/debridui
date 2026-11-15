import { ArrowRightIcon, ArrowUpRightIcon, ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS, DISCORD_URL } from "@/lib/constants";
import { AccountType } from "@/lib/schemas";

export function HeroSection() {
    return (
        <section className="relative min-h-svh flex flex-col overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Subtle radial glow */}
                <div className="absolute top-[10%] right-[5%] w-[50%] h-[60%] bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_70%)] opacity-[0.03]" />
                <div className="absolute bottom-[5%] left-[10%] w-[35%] h-[40%] bg-[radial-gradient(ellipse_at_center,var(--secondary)_0%,transparent_70%)] opacity-[0.025]" />
                {/* Decorative vertical rules */}
                <div className="hidden lg:block absolute top-0 bottom-0 left-[calc(50%-1px)] w-px bg-border/20" />
                <div className="hidden xl:block absolute top-0 bottom-0 left-[25%] w-px bg-border/10" />
                <div className="hidden xl:block absolute top-0 bottom-0 right-[25%] w-px bg-border/10" />
                {/* Horizontal rule accent */}
                <div className="absolute top-[38%] left-0 right-0 h-px bg-border/15 hidden md:block" />
            </div>

            {/* ── Navigation bar ── */}
            <nav
                className="relative z-10 px-6 py-5 pt-[max(env(safe-area-inset-top),1.25rem)] md:px-12 lg:px-20 flex items-center justify-between animate-in fade-in-0"
                style={{ animationDuration: "600ms" }}>
                <div
                    className="animate-in fade-in-0 slide-in-from-left-4"
                    style={{ animationDuration: "600ms", animationDelay: "100ms", animationFillMode: "backwards" }}>
                    <Image
                        className="dark:invert h-4 sm:h-5 w-auto"
                        src="/logo.svg"
                        alt="DebridUI"
                        width={100}
                        height={32}
                        priority
                    />
                </div>
                <div
                    className="flex items-center gap-3 sm:gap-5 animate-in fade-in-0 slide-in-from-right-4"
                    style={{ animationDuration: "600ms", animationDelay: "100ms", animationFillMode: "backwards" }}>
                    <Link
                        href="https://github.com/viperadnan-git/debridui"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
                        GitHub
                        <ArrowUpRightIcon className="inline size-2.5 ml-0.5 opacity-40" />
                    </Link>
                    {DISCORD_URL && (
                        <Link
                            href={DISCORD_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
                            Discord
                        </Link>
                    )}
                </div>
            </nav>

            {/* ── Main hero content ── */}
            <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-20 py-12 md:py-16">
                <div className="max-w-7xl mx-auto w-full">
                    {/* Eyebrow label */}
                    <div
                        className="flex items-center gap-3 mb-8 md:mb-12 animate-in fade-in-0"
                        style={{
                            animationDuration: "500ms",
                            animationDelay: "200ms",
                            animationFillMode: "backwards",
                        }}>
                        <div className="size-1.5 bg-primary" />
                        <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
                            Open Source Debrid Client
                        </span>
                    </div>

                    {/* Headline — massive typography with staggered reveal */}
                    <div className="mb-10 md:mb-14">
                        <div
                            className="overflow-hidden animate-in fade-in-0 slide-in-from-bottom-8"
                            style={{
                                animationDuration: "700ms",
                                animationDelay: "300ms",
                                animationFillMode: "backwards",
                            }}>
                            <h1 className="text-[clamp(2rem,7vw,5.5rem)] font-light leading-none tracking-tight">
                                <span className="text-muted-foreground/60">Your media,</span>
                            </h1>
                        </div>
                        <div
                            className="overflow-hidden animate-in fade-in-0 slide-in-from-bottom-8"
                            style={{
                                animationDuration: "700ms",
                                animationDelay: "420ms",
                                animationFillMode: "backwards",
                            }}>
                            <h1 className="text-[clamp(2rem,7vw,5.5rem)] font-light leading-none tracking-tight">
                                <span className="text-foreground">one interface</span>
                                <span className="text-primary">.</span>
                            </h1>
                        </div>
                    </div>

                    {/* Subheadline + CTA — side by side on desktop */}
                    <div className="grid lg:grid-cols-[1fr_auto] gap-8 lg:gap-16 items-end">
                        <div
                            className="max-w-md animate-in fade-in-0 slide-in-from-bottom-6"
                            style={{
                                animationDuration: "600ms",
                                animationDelay: "550ms",
                                animationFillMode: "backwards",
                            }}>
                            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
                                Manage files, discover content, and stream to any player — with stremio addons support.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button asChild size="lg" className="h-10 px-6 tracking-wide">
                                    <Link href="/dashboard">
                                        Get Started
                                        <ArrowRightIcon className="size-4 ml-2" />
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" size="lg" className="h-10 px-5 tracking-wide">
                                    <Link
                                        href="https://github.com/viperadnan-git/debridui"
                                        target="_blank"
                                        rel="noopener noreferrer">
                                        <img
                                            src="https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/github.svg"
                                            alt="GitHub logo"
                                            width={14}
                                            height={14}
                                            className="size-3.5 dark:invert mr-2 opacity-50"
                                        />
                                        Source
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        {/* Provider strip — right-aligned on desktop */}
                        <div
                            className="animate-in fade-in-0"
                            style={{
                                animationDuration: "600ms",
                                animationDelay: "700ms",
                                animationFillMode: "backwards",
                            }}>
                            <div className="text-[10px] tracking-widest uppercase text-muted-foreground/50 mb-3">
                                Supported providers
                            </div>
                            <div className="grid grid-cols-2 md:flex md:items-center gap-2 md:gap-3">
                                {Object.values(AccountType).map((type) => (
                                    <div
                                        key={type}
                                        className="group flex items-center gap-2 md:pr-3 md:border-r border-border/30 md:last:border-0 md:last:pr-0">
                                        <Image
                                            src={ACCOUNT_TYPE_ICONS[type]}
                                            alt={ACCOUNT_TYPE_LABELS[type]}
                                            width={16}
                                            height={16}
                                            className="size-4 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
                                            unoptimized
                                        />
                                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                                            {ACCOUNT_TYPE_LABELS[type]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scroll indicator */}
            <a
                href="#stats"
                className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors animate-in fade-in-0"
                style={{ animationDuration: "600ms", animationDelay: "1000ms", animationFillMode: "backwards" }}>
                <ChevronDownIcon className="size-5 animate-bounce" style={{ animationDuration: "2s" }} />
            </a>
        </section>
    );
}
