import { ArrowRight, ShieldCheck, Sparkles, Star, Users } from "lucide-react";

import { GithubIcon } from "@/components/icons/github";
import { ProductMockup } from "@/components/sections/product-mockup";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pt-24 sm:pt-32"
    >
      {/* Soft top wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-[480px] bg-[radial-gradient(ellipse_at_50%_0%,oklch(0.88_0.18_130/0.18)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_50%_0%,oklch(0.85_0.19_132/0.10)_0%,transparent_60%)]"
      />

      <div className="container-prose relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3.5 py-1.5 backdrop-blur-sm">
            <Sparkles className="size-3.5 text-foreground" aria-hidden />
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-foreground">
              New
            </span>
            <span className="text-xs text-muted-foreground">
              AI write tools and multi-model auto-routing
            </span>
          </div>

          <h1
            id="hero-heading"
            className="text-balance text-[clamp(2.5rem,6vw,5.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground"
          >
            The workspace
            <br />
            that <span className="display-italic text-foreground">thinks</span> with you.
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Docs, databases, whiteboards, and a real AI agent. Built for teams who think fast and ship faster.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink
              href="#pricing"
              size="lg"
              className="h-12 rounded-full bg-foreground px-6 text-base text-background hover:bg-foreground/90"
            >
              Start free
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink
              href={siteConfig.github}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-border bg-background px-6 text-base hover:bg-muted"
            >
              <GithubIcon className="size-4" aria-hidden />
              Star on GitHub
            </ButtonLink>
          </div>

          <ul
            aria-label="At a glance"
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2.5 text-xs text-muted-foreground"
          >
            <li className="flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              50,000+ users
            </li>
            <li className="flex items-center gap-1.5">
              <Star className="size-3.5" aria-hidden />
              40,000+ GitHub stars
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden />
              SOC 2 ready
            </li>
            <li className="flex items-center gap-1.5">
              <GithubIcon className="size-3.5" aria-hidden />
              MIT open source
            </li>
          </ul>
        </div>

        <ProductMockup />
      </div>
    </section>
  );
}
