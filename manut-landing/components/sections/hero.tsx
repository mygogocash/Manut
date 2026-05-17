import { ArrowRight, ShieldCheck, Sparkles, Star, Users } from 'lucide-react';
import Image from 'next/image';

import { GithubIcon } from '@/components/icons/github';
import { ProductMockup } from '@/components/sections/product-mockup';
import { ButtonLink } from '@/components/ui/button';
import { siteConfig } from '@/lib/site';

// Set to '/newton-hero.jpeg' once you save the illustration to
// manut-landing/public/newton-hero.jpeg. Until then, the hero shows
// only the spectrum wash + headline (no broken image placeholder).
const HERO_ILLUSTRATION: string | null = '/newton-hero.jpeg';

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pt-24 sm:pt-32"
    >
      {/* Spectrum wash — coral / gold / teal refraction behind the headline */}
      <div
        aria-hidden
        className="bg-spectrum pointer-events-none absolute inset-x-0 -top-32 h-[560px]"
      />

      <div className="container-prose relative">
        {HERO_ILLUSTRATION ? (
          <figure className="mx-auto mb-14 max-w-4xl sm:mb-20">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-[0_30px_80px_-20px_oklch(0_0_0/0.22)] dark:shadow-[0_30px_80px_-20px_oklch(0_0_0/0.65)]">
              <Image
                src={HERO_ILLUSTRATION}
                alt="Newton observing light through a prism — a scene from the Manut workspace illustrations."
                width={1024}
                height={687}
                priority
                sizes="(max-width: 1024px) 92vw, 960px"
                className="h-auto w-full"
              />
              <div
                aria-hidden
                className="bg-rainbow-strip absolute inset-x-0 bottom-0 h-[3px] opacity-80"
              />
            </div>
            <figcaption className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Light, refracted into a workspace
            </figcaption>
          </figure>
        ) : null}

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
            that <span className="display-italic text-foreground">
              thinks
            </span>{' '}
            with you.
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Docs, databases, whiteboards, and a real AI agent. Built for teams
            who think fast and ship faster.
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
