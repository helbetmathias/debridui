"use client";

import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SplashScreen } from "@/components/splash-screen";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/components/auth-provider";
import { PreviewDialog } from "@/features/preview/components/preview-dialog";
import { SearchButton } from "@/features/search/components/search-button";
import { SearchProvider } from "@/features/search/components/search-provider";
import { AccountQuickSwitch } from "./_components/account-quick-switch";
import { AppSidebar } from "./_components/app-sidebar";
import { BottomTabBar } from "./_components/bottom-tab-bar";

// App layout - requires at least one account
// Redirect logic is centralized in AuthProvider
export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { userAccounts, currentAccount, client } = useAuth();

    // Single check for all required data to prevent flicker
    // AuthProvider handles redirect to /onboarding if no accounts
    const isReady = userAccounts.length > 0 && currentAccount && client;
    if (!isReady) {
        return <SplashScreen />;
    }

    return (
        <SearchProvider>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset className="overflow-x-hidden">
                    <header className="sticky top-0 z-50 shrink-0 pt-safe bg-background border-b border-border/30">
                        <div className="flex h-12 items-center justify-between gap-4 px-4">
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                                <SidebarTrigger className="-ml-1 shrink-0 hidden lg:inline-flex" />
                                <Link
                                    href="/dashboard"
                                    aria-label="DebridUI home"
                                    className="md:hidden flex items-center -ml-1 px-2 h-9 rounded-sm hover:bg-muted/40 active:bg-muted/50 transition-colors">
                                    <Image
                                        src="/logo.svg"
                                        alt="DebridUI"
                                        width={88}
                                        height={20}
                                        priority
                                        className="h-4 w-auto dark:invert"
                                    />
                                </Link>
                                <div className="hidden md:flex min-w-0">
                                    <Breadcrumbs />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <SearchButton className="hidden md:inline-flex" />
                                <div className="md:hidden">
                                    <AccountQuickSwitch />
                                </div>
                            </div>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4 pt-6 pb-mobile-tabbar md:pb-4">{children}</div>
                </SidebarInset>
                <BottomTabBar />
            </SidebarProvider>
            <PreviewDialog />
        </SearchProvider>
    );
}
