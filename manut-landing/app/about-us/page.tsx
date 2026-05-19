import { ArrowRight, Globe2, Rocket, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal } from '@/components/reveal';
import { SiteFooter } from '@/components/sections/site-footer';
import { SiteNav } from '@/components/site-nav';
import { ButtonLink } from '@/components/ui/button';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About us',
  description:
    'Manut is the open-source AI workspace built for teams that ship — docs, databases, whiteboards, and a permissioned multi-model agent in one tab.',
  alternates: { canonical: `${siteConfig.url}/about-us` },
  openGraph: {
    title: 'About Manut',
    description:
      'Open-source. AI-first. Built for teams that ship at internet speed.',
    url: `${siteConfig.url}/about-us`,
  },
};

const values = [
  {
    icon: <Sparkles className="size-5" aria-hidden />,
    title: 'AI that asks before it edits',
    body: 'Multi-model by default — Gemini, Claude, Llama, and more. Every write goes through an approval gate so your team stays in the driver seat.',
  },
  {
    icon: <Globe2 className="size-5" aria-hidden />,
    title: 'Open-source by default',
    body: 'MIT-licensed, self-hostable, and built on the AFFiNE block engine. No vendor lock-in, no AI-fork tax, no data leaving your VPC unless you want it to.',
  },
  {
    icon: <Rocket className="size-5" aria-hidden />,
    title: 'Built for teams that ship',
    body: 'Docs, kanban, whiteboard, calendar, and an agent runtime in one tab. No more duct-taping Notion + Miro + ChatGPT to move a sprint forward.',
  },
];

export default function AboutUs() {
  return (
    <>
      <SiteNav />
      <main id="main" className="flex min-w-0 flex-col overflow-x-clip">
        <section className="section-pad relative">
          <div className="container-prose">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="kicker kicker-line">About Manut</p>
              <h1 className="mt-4 text-balance text-[clamp(2rem,4.2vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.025em]">
                The workspace that{' '}
                <span className="display-italic text-gen-z-gradient">
                  works with you
                </span>
                , not against you.
              </h1>
              <p className="mt-6 text-pretty text-base text-muted-foreground sm:text-lg">
                Manut is the open-source AI workspace for fast teams. We
                started Manut because the modern stack — Notion for docs, Miro
                for whiteboards, Linear for tasks, ChatGPT for thinking — is a
                tab-switching tax disguised as a productivity stack. We&apos;re
                consolidating it, with an AI co-pilot that knows your whole
                workspace and asks before it edits.
              </p>
            </Reveal>
          </div>
        </section>

        <section
          aria-labelledby="values-heading"
          className="section-pad relative"
        >
          <div className="container-prose">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="kicker kicker-line">What we believe</p>
              <h2
                id="values-heading"
                className="mt-4 text-balance text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.025em]"
              >
                Three opinions we won&apos;t compromise on.
              </h2>
            </Reveal>
            <Reveal
              delay={120}
              className="mt-14 grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3 [&>article]:bg-card"
            >
              {values.map(v => (
                <article
                  key={v.title}
                  className="group relative isolate flex flex-col gap-4 p-7 transition-colors hover:bg-muted/50 sm:p-8"
                >
                  <div className="grid size-11 place-items-center rounded-xl bg-foreground/[0.04] text-foreground transition-transform group-hover:-translate-y-0.5">
                    {v.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                      {v.title}
                    </h3>
                    <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
                      {v.body}
                    </p>
                  </div>
                </article>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="section-pad relative">
          <div className="container-prose">
            <Reveal className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 sm:p-12">
              <p className="kicker kicker-line">The company</p>
              <h2 className="mt-4 text-balance text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
                Manut is built by GoGoCash.
              </h2>
              <p className="mt-5 text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                We&apos;re a small, opinionated team operating out of Southeast
                Asia. We build the tools we wish existed when we were running
                product at our last companies. Manut is our bet on AI-native
                workspaces becoming the default in the next two years —
                permissioned, auditable, and open-source.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink href="/contact-us" className="rounded-full">
                  Get in touch
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </ButtonLink>
                <Link
                  href={siteConfig.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  View on GitHub
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
