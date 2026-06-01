'use client';

import {
  BookOpen,
  Database,
  FilePlus,
  Pencil,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Reveal } from '@/components/reveal';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Mode = 'read' | 'edit' | 'agent';

const MODE_LABELS: Record<Mode, string> = {
  read: 'Read-only',
  edit: 'Edit doc',
  agent: 'Full agent',
};

const MODE_TOOLS: Record<Mode, ReadonlyArray<string>> = {
  read: ['Search workspace', 'Read docs'],
  edit: ['Search workspace', 'Read docs', 'Edit docs'],
  agent: [
    'Search workspace',
    'Read docs',
    'Edit docs',
    'Create docs',
    'Data views',
  ],
};

const ALL_TOOLS = [
  { id: 'Search workspace', icon: Search },
  { id: 'Read docs', icon: BookOpen },
  { id: 'Edit docs', icon: Pencil },
  { id: 'Create docs', icon: FilePlus },
  { id: 'Data views', icon: Database },
] as const;

const MODE_REPLY: Record<Mode, string> = {
  read: 'I found 3 meeting docs from last week. Here is a summary you can copy. I will not write to any document in Read-only mode.',
  edit: 'I summarized 3 meeting docs and edited the open document with the action plan. I left the doc structure intact and added a new heading at the top.',
  agent:
    'I summarized 3 meeting docs, drafted a follow-up plan into a new doc, tagged 5 tasks with owners, and linked them to your active database.',
};

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Multi-model auto-routing',
    body: 'Routes each task to the best model. Fast models for tagging, frontier models for reasoning.',
  },
  {
    icon: Zap,
    title: 'Permission-aware tools',
    body: 'Read-only, Edit, or Full Agent mode. AI only does what you authorize. No surprise edits.',
  },
  {
    icon: BookOpen,
    title: 'AI Auto Tag',
    body: 'Reads doc content and applies tags from your taxonomy. No manual labeling.',
  },
] as const;

export function AiDemo() {
  const [mode, setMode] = useState<Mode>('agent');
  const [typedMode, setTypedMode] = useState<Mode | null>(null);

  // Run the typing animation each time mode changes.
  useEffect(() => {
    const t = setTimeout(() => setTypedMode(mode), 1400);
    return () => clearTimeout(t);
  }, [mode]);

  const enabledTools = useMemo(() => new Set(MODE_TOOLS[mode]), [mode]);
  const typed = typedMode === mode;

  return (
    <section
      id="ai"
      aria-labelledby="ai-heading"
      className="section-pad relative border-y border-border"
    >
      <div
        aria-hidden
        className="bg-spectrum pointer-events-none absolute inset-x-0 top-0 h-96 opacity-70"
      />

      <div className="container-prose grid items-start gap-12 md:grid-cols-2 md:gap-16">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-20px_oklch(0_0_0/0.18)] dark:shadow-[0_20px_60px_-20px_oklch(0_0_0/0.55)]">
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-border bg-muted/40 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-background"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
                <span className="text-[13px] font-semibold tracking-tight">
                  Manut AI
                </span>
              </div>

              <div
                role="tablist"
                aria-label="AI mode"
                className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:ml-auto sm:overflow-visible sm:px-0 sm:pb-0"
              >
                {(Object.keys(MODE_LABELS) as Mode[]).map(m => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors sm:py-1',
                      mode === m
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                    )}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-[13px] text-background">
                Summarize last week&apos;s meeting notes and draft a follow-up
                action plan.
              </div>

              <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-3 text-[13px] leading-relaxed">
                <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Sparkles className="size-3" aria-hidden /> Manut AI ·{' '}
                  {MODE_LABELS[mode]}
                </div>
                {typed ? (
                  <>
                    <p className="text-foreground">{MODE_REPLY[mode]}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(mode === 'agent'
                        ? ['Doc created', '5 tasks added', '3 owners assigned']
                        : mode === 'edit'
                          ? ['Doc edited', 'Action plan inserted']
                          : ['Summary ready', 'Read-only']
                      ).map(label => (
                        <Badge
                          key={label}
                          variant="secondary"
                          className="rounded-full font-mono text-[10px]"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <div aria-label="AI is typing" className="flex gap-1.5 py-1">
                    <span
                      aria-hidden
                      className="size-1.5 animate-[bounce_1.2s_infinite] rounded-full bg-muted-foreground"
                    />
                    <span
                      aria-hidden
                      className="size-1.5 animate-[bounce_1.2s_infinite_0.2s] rounded-full bg-muted-foreground"
                    />
                    <span
                      aria-hidden
                      className="size-1.5 animate-[bounce_1.2s_infinite_0.4s] rounded-full bg-muted-foreground"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Input bar */}
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13px] text-muted-foreground">
              Ask anything or give Manut AI a task…
            </div>

            {/* Tool chips */}
            <div className="border-t border-border px-5 py-3">
              <div className="flex flex-wrap gap-1.5">
                {ALL_TOOLS.map(t => {
                  const enabled = enabledTools.has(t.id);
                  const Icon = t.icon;
                  return (
                    <span
                      key={t.id}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors',
                        enabled
                          ? 'border-accent/50 bg-accent/30 text-accent-foreground'
                          : 'border-border bg-background text-muted-foreground'
                      )}
                    >
                      <Icon className="size-3" aria-hidden />
                      {t.id}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <p className="kicker kicker-line">AI tools</p>
          <h2
            id="ai-heading"
            className="mt-4 text-balance text-[clamp(1.875rem,3.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.025em]"
          >
            An AI agent that
            <br />
            <span className="display-italic">actually works.</span>
          </h2>
          <p className="mt-5 max-w-prose text-pretty text-base text-muted-foreground sm:text-lg">
            Manut AI is a true agent. It reads your workspace, writes to your
            docs, creates new pages, filters databases, and tags content.
            Powered by Gemini, Claude, and Llama on Vertex AI.
          </p>

          <ul className="mt-8 space-y-5">
            {FEATURES.map(f => (
              <li key={f.title} className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/[0.04] text-foreground"
                >
                  <f.icon className="size-4" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
