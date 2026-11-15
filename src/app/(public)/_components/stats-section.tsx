import { ACCOUNT_TYPE_LABELS, EXTENSION_TO_FILE_TYPE } from "@/lib/constants";
import { MediaPlayer } from "@/lib/schemas";

const highlights = [
    {
        value: String(Object.keys(ACCOUNT_TYPE_LABELS).length),
        label: "Providers",
        detail: Object.values(ACCOUNT_TYPE_LABELS).join(", "),
    },
    {
        value: `${Object.keys(EXTENSION_TO_FILE_TYPE).length}+`,
        label: "File previews",
        detail: "Video, audio, images, documents, and more",
    },
    {
        value: String(Object.values(MediaPlayer).length),
        label: "External players",
        detail:
            Object.values(MediaPlayer).length > 8
                ? `${Object.values(MediaPlayer).slice(0, 8).join(", ")}, and more`
                : Object.values(MediaPlayer).join(", "),
    },
    { value: "100%", label: "Open source", detail: "GPL-3.0 licensed, community-driven" },
];

export function StatsSection() {
    return (
        <section id="stats" className="border-y border-border/50 bg-muted/10">
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4">
                {highlights.map((stat, i) => (
                    <div
                        key={stat.label}
                        className={`px-5 py-5 sm:px-6 sm:py-6 md:py-8 lg:px-8 ${i % 2 === 1 ? "border-l border-border/40" : ""} ${i >= 2 ? "border-t md:border-t-0 border-border/40" : ""} ${i >= 2 ? "md:border-l md:border-border/40" : ""}`}>
                        <div className="sm:flex sm:items-baseline sm:gap-2 mb-1">
                            <div className="text-2xl sm:text-3xl md:text-4xl font-light text-foreground leading-none tracking-tight">
                                {stat.value}
                            </div>
                            <div className="text-[9px] sm:text-[10px] tracking-widest uppercase text-muted-foreground/50 mt-1 sm:mt-0">
                                {stat.label}
                            </div>
                        </div>
                        <p className="text-[11px] sm:text-xs text-muted-foreground/50 leading-relaxed">{stat.detail}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
