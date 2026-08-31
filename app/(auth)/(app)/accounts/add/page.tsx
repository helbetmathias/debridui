"use client";

import { UserPlus } from "lucide-react";
import { AddAccountForm } from "@/components/add-account-form";
import { PageHeader } from "@/components/page-header";

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
