import "@/app/globals.css";

import type { Metadata } from "next";
import { DM_Mono, DM_Sans, DM_Serif_Display } from "next/font/google";
import NextTopLoader from "nextjs-toploader";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";

// `DM_Sans` is the body font on every page so it stays preloaded.
// `DM_Serif_Display` (headings on a handful of pages) and `DM_Mono`
// (small tabular cells, code) only render on a subset of routes —
// keeping them in the preload list triggered the "preloaded using
// link preload but not used within a few seconds" console warning on
// pages that don't render them (e.g. /hr-crm). Next.js still loads
// the font when its CSS variable is used; `preload: false` only
// suppresses the `<link rel="preload">` hint.
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  preload: false,
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: "400",
  preload: false,
});

export const metadata: Metadata = {
  title: "Intranet — Manut",
  description: "Enterprise operations platform for Manut",
  icons: {
    icon: [{ url: "/manut-circle-logo.ico", type: "image/x-icon" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        dmSerif.variable,
        dmMono.variable,
        "font-sans",
        dmSans.variable,
      )}
    >
      <body>
        <NextTopLoader
          color="#8B6B3D"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #8B6B3D, 0 0 5px #8B6B3D"
        />
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>{children}</AuthProvider>
            <Toaster richColors />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
