import { z } from "zod";

export const TICKET_CATEGORIES = [
  "account-access",
  "software-access",
  "hardware",
  "network",
  "file-drive",
  "security",
  "procurement",
  "other",
] as const;

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const TICKET_STATUSES = [
  "open",
  "in-progress",
  "review",
  "resolved",
  "closed",
] as const;

const attachmentSchema = z.object({
  name: z.string().min(1).max(300),
  url: z.string().url(),
  mimeType: z.string().max(200).optional(),
  size: z.number().int().nonnegative().optional(),
});

export const createTicketSchema = z.object({
  title: z.string().min(3, "Title is required").max(200),
  description: z.string().min(5, "Describe the issue").max(5000),
  category: z.enum(TICKET_CATEGORIES).default("other"),
  priority: z.enum(TICKET_PRIORITIES).default("medium"),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const updateTicketSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(5).max(5000).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    resolutionNote: z.string().max(5000).nullable().optional(),
    attachments: z.array(attachmentSchema).max(10).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

export const ticketQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assigneeId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  /** Match `title` / `description` with a case-insensitive contains. */
  q: z.string().max(200).optional(),
  /** Toggle between own-only and all-tickets view (the IT-team Kanban). */
  scope: z.enum(["mine", "all"]).default("mine"),
});

export const createCommentSchema = z.object({
  body: z.string().min(1, "Comment can't be empty").max(5000),
});

// GitHub workflow integration (Sid + BD feedback, 2026-05-24).
// Token + webhookSecret are write-only on the FE — leaving them empty
// preserves the stored value; supplying a non-empty string replaces.
const helpdeskGithubSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  repoOwner: z.string().trim().max(120).optional(),
  repoName: z.string().trim().max(120).optional(),
  token: z.string().trim().max(200).optional(),
  webhookSecret: z.string().trim().max(200).optional(),
  labelInProgress: z.string().trim().min(1).max(60).optional(),
  labelReview: z.string().trim().min(1).max(60).optional(),
});

export const updateHelpdeskSettingsSchema = z.object({
  notifyEmails: z
    .array(z.string().trim().toLowerCase().email("Invalid email"))
    .max(50, "At most 50 recipients")
    .default([]),
  notifyOnCreate: z.boolean().default(true),
  notifyCreatorOnCreate: z.boolean().default(true),
  notifyCreatorOnStatus: z.boolean().default(true),
  github: helpdeskGithubSettingsSchema.optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type TicketQuery = z.infer<typeof ticketQuerySchema>;
export type TicketAttachment = z.infer<typeof attachmentSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateHelpdeskSettingsInput = z.infer<
  typeof updateHelpdeskSettingsSchema
>;
