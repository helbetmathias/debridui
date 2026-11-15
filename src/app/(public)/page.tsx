import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CapabilitiesSection } from "./_components/capabilities-section";
import { CommunitySection } from "./_components/community-section";
import { FeaturesSection } from "./_components/features-section";
import { HeroSection } from "./_components/hero-section";
import { PreviewSection } from "./_components/preview-section";
import { SiteFooter } from "./_components/site-footer";
import { StatsSection } from "./_components/stats-section";
import { TechSection } from "./_components/tech-section";

export default async function Home() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) redirect("/dashboard");

    return (
        <div className="min-h-screen">
            <HeroSection />
            <StatsSection />
            <PreviewSection />
            <CapabilitiesSection />
            <FeaturesSection />
            <TechSection />
            <CommunitySection />
            <SiteFooter />
        </div>
    );
}
