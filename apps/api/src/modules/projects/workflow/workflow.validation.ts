import { z } from "zod";

import { WORKFLOW_VIEWS } from "@/modules/projects/workflow/workflow.types";

// Project approval workflow — request validation.

/** Queue view selector; defaults to the full list. */
export const workflowQuerySchema = z.object({
  view: z.enum(WORKFLOW_VIEWS).default("list"),
});

/** Approve / submit / complete: an optional note for the transition log. */
export const workflowActionSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

/** Reject: a reason is mandatory and becomes part of the immutable history. */
export const workflowRejectSchema = z.object({
  reason: z.string().trim().min(5, "A rejection reason is required").max(2000),
});

export type WorkflowActionInput = z.output<typeof workflowActionSchema>;
export type WorkflowRejectInput = z.output<typeof workflowRejectSchema>;

/** Escalate: names the person who must sign off, plus optional context. */
export const workflowEscalateSchema = z.object({
  escalateToId: z.string().uuid("Choose who to escalate this request to"),
  comment: z.string().trim().max(2000).optional(),
});
export type WorkflowEscalateInput = z.output<typeof workflowEscalateSchema>;

/** Archive / unarchive toggle (Project Manager). */
export const workflowArchiveSchema = z.object({
  archived: z.boolean(),
  comment: z.string().trim().max(2000).optional(),
});
export type WorkflowArchiveInput = z.output<typeof workflowArchiveSchema>;
