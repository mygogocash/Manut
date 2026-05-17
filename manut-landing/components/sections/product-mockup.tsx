import { Sparkles } from 'lucide-react';

export function ProductMockup() {
  return (
    <div className="relative mx-auto mt-16 max-w-[1080px] sm:mt-20">
      {/* Coral-teal glow — Newton's prism refracting beneath the canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-20 h-72 bg-[radial-gradient(ellipse_at_30%_center,oklch(0.78_0.16_25/0.30)_0%,transparent_60%),radial-gradient(ellipse_at_70%_center,oklch(0.68_0.13_215/0.26)_0%,transparent_60%)] blur-2xl dark:bg-[radial-gradient(ellipse_at_30%_center,oklch(0.74_0.17_25/0.22)_0%,transparent_60%),radial-gradient(ellipse_at_70%_center,oklch(0.7_0.13_215/0.22)_0%,transparent_60%)]"
      />

      <div className="relative rounded-[20px] border border-border bg-surface shadow-[0_30px_80px_-20px_oklch(0_0_0/0.18)] dark:shadow-[0_30px_80px_-20px_oklch(0_0_0/0.65)]">
        {/* Window chrome */}
        <div className="flex h-9 items-center gap-2 border-b border-border px-4">
          <span aria-hidden className="size-2.5 rounded-full bg-[#ff5f56]/85" />
          <span aria-hidden className="size-2.5 rounded-full bg-[#ffbd2e]/85" />
          <span aria-hidden className="size-2.5 rounded-full bg-[#27c93f]/85" />
          <div className="mx-auto rounded-md bg-muted px-3 py-0.5 font-mono text-[11px] text-muted-foreground">
            manut.xyz / workspace / docs
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[224px_1fr]">
          {/* Sidebar */}
          <aside
            aria-hidden
            className="hidden flex-col gap-1 border-r border-border bg-muted/40 p-3 md:flex"
          >
            <div className="px-2 pt-2 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Workspace
            </div>
            {[
              { label: 'Q2 Strategy', active: true, dot: '📄' },
              { label: 'Task Board', badge: '12', dot: '📊' },
              { label: 'Calendar', dot: '📅' },
              { label: 'AI Chat', dot: '🤖' },
            ].map(item => (
              <div
                key={item.label}
                className={
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ' +
                  (item.active
                    ? 'bg-accent/40 font-medium text-foreground'
                    : 'text-muted-foreground')
                }
              >
                <span aria-hidden>{item.dot}</span>
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto rounded-full bg-accent/60 px-1.5 text-[10px] font-semibold text-accent-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </div>
            ))}
            <div className="mt-3 px-2 pt-2 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Recent
            </div>
            {['Meeting Notes', 'Design Brief', 'Revenue Report'].map(label => (
              <div
                key={label}
                className="rounded-md px-2 py-1.5 text-[13px] text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </aside>

          {/* Content */}
          <div className="overflow-hidden p-7 sm:p-8">
            <div className="mb-5">
              <h3 className="text-xl font-semibold tracking-tight sm:text-[22px]">
                Q2 2026 Growth Strategy
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Last edited by AI Agent · 3 minutes ago · 8 collaborators
              </p>
            </div>

            {/* AI bubble */}
            <div className="mb-3 rounded-xl border border-accent/40 bg-accent/15 p-4 dark:bg-accent/10">
              <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-accent-foreground/80">
                <Sparkles className="size-3" aria-hidden />
                Manut AI · Full Agent Mode
              </div>
              <p className="text-[13px] leading-relaxed text-foreground">
                I analyzed your Q1 metrics and drafted three strategic
                initiatives. Key insight: customer acquisition cost dropped 23%
                in the SEA segment. Recommend doubling down on the Bangkok
                channel.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-foreground/5 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/70">
                  AI generated
                </span>
                <span className="rounded-full bg-foreground/5 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/70">
                  Sources cited
                </span>
                <span className="rounded-full bg-foreground/5 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/70">
                  Edit doc
                </span>
              </div>
            </div>

            {/* Database table */}
            <div className="mb-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Key initiatives
              </div>
              <div className="grid grid-cols-[1fr_90px_72px] gap-px overflow-hidden rounded-md bg-border text-[12px]">
                <div className="bg-background/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Initiative
                </div>
                <div className="bg-background/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Owner
                </div>
                <div className="bg-background/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Status
                </div>
                <div className="bg-card px-2.5 py-1.5 text-foreground">
                  SEA Market Expansion
                </div>
                <div className="bg-card px-2.5 py-1.5 text-muted-foreground">
                  Sarah K.
                </div>
                <div className="bg-card px-2.5 py-1.5">
                  <span className="inline-flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-current"
                    />{' '}
                    Active
                  </span>
                </div>
                <div className="bg-card px-2.5 py-1.5 text-foreground">
                  AI-Assisted Onboarding
                </div>
                <div className="bg-card px-2.5 py-1.5 text-muted-foreground">
                  Team AI
                </div>
                <div className="bg-card px-2.5 py-1.5 text-muted-foreground">
                  In Review
                </div>
                <div className="bg-card px-2.5 py-1.5 text-foreground">
                  Platform Reliability
                </div>
                <div className="bg-card px-2.5 py-1.5 text-muted-foreground">
                  DevOps
                </div>
                <div className="bg-card px-2.5 py-1.5 text-amber-600 dark:text-amber-400">
                  Planned
                </div>
              </div>
            </div>

            {/* Skeleton text */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Executive summary
              </div>
              <div className="space-y-2">
                <div className="h-2.5 w-[92%] rounded bg-foreground/8 dark:bg-foreground/12" />
                <div className="h-2.5 w-[85%] rounded bg-foreground/8 dark:bg-foreground/12" />
                <div className="h-2.5 w-[78%] rounded bg-foreground/8 dark:bg-foreground/12" />
                <div className="h-2.5 w-[60%] rounded bg-foreground/8 dark:bg-foreground/12" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
