import { Quote } from "lucide-react";

import { Reveal } from "@/components/reveal";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
  swatch: string;
}

const TESTIMONIALS: ReadonlyArray<Testimonial> = [
  {
    quote:
      "We replaced Notion, Miro, and our project tracker in one week. AI Auto Tag saves our team two hours a day of manual labeling.",
    name: "David Park",
    role: "CTO, DataCo Asia",
    initials: "DP",
    swatch: "linear-gradient(135deg,oklch(0.75_0.18_250),oklch(0.85_0.15_140))",
  },
  {
    quote:
      "Multi-model auto-routing means we get fast tagging on small tasks and Claude-grade reasoning on the hard ones. The agent is actually trustworthy.",
    name: "Sarah Lim",
    role: "VP Engineering, MedTech",
    initials: "SL",
    swatch: "linear-gradient(135deg,oklch(0.85_0.15_140),oklch(0.75_0.18_85))",
  },
  {
    quote:
      "Full Agent mode is genuinely impressive. I give it a transcript and it ships an action plan, assigns owners, and tags everything in under 30 seconds.",
    name: "Marcus Chen",
    role: "Founder, BuildFast Studio",
    initials: "MC",
    swatch: "linear-gradient(135deg,oklch(0.78_0.18_30),oklch(0.7_0.18_310))",
  },
];

export function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="relative py-24 sm:py-32"
    >
      <div className="container-prose">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="kicker kicker-line">Voices</p>
          <h2
            id="testimonials-heading"
            className="mt-4 text-balance text-[clamp(1.875rem,3.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.025em]"
          >
            Teams love
            <span className="display-italic"> Superflow.</span>
          </h2>
        </Reveal>

        <Reveal
          delay={120}
          className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-7 sm:p-8"
            >
              <Quote className="size-5 text-accent" aria-hidden />
              <blockquote className="flex-1 text-[15px] leading-relaxed text-foreground">
                {t.quote}
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-full text-sm font-semibold text-foreground shadow-sm"
                  style={{ background: t.swatch }}
                >
                  {t.initials}
                </span>
                <div>
                  <div className="text-sm font-semibold tracking-tight">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
