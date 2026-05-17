'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';

import { Reveal } from '@/components/reveal';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { type Plan, plans } from '@/lib/site';
import { cn } from '@/lib/utils';

type Billing = 'monthly' | 'annual';

function priceLabel(
  plan: Plan,
  billing: Billing
): { value: string; sub: string } {
  if (plan.priceLabel) return { value: plan.priceLabel, sub: 'Custom' };
  const price = billing === 'annual' ? plan.priceAnnual : plan.priceMonthly;
  if (price === 0) return { value: '$0', sub: 'Free forever' };
  return {
    value: `$${price}`,
    sub:
      billing === 'annual'
        ? 'per user / month, billed annually'
        : 'per user / month',
  };
}

export function Pricing() {
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="section-pad relative border-y border-border"
    >
      <div className="container-prose">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="kicker kicker-line">Pricing</p>
          <h2
            id="pricing-heading"
            className="mt-4 text-balance text-[clamp(1.875rem,3.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.025em]"
          >
            Simple, honest pricing.
          </h2>
          <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
            Start free. Upgrade when your team grows. Cancel any time.
          </p>

          {/* Billing toggle */}
          <div
            role="tablist"
            aria-label="Billing period"
            className="mx-auto mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1"
          >
            {(['monthly', 'annual'] as Billing[]).map(b => (
              <button
                key={b}
                role="tab"
                aria-selected={billing === b}
                onClick={() => setBilling(b)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  billing === b
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {b === 'monthly' ? (
                  'Monthly'
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Annual
                    <Badge className="rounded-full bg-accent px-1.5 text-[10px] font-mono uppercase tracking-wider text-accent-foreground hover:bg-accent">
                      -20%
                    </Badge>
                  </span>
                )}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal
          delay={120}
          className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:mt-14 sm:rounded-3xl md:grid-cols-3"
        >
          {plans.map(plan => {
            const { value, sub } = priceLabel(plan, billing);
            return (
              <article
                key={plan.id}
                aria-label={`${plan.name} plan`}
                className={cn(
                  'relative flex flex-col p-6 sm:p-8 md:p-9',
                  plan.featured ? 'bg-foreground text-background' : 'bg-card'
                )}
              >
                {plan.featured ? (
                  <div className="absolute right-6 top-6">
                    <Badge className="rounded-full bg-accent text-accent-foreground hover:bg-accent">
                      Most popular
                    </Badge>
                  </div>
                ) : null}

                <div
                  className={cn(
                    'kicker',
                    plan.featured
                      ? 'text-background/60'
                      : 'text-muted-foreground'
                  )}
                >
                  {plan.name}
                </div>

                <div className="mt-5 flex items-baseline gap-2">
                  <span className="nums-tabular text-[clamp(2.5rem,5vw,3.5rem)] font-semibold leading-none tracking-[-0.04em]">
                    {value}
                  </span>
                </div>
                <p
                  className={cn(
                    'mt-2 text-[13px]',
                    plan.featured
                      ? 'text-background/70'
                      : 'text-muted-foreground'
                  )}
                >
                  {sub}
                </p>
                <p
                  className={cn(
                    'mt-3 text-[14px] leading-relaxed',
                    plan.featured ? 'text-background/85' : 'text-foreground/80'
                  )}
                >
                  {plan.blurb}
                </p>

                <ul className="mt-7 flex flex-1 flex-col gap-3">
                  {plan.features.map(f => (
                    <li
                      key={f}
                      className={cn(
                        'flex items-start gap-2.5 text-[14px] leading-relaxed',
                        plan.featured ? 'text-background/90' : 'text-foreground'
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full',
                          plan.featured
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-foreground/10'
                        )}
                      >
                        <Check
                          className={cn(
                            'size-3 stroke-[2.5]',
                            plan.featured
                              ? 'text-accent-foreground'
                              : 'text-foreground'
                          )}
                          aria-hidden
                        />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href={plan.cta.href}
                  size="lg"
                  className={cn(
                    'mt-8 h-11 w-full rounded-full',
                    plan.featured
                      ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                      : 'bg-foreground text-background hover:bg-foreground/90'
                  )}
                >
                  {plan.cta.label}
                </ButtonLink>
              </article>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
