"use client";

import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { primaryNav, siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[backdrop-filter,background,border-color] duration-200",
        "border-b border-transparent",
        scrolled &&
          "border-border/60 bg-background/80 backdrop-blur-xl backdrop-saturate-150"
      )}
    >
      <div className="container-prose flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"
          aria-label={`${siteConfig.name} home`}
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-md bg-foreground font-bold text-background"
          >
            S
          </span>
          {siteConfig.name}
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={siteConfig.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="#"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
          >
            Sign in
          </Link>
          <ButtonLink
            href="#pricing"
            size="sm"
            className="rounded-full bg-foreground px-4 py-2 text-background hover:bg-foreground/90"
          >
            Get started
            <ArrowRight className="size-3.5" aria-hidden />
          </ButtonLink>

          <Sheet>
            <SheetTrigger
              aria-label="Open menu"
              className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            >
              <Menu className="size-4" aria-hidden />
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="mt-6 flex flex-col px-6">
                {primaryNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="border-b border-border py-4 text-lg font-medium tracking-tight"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href={siteConfig.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-b border-border py-4 text-lg font-medium tracking-tight"
                >
                  GitHub
                </Link>
                <Link href="#" className="py-4 text-lg font-medium tracking-tight">
                  Sign in
                </Link>
                <ButtonLink
                  href="#pricing"
                  className="mt-6 h-11 w-full rounded-full bg-foreground text-background hover:bg-foreground/90"
                >
                  Get started
                  <ArrowRight className="size-3.5" aria-hidden />
                </ButtonLink>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
