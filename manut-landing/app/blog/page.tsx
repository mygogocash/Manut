import { ArrowRight, FileText, Rss } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { GithubIcon } from '@/components/icons/github';
import { Reveal } from '@/components/reveal';
import { SiteFooter } from '@/components/sections/site-footer';
import { SiteNav } from '@/components/site-nav';
import { ButtonLink } from '@/components/ui/button';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Engineering, product, and operating notes from the Manut team. Build logs, release notes, and the occasional deep dive.',
  alternates: { canonical: `${siteConfig.url}/blog` },
  openGraph: {
    title: 'Manut blog',
    description:
      'Engineering notes, product updates, and build logs from the Manut team.',
    url: `${siteConfig.url}/blog`,
  },
};

export default function Blog() {
  return (
    <>
      <SiteNav />
      <main id="main" className="flex min-w-0 flex-col overflow-x-clip">
        <section className="section-pad relative">
          <div className="container-prose">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="kicker kicker-line">Blog</p>
              <h1 className="mt-4 text-balance text-[clamp(2rem,4.2vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.025em]">
                Build logs from{' '}
                <span className="display-italic text-gen-z-gradient">
                  the workshop.
                </span>
              </h1>
              <p className="mt-6 text-pretty text-base text-muted-foreground sm:text-lg">
                Engineering, product, and operating notes from the Manut team.
                Release notes, deep dives on the AI agent runtime, and the
                occasional incident write-up — published when we have
                something honest to say.
              </p>
            </Reveal>

            <Reveal
              delay={140}
              className="mx-auto mt-16 max-w-3xl rounded-2xl border border-dashed border-border bg-card p-10 text-center sm:p-14"
            >
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-foreground/[0.04]">
                <FileText
                  className="size-6 text-foreground"
                  aria-hidden
                />
              </div>
              <h2 className="mt-6 text-balance text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
                Posts coming soon.
              </h2>
              <p className="mt-4 text-pretty text-[15px] text-muted-foreground sm:text-base">
                We&apos;re writing the first batch right now. In the meantime,
                the live changelog is on GitHub — every shipped feature, fix,
                and migration lands there first.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <ButtonLink
                  href={`${siteConfig.github}/releases`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full"
                >
                  Read the changelog
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </ButtonLink>
                <Link
                  href={siteConfig.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <GithubIcon className="size-4" aria-hidden />
                  Source on GitHub
                </Link>
              </div>
            </Reveal>

            <Reveal
              delay={260}
              className="mx-auto mt-10 flex max-w-3xl items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <Rss className="size-4" aria-hidden />
              <span>
                Want a heads-up when posts go live? Star the repo or follow{' '}
                <Link
                  href={`https://twitter.com/${siteConfig.twitter.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
                >
                  {siteConfig.twitter}
                </Link>
                .
              </span>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
