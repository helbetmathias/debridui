"use client";

import { Suspense } from "react";
import { useAuthGuaranteed } from "@/features/auth/components/auth-provider";
import { FileExplorer } from "@/features/files/components/file-explorer";

export default function AccountPage() {
    const { currentAccount } = useAuthGuaranteed();
    return (
        <Suspense fallback={null}>
            <FileExplorer key={currentAccount.id} />
        </Suspense>
    );
}
