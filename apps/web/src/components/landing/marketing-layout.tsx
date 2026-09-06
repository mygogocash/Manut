import "@/components/landing/landing.css";

import { Instrument_Serif, Inter } from "next/font/google";

// Brand CI §8: editorial voice is Instrument Serif, UI face is Inter.
const manutDisplay = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-manut-display",
  display: "swap",
});

const manutSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manut-sans",
  display: "swap",
});

const manutTag = Inter({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-manut-tag",
  display: "swap",
  preload: false,
});

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`
        manut-landing
        ${manutDisplay.variable}
        ${manutSans.variable}
        ${manutTag.variable}
      `}
      data-theme="light"
    >
      {children}
    </div>
  );
}
