"use client";

import { KeyRound, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountCard } from "@/features/accounts/components/account-card";
import { useAuth } from "@/features/auth/components/auth-provider";

export default function AccountsPage() {
    const router = useRouter();
    const { userAccounts, currentAccount, refetchAccounts } = useAuth();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const currentAccountId = currentAccount?.id;

    const handleAddAccount = useCallback(() => {
        router.push("/accounts/add");
    }, [router]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refetchAccounts();
        setIsRefreshing(false);
    }, [refetchAccounts]);

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6 lg:space-y-8 pb-16">
            <PageHeader
                icon={KeyRound}
                title="Accounts"
                description="Manage your debrid service accounts"
                divider
                primaryAction={
                    <>
                        <Button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            variant="ghost"
                            size="icon"
                            aria-label="Refresh"
                            className="size-8 sm:size-9 text-muted-foreground hover:text-foreground">
                            <RefreshCw className={`size-5! sm:size-[22px]! ${isRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={handleAddAccount}
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Add account"
                                    className="size-8 sm:size-9 -mr-1.5 text-muted-foreground hover:text-foreground">
                                    <Plus className="size-5! sm:size-[22px]!" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add account</TooltipContent>
                        </Tooltip>
                    </>
                }
            />

            {userAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm font-light text-foreground">No accounts added yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Add your first debrid account to get started</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {userAccounts.map((account) => (
                        <AccountCard
                            key={account.id}
                            account={account}
                            isCurrentAccount={account.id === currentAccountId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
