"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SectionDivider } from "@/components/layout/section-divider";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { clearAppCache } from "@/lib/utils";
import { AUTH_ACCOUNTS_KEY } from "./password-section";

// Delete Account Section
export function DeleteAccountSection() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: AUTH_ACCOUNTS_KEY,
        queryFn: async () => {
            const response = await authClient.listAccounts();
            if (response.error) throw new Error(response.error.message || "Failed to fetch accounts");
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const hasPassword = accounts.some((account) => account.providerId === "credential");

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsDeleting(true);
        const toastId = toast.loading("Deleting account...");

        const { error } = await authClient.deleteUser({
            password,
            callbackURL: "/",
        });

        if (error) {
            toast.error(`Failed to delete account: ${error.message}`, { id: toastId });
            setIsDeleting(false);
        } else {
            await clearAppCache();
            toast.success("Account deleted", { id: toastId });
        }
    };

    return (
        <section className="space-y-4">
            <SectionDivider label="Danger Zone" />
            <div className="rounded-sm border border-destructive/30 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="font-light">Delete Account</p>
                        <p className="text-xs text-muted-foreground">
                            Permanently delete your account and all associated data
                        </p>
                    </div>
                    {isLoading ? (
                        <Skeleton className="h-9 w-32" />
                    ) : hasPassword ? (
                        <Dialog
                            open={dialogOpen}
                            onOpenChange={(open) => {
                                setDialogOpen(open);
                                if (!open) setPassword("");
                            }}>
                            <DialogTrigger asChild>
                                <Button variant="destructive" className="w-full sm:w-auto">
                                    Delete Account
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="size-5 text-destructive" />
                                        Delete Account
                                    </DialogTitle>
                                    <DialogDescription>
                                        This action cannot be undone. All your data will be permanently deleted.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleDelete} className="space-y-4">
                                    <div className="space-y-2">
                                        <label htmlFor="delete-password" className="text-sm">
                                            Enter your password to confirm:
                                        </label>
                                        <Input
                                            id="delete-password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Password"
                                            disabled={isDeleting}
                                            required
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setDialogOpen(false)}
                                            disabled={isDeleting}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" variant="destructive" disabled={isDeleting}>
                                            {isDeleting ? "Deleting..." : "Delete Account"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    ) : (
                        <p className="text-xs text-muted-foreground">Set a password above to enable account deletion</p>
                    )}
                </div>
            </div>
        </section>
    );
}
