import {
  CalendarDays,
  Database,
  FileText,
  Layers,
  Lock,
  Users2,
} from "lucide-react";
import type { ReactNode } from "react";

import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FeatureProps {
  title: string;
  description: string;
  icon: ReactNode;
  span?: "wide" | "default";
  accent?: boolean;
  badges?: ReactNode;
}

function Feature({ title, description, icon, span = "default", accent, badges }: FeatureProps) {
  return (
    <article
      className={cn(
        "group relative isolate flex flex-col gap-4 p-7 sm:p-8",
        "bg-card transition-colors hover:bg-muted/50",
        span === "wide" && "md:col-span-2",
        accent && "md:col-span-2"
      )}
    >
      <div
        className={cn(
          "grid size-11 place-items-center rounded-xl",
          "bg-foreground/[0.04] text-foreground transition-transform group-hover:-translate-y-0.5"
        )}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {badges ? <div className="mt-auto pt-2">{badges}</div> : null}
    </article>
  );
}

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="relative py-24 sm:py-32"
    >
      <div className="container-prose">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="kicker kicker-line">Platform</p>
          <h2
            id="features-heading"
            className="mt-4 text-balance text-[clamp(1.875rem,3.4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em]"
          >
            Everything your team needs.
            <br />
            <span className="display-italic text-muted-foreground">Nothing they don&apos;t.</span>
          </h2>
          <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
            One workspace replaces your notes app, project tracker, whiteboard, and AI assistant.
          </p>
        </Reveal>

        <Reveal
          delay={120}
          className="mt-16 grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3 [&>article]:bg-card"
        >
          <Feature
            span="wide"
            icon={<FileText className="size-5" aria-hidden />}
            title="Docs and rich notes"
            description="Block-based editor with markdown, embeds, code, tables, and bi-directional links. Your second brain, structured the way you think."
            badges={
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="rounded-full font-mono text-[10px]">
                  Markdown
                </Badge>
                <Badge variant="secondary" className="rounded-full font-mono text-[10px]">
                  Tables
                </Badge>
                <Badge variant="secondary" className="rounded-full font-mono text-[10px]">
                  Code blocks
                </Badge>
                <Badge className="rounded-full bg-accent text-accent-foreground font-mono text-[10px]">
                  AI write tools
                </Badge>
              </div>
            }
          />
          <Feature
            icon={<Database className="size-5" aria-hidden />}
            title="Databases and views"
            description="11 layouts: table, kanban, calendar, gallery, timeline, and more. AI can filter and autofill columns automatically."
          />
          <Feature
            icon={<Layers className="size-5" aria-hidden />}
            title="Infinite whiteboard"
            description="Edgeless canvas for diagramming, wireframing, and visual thinking. No grid limits, no export friction."
          />
          <Feature
            icon={<CalendarDays className="size-5" aria-hidden />}
            title="Calendar integration"
            description="Connect Google Calendar or CalDAV. View meetings, attach docs, and let AI prep your agenda."
          />
          <Feature
            icon={<Users2 className="size-5" aria-hidden />}
            title="Real-time collaboration"
            description="CRDT-powered live editing with presence, comments, and version history. Works offline, syncs when back."
          />
          <Feature
            span="wide"
            icon={<Lock className="size-5" aria-hidden />}
            title="Privacy and compliance"
            description="Encryption at rest and in transit. Granular access controls, audit logs, SSO, and SCIM. Built for healthcare, legal, and finance teams that need hard guarantees on data handling."
            badges={
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="rounded-full font-mono text-[10px]">
                  HIPAA-ready
                </Badge>
                <Badge variant="secondary" className="rounded-full font-mono text-[10px]">
                  SOC 2 posture
                </Badge>
                <Badge variant="secondary" className="rounded-full font-mono text-[10px]">
                  GDPR compliant
                </Badge>
              </div>
            }
          />
        </Reveal>
      </div>
    </section>
  );
}
