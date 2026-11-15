"use client";
import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { authClient } from "@/lib/auth-client";
import { DeleteAccountSection } from "./_components/delete-account-section";
import { PasswordSection } from "./_components/password-section";
import { ProfileSection } from "./_components/profile-section";
import { SessionsSection } from "./_components/sessions-section";

export default function AccountPage() {
    const { data: session } = authClient.useSession();

    return (
        <div className="mx-auto w-full max-w-4xl space-y-8 pb-16">
            <PageHeader icon={UserCog} title="Account" description="Manage your profile and security settings" />
            <ProfileSection session={session} />
            <PasswordSection />
            <SessionsSection currentToken={session?.session.token} />
            <DeleteAccountSection />
        </div>
    );
}
