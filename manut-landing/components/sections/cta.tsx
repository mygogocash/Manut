import { ArrowRight, Check } from 'lucide-react';

import { Reveal } from '@/components/reveal';
import { ButtonLink } from '@/components/ui/button';
import { siteConfig } from '@/lib/site';

const POINTS = [
  'No credit card required',
  '14-day free trial',
  'Cancel any time',
  'AI included',
] as const;

export function Cta() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="relative overflow-hidden py-28 sm:py-36"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,oklch(0.88_0.18_130/0.18)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_50%_50%,oklch(0.85_0.19_132/0.10)_0%,transparent_60%)]"
      />

      <div className="container-prose relative">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="kicker kicker-line">Get started</p>
          <h2
            id="cta-heading"
            className="mt-4 text-balance text-[clamp(2rem,4.5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em]"
          >
            Ready to <span className="display-italic">think faster?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-pretty text-base text-muted-foreground sm:text-lg">
            Spin up a workspace in seconds. Bring your team and your docs. Let
            AI do the rest.
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
              href={`mailto:${siteConfig.email}`}
              size="lg"
              variant="outline"
              className="h-12 rounded-full px-6 text-base"
            >
              Talk to us
            </ButtonLink>
          </div>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {POINTS.map(p => (
              <li
                key={p}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
              >
                <Check
                  className="size-3.5 text-accent-foreground"
                  aria-hidden
                />
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
