"use client";

import { SearchIcon } from "lucide-react";
import { memo } from "react";
import { DISCORD_URL } from "@/lib/constants";

// Welcome hero section with editorial minimalism
export const WelcomeSection = memo(function WelcomeSection({ onSearchClick }: { onSearchClick: () => void }) {
    return (
        <section className="relative py-12 lg:py-20 lg:px-6">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Top row: Editorial label + social links */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-px w-8 bg-primary" />
                        <span className="text-xs tracking-widest uppercase text-muted-foreground">
                            Welcome to DebridUI
                        </span>
                    </div>
                    <div
                        className="flex items-center gap-1 animate-in fade-in-0"
                        style={{ animationDuration: "600ms", animationDelay: "400ms", animationFillMode: "backwards" }}>
                        {DISCORD_URL && (
                            <a
                                href={DISCORD_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Discord"
                                className="group size-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-300">
                                <img
                                    src="https://simpleicons.org/icons/discord.svg"
                                    alt=""
                                    className="size-4 opacity-50 dark:invert group-hover:opacity-100 transition-opacity duration-300"
                                    loading="lazy"
                                />
                            </a>
                        )}
                        <a
                            href="https://github.com/viperadnan-git/debridui"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub"
                            className="group size-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-300">
                            <img
                                src="https://simpleicons.org/icons/github.svg"
                                alt=""
                                className="size-4 opacity-50 dark:invert group-hover:opacity-100 transition-opacity duration-300"
                                loading="lazy"
                            />
                        </a>
                    </div>
                </div>

                {/* Headline with staggered animation */}
                <div className="space-y-2">
                    <h1
                        className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight animate-in fade-in-0 slide-in-from-bottom-4"
                        style={{ animationDuration: "600ms" }}>
                        Discover
                    </h1>
                    <h1
                        className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-4"
                        style={{ animationDuration: "600ms", animationDelay: "100ms", animationFillMode: "backwards" }}>
                        & Stream
                    </h1>
                </div>

                {/* Description */}
                <p
                    className="text-sm text-muted-foreground max-w-md leading-relaxed animate-in fade-in-0"
                    style={{ animationDuration: "600ms", animationDelay: "200ms", animationFillMode: "backwards" }}>
                    A modern debrid client for managing your files, discovering trending movies and shows — with addon
                    support and streaming to your preferred media player.
                </p>

                {/* Search bar */}
                <div
                    className="max-w-md animate-in fade-in-0 slide-in-from-bottom-2"
                    style={{ animationDuration: "600ms", animationDelay: "300ms", animationFillMode: "backwards" }}>
                    <button
                        type="button"
                        onClick={onSearchClick}
                        className="group w-full flex items-center gap-3 h-11 px-4 text-sm text-muted-foreground bg-transparent hover:bg-muted/30 border border-border/50 hover:border-border rounded-sm transition-all duration-300">
                        <SearchIcon className="size-4 text-muted-foreground/60 group-hover:text-foreground transition-colors duration-300" />
                        <span className="flex-1 text-left">Search movies, shows, files...</span>
                        <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded-sm border border-border/50 bg-muted/30 px-2 font-mono text-xs text-muted-foreground">
                            ⌘K
                        </kbd>
                    </button>
                </div>
            </div>
        </section>
    );
});
