import { ScanLine, ShieldCheck, Unlock } from 'lucide-react';

import { GithubIcon } from '@/components/icons/github';
import { Reveal } from '@/components/reveal';
import { ButtonLink } from '@/components/ui/button';
import { siteConfig, stats } from '@/lib/site';

const POINTS = [
  {
    icon: Unlock,
    title: 'MIT licensed, forever',
    body: 'Commercial use, modification, distribution. No vendor lock-in. Fork and ship.',
  },
  {
    icon: ScanLine,
    title: 'Auditable security',
    body: 'Open codebase means no black boxes. Run your own pen-test. Review every auth flow.',
  },
  {
    icon: ShieldCheck,
    title: 'Active development',
    body: 'Tracks the AFFiNE canary branch upstream and ships Manut features on top.',
  },
] as const;

const COMMITS = [
  {
    color: 'oklch(0.7_0.18_140)',
    text: 'feat: AI write tools and Mode picker',
    time: '2d ago',
  },
  {
    color: 'oklch(0.7_0.16_280)',
    text: 'fix: SSE parser and auto-tag accuracy',
    time: '4d ago',
  },
  {
    color: 'oklch(0.7_0.16_240)',
    text: 'feat: Calendar integration (Google, CalDAV)',
    time: '1w ago',
  },
  {
    color: 'oklch(0.78_0.18_85)',
    text: 'feat: Multi-model auto-routing (Llama, Mistral)',
    time: '2w ago',
  },
] as const;

export function OpenSource() {
  return (
    <section aria-labelledby="oss-heading" className="section-pad relative">
      <div className="container-prose grid gap-12 md:grid-cols-2 md:gap-20">
        <Reveal>
          <p className="kicker kicker-line">Open source</p>
          <h2
            id="oss-heading"
            className="mt-4 text-balance text-[clamp(1.875rem,3.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.025em]"
          >
            Built in the open.
            <br />
            <span className="display-italic">Trusted by design.</span>
          </h2>
          <p className="mt-5 max-w-prose text-pretty text-base text-muted-foreground sm:text-lg">
            Manut is an open-source fork of AFFiNE — one of the most starred
            productivity repos on GitHub. Every line is auditable. Every
            deployment is yours.
          </p>

          <ul className="mt-8 space-y-5">
            {POINTS.map(p => (
              <li key={p.title} className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/[0.04] text-foreground"
                >
                  <p.icon className="size-4" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <ButtonLink
            href={siteConfig.github}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            className="mt-8 h-10 rounded-full px-5"
          >
            <GithubIcon className="size-4" aria-hidden />
            Browse the source
          </ButtonLink>
        </Reveal>

        <Reveal delay={140}>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
            {[
              { num: stats.stars, label: 'GitHub stars', grad: true },
              {
                num: 'MIT',
                label: 'License',
                color: 'text-emerald-500 dark:text-emerald-400',
              },
              { num: '∞', label: 'Seat limit', color: 'text-foreground' },
              {
                num: stats.release,
                label: 'Latest release',
                color: 'text-foreground',
              },
            ].map((s, i) => (
              <div key={i} className="bg-card p-7 sm:p-8">
                <div
                  className={
                    'nums-tabular text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-[-0.04em] ' +
                    (s.grad
                      ? 'bg-[linear-gradient(135deg,oklch(0.18_0.01_260),oklch(0.78_0.16_25))] bg-clip-text text-transparent dark:bg-[linear-gradient(135deg,oklch(0.96_0.005_85),oklch(0.74_0.17_25))]'
                      : (s.color ?? ''))
                  }
                >
                  {s.num}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-card p-6">
            <div className="kicker mb-4">Recent commits</div>
            <ul className="space-y-3">
              {COMMITS.map(c => (
                <li
                  key={c.text}
                  className="flex min-w-0 items-center gap-3 text-[13px]"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: c.color }}
                  />
                  <span className="min-w-0 truncate text-foreground">
                    {c.text}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                    {c.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
