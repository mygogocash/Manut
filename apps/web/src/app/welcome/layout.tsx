import type { Metadata } from "next";

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

export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingLayout>{children}</MarketingLayout>;
}
