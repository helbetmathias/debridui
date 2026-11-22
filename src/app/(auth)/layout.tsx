import { redirect } from "next/navigation";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import { getRequestSession } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
    const session = await getRequestSession();
    if (!session) redirect("/login");

    return <AuthProvider>{children}</AuthProvider>;
}
