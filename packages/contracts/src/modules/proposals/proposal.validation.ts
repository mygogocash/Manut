import { z } from "zod";

import {
  PROPOSAL_TYPES,
  PROPOSAL_VIEWS,
} from "./proposal.types";

// Request validation for the proposal module.
//
// Note the two different id shapes: users are uuid, but projects use cuid, so
// `projectId` is validated as a bounded string rather than `.uuid()`. Getting
// that wrong rejects every valid project link.

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

/** Minimum for any free text that exists to explain something to a person. */
const MIN_EXPLANATION = 5;

export const createProposalSchema = z.object({
  title: z.string().trim().min(1, "A title is required").max(300),
  description: z
    .string()
    .trim()
    .min(MIN_EXPLANATION, "Describe what you are proposing")
    .max(10000),
  type: z.enum(PROPOSAL_TYPES).default("idea"),
  /** Optional link to the project this concerns. cuid, not uuid. */
  projectId: z.string().trim().min(1).max(64).nullable().optional(),
  priority: z.enum(PRIORITIES).nullable().optional(),
});
export type CreateProposalInput = z.output<typeof createProposalSchema>;

/**
 * Edit. Every field optional so a caller can send only what changed, but the
 * type and status are not editable here: type is set once at creation, and
 * status only ever moves through the state machine.
 */
export const updateProposalSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().min(MIN_EXPLANATION).max(10000).optional(),
  type: z.enum(PROPOSAL_TYPES).optional(),
  projectId: z.string().trim().min(1).max(64).nullable().optional(),
  priority: z.enum(PRIORITIES).nullable().optional(),
});
export type UpdateProposalInput = z.output<typeof updateProposalSchema>;

/** Queue selector. Search is applied server-side so paging stays consistent. */
export const proposalQuerySchema = z.object({
  view: z.enum(PROPOSAL_VIEWS).default("list"),
  search: z.string().trim().max(200).optional(),
  type: z.enum(PROPOSAL_TYPES).optional(),
});
export type ProposalQueryInput = z.output<typeof proposalQuerySchema>;

/** Pass: an optional note for the record. */
export const proposalPassSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

/**
 * Decline: a reason is mandatory. It is the only thing the requester has to work
 * with, so "no" on its own is not acceptable.
 */
export const proposalDeclineSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(MIN_EXPLANATION, "Say why this is being declined")
    .max(2000),
});

/**
 * Ask for information. Several people at once is the normal case, so this takes
 * an array. Assignee ids are users, hence uuid.
 */
export const proposalAskSchema = z.object({
  assigneeIds: z
    .array(z.string().uuid())
    .min(1, "Choose at least one person to ask")
    .max(10, "Ask no more than ten people at once"),
  question: z
    .string()
    .trim()
    .min(MIN_EXPLANATION, "Say what information you need")
    .max(2000),
});

/** Answer a question that was asked of you. */
export const proposalRespondSchema = z.object({
  response: z.string().trim().min(1, "Write your answer").max(10000),
});
