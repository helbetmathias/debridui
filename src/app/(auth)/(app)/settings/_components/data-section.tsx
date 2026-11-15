"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionDivider } from "@/components/layout/section-divider";
import { Button } from "@/components/ui/button";
import { useClearSearchHistory } from "@/features/search/hooks/use-search-history";

export function DataSection() {
    const { mutate: clearSearch } = useClearSearchHistory();
    const [confirmClearSearch, setConfirmClearSearch] = useState(false);

    return (
        <>
            <section className="space-y-4">
                <SectionDivider label="Data" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-sm border border-border/50 p-3">
                    <div>
                        <p className="text-sm">Search History</p>
                        <p className="text-xs text-muted-foreground">Remove recent searches from this browser only</p>
                    </div>
                    <Button variant="outline" onClick={() => setConfirmClearSearch(true)}>
                        Clear History
                    </Button>
                </div>
            </section>
            <ConfirmDialog
                open={confirmClearSearch}
                onOpenChange={setConfirmClearSearch}
                title="Clear search history?"
                description="This will remove recent searches stored in this browser. This action cannot be undone."
                confirmText="Clear all"
                variant="destructive"
                onConfirm={() => clearSearch()}
            />
        </>
    );
}
