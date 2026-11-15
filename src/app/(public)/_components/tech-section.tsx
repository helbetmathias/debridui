import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const techStack = [
    { name: "Next.js", icon: "nextdotjs" },
    { name: "TypeScript", icon: "typescript" },
    { name: "Tailwind", icon: "tailwindcss" },
    { name: "PostgreSQL", icon: "postgresql" },
];

export function TechSection() {
    return (
        <section className="border-y border-border/50 bg-muted/10">
            <div className="max-w-7xl mx-auto grid md:grid-cols-2">
                {/* Tech stack */}
                <div className="px-6 py-12 md:py-16 md:px-12 lg:px-16 md:border-r border-border/50">
                    <div className="text-[10px] tracking-widest uppercase text-muted-foreground mb-6">Built with</div>
                    <div className="flex flex-wrap gap-6">
                        {techStack.map((tech) => (
                            <span key={tech.name} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <img
                                    src={`https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/${tech.icon}.svg`}
                                    alt={`${tech.name} logo`}
                                    width={14}
                                    height={14}
                                    className="size-3.5 opacity-40 dark:invert"
                                />
                                {tech.name}
                            </span>
                        ))}
                    </div>
                </div>
                {/* CTA */}
                <div className="px-6 py-12 md:py-16 md:px-12 lg:px-16 border-t md:border-t-0 border-border/50">
                    <div className="text-[10px] tracking-widest uppercase text-muted-foreground mb-6">Get started</div>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
                        Free and open source. No credit card, no tracking, no compromises.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button asChild size="lg" className="h-10 px-6">
                            <Link href="/dashboard">
                                Open App
                                <ArrowRightIcon className="size-4 ml-2" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="default" className="h-10 px-5">
                            <Link
                                href="https://github.com/viperadnan-git/debridui"
                                target="_blank"
                                rel="noopener noreferrer">
                                Star on GitHub
                                <ArrowUpRightIcon className="size-3 ml-1.5 opacity-50" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
