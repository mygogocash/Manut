import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "green"
  | "amber"
  | "red"
  | "gold"
  | "blue"
  | "grey"
  | "purple"
  | "teal"
  | "violet";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  green: "bg-success/10 text-success border-transparent",
  amber: "bg-warning/10 text-warning border-transparent",
  red: "bg-destructive/10 text-destructive border-transparent",
  gold: "bg-primary/10 text-primary border-transparent",
  blue: "bg-info/10 text-info border-transparent",
  grey: "bg-foreground/5 text-muted-foreground border-transparent",
  // Project-deploy taxonomy added in #514 — Tailwind colour utilities
  // rather than semantic tokens because the design needs three more
  // discrete states than the semantic palette offers. Light/dark mode
  // legibility tuned via the `dark:` variant on the text shade.
  purple:
    "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-transparent",
  teal: "bg-teal-500/15 text-teal-800 dark:text-teal-300 border-transparent",
  violet:
    "bg-violet-700/15 text-violet-900 dark:text-violet-300 border-transparent",
};

const STATUS_MAP: Record<string, BadgeVariant> = {
  active: "green",
  approved: "green",
  completed: "green",
  live: "green",
  paid: "green",
  posted: "green",
  received: "green",
  sent: "green",
  pending: "amber",
  pending_cancellation: "amber",
  draft: "amber",
  processing: "amber",
  // BD project taxonomy — `in_progress` shows on red per the visual
  // spec shared 2026-05-22 (active work needs the attention-grabbing
  // colour; testing/staging/prod use the cool end of the palette).
  in_progress: "red",
  expiring_soon: "amber",
  committed: "amber",
  pledged: "amber",
  prospect: "blue",
  lead: "blue",
  discovery_call: "blue",
  dd: "violet",
  verbal_commitment: "amber",
  agreement_signed: "purple",
  funds_cleared: "green",
  relationship_management: "teal",
  engaged: "blue",
  planning: "blue",
  qualified: "blue",
  proposal: "blue",
  negotiation: "blue",
  rejected: "red",
  cancelled: "red",
  expired: "red",
  churned: "red",
  closed_lost: "red",
  overdue: "red",
  // BD project taxonomy — on_hold sits on blue per the 2026-05-22
  // spec ("paused" reads calmer than the previous red attention-flag).
  on_hold: "blue",
  inactive: "grey",
  unmatched: "grey",
  closed_won: "green",
  reconciled: "green",
  matched: "green",
  vesting: "amber",
  vested: "green",
  exercised: "gold",
  // BD project roll-out states (2026-05-22 visual spec):
  //   not_yet_started (cream)        → amber
  //   in_progress     (red)          → red    (above, attention)
  //   on_hold         (blue)         → blue   (above, paused)
  //   uat             (deep purple)  → violet (testing)
  //   staging_integrated (lavender)  → purple (staged)
  //   prod_integrated  (teal/cyan)   → teal   (deployed)
  //   completed       (green)        → green
  not_yet_started: "amber",
  uat: "violet",
  staging_integrated: "purple",
  prod_integrated: "teal",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  status?: string;
  className?: string;
}

export function Badge({ children, variant, status, className }: BadgeProps) {
  const resolvedVariant =
    variant ||
    (status ? STATUS_MAP[status.toLowerCase()] : undefined) ||
    "grey";

  return (
    <ShadcnBadge
      className={cn(
        `
          h-5 rounded-sm px-2 py-0.5 text-[10px] leading-none font-semibold
          capitalize
        `,
        VARIANT_STYLES[resolvedVariant],
        className,
      )}
    >
      {children}
    </ShadcnBadge>
  );
}
