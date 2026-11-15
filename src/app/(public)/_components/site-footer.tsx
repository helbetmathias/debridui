import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
    return (
        <>
            <section className="px-6 py-10 md:px-12 lg:px-20 border-t border-border/50 bg-muted/10">
                <div className="max-w-7xl mx-auto">
                    <div className="max-w-xl">
                        <div className="text-[10px] text-muted-foreground/60 tracking-widest uppercase mb-2">
                            Disclaimer
                        </div>
                        <p className="text-xs text-muted-foreground/60 leading-relaxed mb-2">
                            DebridUI is a client interface only and does not provide, host, or stream any content. It
                            connects to third-party debrid service APIs to display authorized users&apos; private files.
                            Users are solely responsible for ensuring their use complies with applicable laws and
                            service terms.
                        </p>
                        <Link
                            href="https://github.com/viperadnan-git/debridui/blob/main/DISCLAIMER.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-4">
                            Full disclaimer
                        </Link>
                    </div>
                </div>
            </section>
            <footer className="px-6 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] md:px-12 lg:px-20 border-t border-border/50">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Image
                            className="dark:invert h-3.5 w-auto opacity-50"
                            src="/logo.svg"
                            alt="DebridUI"
                            width={70}
                            height={22}
                        />
                        <span className="text-[10px] text-muted-foreground/50">&copy; {new Date().getFullYear()}</span>
                    </div>
                    <nav className="flex items-center gap-5 text-[10px] tracking-wider uppercase">
                        <Link
                            href="https://github.com/viperadnan-git/debridui#readme"
                            target="_blank"
                            className="text-muted-foreground/50 hover:text-foreground transition-colors">
                            Docs
                        </Link>
                        <Link
                            href="https://github.com/viperadnan-git/debridui/issues"
                            target="_blank"
                            className="text-muted-foreground/50 hover:text-foreground transition-colors">
                            Issues
                        </Link>
                        <Link
                            href="https://github.com/viperadnan-git/debridui/blob/main/LICENSE"
                            target="_blank"
                            className="text-muted-foreground/50 hover:text-foreground transition-colors">
                            GPL-3.0
                        </Link>
                    </nav>
                </div>
            </footer>
        </>
    );
}
