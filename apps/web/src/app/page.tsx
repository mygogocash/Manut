import type { Metadata } from "next";

import { HomepageSessionRouter } from "@/components/landing/homepage-session-router";
import { LandingView } from "@/components/landing/landing-view";
import { MarketingLayout } from "@/components/landing/marketing-layout";

export const metadata: Metadata = {
  title: "Manut — People, money, and work. Finally, together.",
  description:
    "Manut brings your team, approvals, and projects into one clear workspace—so your business can grow with less busywork.",
  alternates: {
    canonical: "/",
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return (
    <MarketingLayout>
      <HomepageSessionRouter />
      <LandingView isHomepage={true} />
    </MarketingLayout>
  );
}
