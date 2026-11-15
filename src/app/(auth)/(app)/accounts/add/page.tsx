"use client";

import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AddAccountForm } from "@/features/accounts/components/add-account-form";

export default function AddAccountPage() {
    return (
        <div className="mx-auto w-full max-w-4xl space-y-8 pb-16">
            <PageHeader
                icon={UserPlus}
                title="Add Account"
                description="Pick a service, then paste its API key"
                divider
            />

            <div className="max-w-xl mx-auto">
                <AddAccountForm />
            </div>
        </div>
    );
}
