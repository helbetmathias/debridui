import { Gallery } from "./gallery";

const screenshots = [
    {
        id: "dashboard",
        label: "Dashboard",
        src: {
            default: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-1.jpg",
            mobile: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-mobile-1.jpg",
        },
    },
    {
        id: "explorer",
        label: "Explorer",
        src: {
            default: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-2.jpg",
            mobile: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-mobile-2.jpg",
        },
    },
    {
        id: "media",
        label: "Media",
        src: {
            default: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-3.jpg",
            mobile: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-mobile-3.jpg",
        },
    },
    {
        id: "search",
        label: "Search",
        src: {
            default: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-4.jpg",
            mobile: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-mobile-4.jpg",
        },
    },
    {
        id: "addons",
        label: "Addons",
        src: {
            default: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-5.jpg",
            mobile: "https://res.cloudinary.com/viperadnan/image/upload/v1769483514/debridui-mockup-mobile-5.jpg",
        },
    },
];

export function PreviewSection() {
    return (
        <section className="px-6 py-20 md:py-28 md:px-12 lg:px-20">
            <div className="max-w-7xl mx-auto">
                <div className="grid md:grid-cols-[200px_1fr] lg:grid-cols-[260px_1fr] gap-8 md:gap-12 items-start">
                    {/* Section label — stacked left on desktop */}
                    <div className="md:sticky md:top-24 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-px w-6 bg-primary" />
                            <span className="text-xs tracking-widest uppercase text-muted-foreground">Preview</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed hidden md:block">
                            Explore the interface across dashboard, file explorer, media player, search, and addon
                            views.
                        </p>
                    </div>
                    {/* Gallery */}
                    <Gallery items={screenshots} />
                </div>
            </div>
        </section>
    );
}
