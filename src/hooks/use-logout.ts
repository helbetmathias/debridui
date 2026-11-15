"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { clearAppCache } from "@/lib/utils";

/** Sign-out with cache teardown. Independent of AuthProvider, so error and 404 screens can use it. */
export function useLogout() {
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const logout = useCallback(async () => {
        setIsLoggingOut(true);
        const toastId = toast.loading("Logging out...");
        try {
            await clearAppCache();
            await authClient.signOut();

            toast.success("Logged out successfully", { id: toastId });
            router.push("/login");
        } catch (error) {
            toast.error("Failed to logout", { id: toastId });
            console.error("Error logging out:", error);
        } finally {
            setIsLoggingOut(false);
        }
    }, [router]);

    return { logout, isLoggingOut };
}
