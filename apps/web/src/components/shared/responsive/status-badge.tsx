import * as React from "react";

import { cn } from "@/lib/utils";

// One place that decides what a status looks like.
//
// Today each module picks its own colour for "Approved" — some green, some
// bronze, some a bare grey pill — so the same word means different things on
// different screens, and a new module has to guess. This maps a status *string*
// to a semantic tone, and the tone to the palette's existing status tokens.
//
// It is a presentation map only: it never decides what a status *means* to the
// workflow, and adding a status here does not make it valid anywhere.

export type StatusTone =
  "neutral" | "info" | "success" | "warning" | "danger" | "accent" | "violet";

/**
 * Tone classes, as full literals so Tailwind's static scan can see them — a
 * computed `bg-${tone}/10` is purged and renders unstyled (see the Tailwind
 * pitfall in CLAUDE.md).
 *
 * Tinted backgrounds rather than solid fills: a list of solid status pills
 * fights the content for attention, and these appear in dense tables.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  accent: "bg-primary/10 text-primary border-primary/20",
  violet: "bg-violet/10 text-violet border-violet/20",
};

/**
 * Status → tone, keyed on a normalised status string.
 *
 * Covers the vocabularies already in the codebase (workflow, proposals, leave,
 * travel, expenses, accounting, helpdesk). Keys are lower-cased with `_`/`-`
 * collapsed to a space, so `pending_approval`, `pending-approval` and
 * "Pending Approval" all resolve to the same entry.
 */
const STATUS_TONES: Record<string, StatusTone> = {
  // Terminal good
  approved: "success",
  active: "success",
  completed: "success",
  complete: "success",
  paid: "success",
  resolved: "success",
  closed: "neutral",
  done: "success",
  live: "success",
  verified: "success",

  // In flight
  pending: "warning",
  "pending approval": "warning",
  "pending pm approval": "warning",
  "pending ceo approval": "warning",
  "pending review": "warning",
  "pending development": "info",
  "in progress": "info",
  "in review": "warning",
  submitted: "info",
  processing: "info",
  escalated: "warning",
  "escalated for approval": "warning",
  "awaiting information": "warning",
  partial: "warning",

  // Terminal bad
  rejected: "danger",
  declined: "danger",
  cancelled: "danger",
  canceled: "danger",
  failed: "danger",
  overdue: "danger",
  expired: "danger",
  blocked: "danger",

  // Pre-flight
  draft: "neutral",
  new: "neutral",
  inactive: "neutral",
  archived: "neutral",
  "on hold": "neutral",

  // Non-status categories — deliberately violet, which carries no status
  // meaning, so a phase label is never mistaken for an outcome.
  uat: "violet",
  staging: "violet",
  testing: "violet",
  planning: "violet",
};

/** `pending_approval` / `Pending-Approval` → `pending approval`. */
export function normalizeStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/** The tone for a status, defaulting to `neutral` for anything unmapped. */
export function statusTone(status: string): StatusTone {
  return STATUS_TONES[normalizeStatus(status)] ?? "neutral";
}

/** Title-cases an unmapped raw status so `pending_approval` is still readable. */
export function prettifyStatus(status: string): string {
  return normalizeStatus(status).replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface StatusBadgeProps extends React.ComponentProps<"span"> {
  /** The raw status. Mapped to a tone and, unless `label` is given, prettified. */
  status: string;
  /** Overrides the derived tone. Use when a module's meaning genuinely differs. */
  tone?: StatusTone;
  /** Overrides the displayed text. */
  label?: React.ReactNode;
  size?: "sm" | "default";
}

export function StatusBadge({
  status,
  tone,
  label,
  size = "default",
  className,
  ...props
}: StatusBadgeProps) {
  const resolved = tone ?? statusTone(status);

  return (
    <span
      className={cn(
        `
          inline-flex shrink-0 items-center gap-1 rounded-full border
          font-medium whitespace-nowrap
        `,
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
        TONE_CLASSES[resolved],
        className,
      )}
      {...props}
    >
      {label ?? prettifyStatus(status)}
    </span>
  );
}
