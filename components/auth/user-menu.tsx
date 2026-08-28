"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/hooks/use-logout";
import { authClient } from "@/lib/auth-client";
import { cn, getInitials } from "@/lib/utils";

/**
 * Account control for standalone screens that have no sidebar — onboarding, errors, 404.
 * Reads the session directly so it works outside AuthProvider, and renders nothing signed out.
 */
export function UserMenu({ className }: { className?: string }) {
    const { data: session } = authClient.useSession();
    const { logout, isLoggingOut } = useLogout();
    const [confirming, setConfirming] = useState(false);

    if (!session?.user) return null;

    const { name, email, image } = session.user;
    const label = name || email || "User";

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Account"
                        className={cn("fixed top-4 right-4 z-50 rounded-full", className)}>
                        <Avatar className="size-7 rounded-full border border-border/50">
                            <AvatarImage src={image || ""} alt={label} />
                            <AvatarFallback className="text-xs">{getInitials(label)}</AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
                    <DropdownMenuLabel className="p-0 font-normal">
                        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                            <Avatar className="size-8 rounded-sm border border-border/50">
                                <AvatarImage src={image || ""} alt={label} />
                                <AvatarFallback className="text-xs">{getInitials(label)}</AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 leading-tight">
                                <span className="truncate font-light">{label}</span>
                                {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
                            </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => setConfirming(true)}
                        disabled={isLoggingOut}
                        className="text-destructive focus:text-destructive">
                        <LogOut />
                        {isLoggingOut ? "Logging out..." : "Log out"}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title="Log out"
                description="Are you sure you want to log out? You will need to sign in again to access your account."
                confirmText="Log out"
                cancelText="Cancel"
                onConfirm={() => {
                    setConfirming(false);
                    logout();
                }}
                variant="destructive"
            />
        </>
    );
}
