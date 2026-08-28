"use client";

import Image from "next/image";
import Link from "next/link";
import { AddAccountForm } from "@/components/add-account-form";
import { UserMenu } from "@/components/auth/user-menu";

export default function OnboardingPage() {
    return (
        <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
            <UserMenu />

            <div className="w-full max-w-md">
                <div className="flex flex-col items-center gap-2 mb-6">
                    <Link href="/" className="flex flex-col items-center gap-2 font-medium">
                        <div className="flex size-12 items-center justify-center">
                            <Image
                                src="/icon.svg"
                                alt="DebridUI"
                                width={48}
                                height={48}
                                className="invert dark:invert-0"
                            />
                        </div>
                        <span className="sr-only">DebridUI</span>
                    </Link>
                    <h1 className="text-xl font-bold">Setup Your Account</h1>
                    <p className="text-sm text-muted-foreground text-center">Pick your debrid service to get started</p>
                </div>
                <AddAccountForm />
            </div>
        </div>
    );
}
