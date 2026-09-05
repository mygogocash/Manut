import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Manrope } from "next/font/google";

import { ForceLightTheme } from "@/components/landing/force-light-theme";
import "@/components/landing/landing.css";

const manutDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-manut-display",
  display: "swap",
});

const manutSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-manut-sans",
  display: "swap",
});

const manutTag = Manrope({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-manut-tag",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Manut — Operations workspace for SMEs",
  description:
    "Manut brings people, money, and work into one calm workspace for growing businesses.",
  robots: { index: true, follow: true },
};

export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`manut-landing ${manutDisplay.variable} ${manutSans.variable} ${manutTag.variable}`}
      data-theme="light"
    >
      <ForceLightTheme />
      {children}
    </div>
  );
}
