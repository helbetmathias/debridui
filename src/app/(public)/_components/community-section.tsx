import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DISCORD_URL } from "@/lib/constants";

export function CommunitySection() {
    return (
        <section className="px-6 py-16 md:py-20 md:px-12 lg:px-20">
            <div className="max-w-7xl mx-auto">
                <div className="max-w-md">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-px w-6 bg-primary" />
                        <span className="text-xs tracking-widest uppercase text-muted-foreground">Community</span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-light mb-3">Join the conversation</h2>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                        Get help, share feedback, and stay updated with development.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {DISCORD_URL && (
                            <Button asChild className="h-10 px-5 bg-[#5865F2] hover:bg-[#4752C4] text-white">
                                <Link href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src="https://cdn.simpleicons.org/discord/white"
                                        alt="Discord logo"
                                        width={16}
                                        height={16}
                                        className="size-4 mr-2"
                                    />
                                    Discord
                                </Link>
                            </Button>
                        )}
                        <Button asChild variant="outline" className="h-10 px-5">
                            <Link
                                href="https://github.com/viperadnan-git/debridui"
                                target="_blank"
                                rel="noopener noreferrer">
                                <img
                                    src="https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/github.svg"
                                    alt="GitHub logo"
                                    width={16}
                                    height={16}
                                    className="size-4 dark:invert mr-2 opacity-60"
                                />
                                GitHub
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
