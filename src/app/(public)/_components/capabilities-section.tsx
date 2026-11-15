const capabilities = [
    {
        num: "01",
        title: "Manage",
        desc: "Multi-account file management with tree view, batch operations, and drag & drop uploads.",
    },
    { num: "02", title: "Discover", desc: "Stremio addons, cross-source search with ratings and trailers." },
    { num: "03", title: "Stream", desc: "Play to VLC, Kodi, MPV, and 6 more players. Track progress across devices." },
];

export function CapabilitiesSection() {
    return (
        <section className="px-6 py-12 md:py-20 md:px-12 lg:px-20 bg-muted/15">
            <div className="max-w-7xl mx-auto space-y-6 md:space-y-10">
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-xs text-muted-foreground tracking-widest uppercase">What you can do</span>
                    <div className="flex-1 h-px bg-border/50" />
                </div>

                <div className="grid md:grid-cols-3">
                    {capabilities.map((step, i) => (
                        <div
                            key={step.num}
                            className={`py-4 first:pt-0 last:pb-0 md:py-0 md:px-6 lg:px-8 first:md:pl-0 last:md:pr-0 ${i > 0 ? "border-t md:border-t-0 md:border-l border-border/40" : ""}`}>
                            <div className="flex items-baseline gap-2 mb-1.5">
                                <span className="text-xs tracking-widest text-primary/50">{step.num}</span>
                                <h3 className="text-base sm:text-lg font-light">{step.title}</h3>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
