import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/auth";
import { readSavedSimklPlayback } from "@/lib/simkl/service";
import { DashboardContent } from "./_components/dashboard-content";

export default async function DashboardPage() {
    const session = await getRequestSession();
    if (!session) redirect("/login");

    const userId = session.user.id;
    const savedPlayback = await readSavedSimklPlayback(userId).catch(() => undefined);
    return <DashboardContent startup={{ userId, savedPlayback }} />;
}
