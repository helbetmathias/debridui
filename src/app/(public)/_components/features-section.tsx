export function FeaturesSection() {
    return (
        <section className="px-6 py-16 md:py-28 md:px-12 lg:px-20">
            <div className="max-w-7xl mx-auto space-y-10 md:space-y-20">
                <div className="max-w-md">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-px w-6 bg-primary" />
                        <span className="text-xs tracking-widest uppercase text-muted-foreground">
                            Everything included
                        </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-light">
                        Built for power users who value <span className="text-muted-foreground">simplicity</span>
                    </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/50">
                    {[
                        { title: "Multi-account", desc: "Manage multiple debrid accounts from a single dashboard" },
                        { title: "Real-time tracking", desc: "Monitor downloads and transfers as they happen" },
                        { title: "Stremio addons", desc: "Browse and install Stremio-compatible content addons" },
                        {
                            title: "Auto playback",
                            desc: "Automatically select the best sources for instant streaming",
                        },
                        {
                            title: "Keyboard shortcuts",
                            desc: "Navigate the entire interface without touching the mouse",
                        },
                        {
                            title: "Dark & light themes",
                            desc: "Refined editorial design that adapts to your preference",
                        },
                        {
                            title: "Drag & drop uploads",
                            desc: "Add torrents and magnets by dropping them into the browser",
                        },
                        {
                            title: "Episode browser",
                            desc: "Navigate TV shows by season and episode with progress tracking",
                        },
                        {
                            title: "Cross-source search",
                            desc: "Search across all connected accounts and addon sources at once",
                        },
                    ].map((feature, i, arr) => (
                        <div
                            key={feature.title}
                            className={`bg-background p-4 sm:p-6 md:p-8 group hover:bg-muted/30 transition-colors duration-300 ${i === arr.length - 1 ? "col-span-2 lg:col-span-1" : ""}`}>
                            <h4 className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 group-hover:text-primary transition-colors duration-300">
                                {feature.title}
                            </h4>
                            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
