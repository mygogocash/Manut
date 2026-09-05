import { z } from "zod";

// Three mutually-compatible chat modes:
// 1. Plain send — `message` only.
// 2. Edit — `editMessageId` points at a USER message; server truncates
//    that message + everything after, then appends the new `message`.
// 3. Retry — `retryAssistantMessageId` points at an ASSISTANT message;
//    server truncates that message + everything after, then re-streams
//    using the existing prior history. `message` is ignored.
export const chatSchema = z
  .object({
    message: z.string().min(1, "Message is required").max(10000).optional(),
    conversationId: z.string().uuid().optional(),
    editMessageId: z.string().uuid().optional(),
    retryAssistantMessageId: z.string().uuid().optional(),
    // Ids of files previously uploaded via POST /aria/attachments, bound to
    // this user message on send (upload-first flow).
    attachmentIds: z.array(z.string().uuid()).max(10).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.editMessageId && val.retryAssistantMessageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cannot edit and retry in the same request.",
      });
    }
    // A plain/edit send needs either a message body or at least one
    // attachment; retry reuses the prior turn so needs neither.
    if (
      !val.retryAssistantMessageId &&
      !val.message &&
      !(val.attachmentIds && val.attachmentIds.length > 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "message or an attachment is required unless retrying.",
        path: ["message"],
      });
    }
    // Edit + retry must target a known conversation.
    if (
      (val.editMessageId || val.retryAssistantMessageId) &&
      !val.conversationId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "conversationId is required for edit/retry.",
        path: ["conversationId"],
      });
    }
  });

export type ChatInput = z.infer<typeof chatSchema>;

export const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const conversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ── Knowledge corpus ────────────────────────────────────────────────

const KNOWLEDGE_CATEGORIES = [
  "immigration",
  "hr",
  "finance",
  "policy",
  "other",
] as const;

const slug = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits and hyphens");

const stringArray = z
  .array(z.string().trim().min(1).max(80))
  .max(50)
  .default([]);

// Permission codes are admin-supplied free strings (e.g.
// `payroll:read`). We don't constrain to the live catalog so HR can
// reference future codes without a coordinated deploy; chat-time gate
// just checks set membership, unknown codes are inert.
const permissionCodeArray = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9:_-]+$/i, "Permission codes use letters/digits/:_-"),
  )
  .max(20)
  .default([]);

export const createKnowledgeSchema = z.object({
  category: z.enum(KNOWLEDGE_CATEGORIES),
  title: z.string().trim().min(1).max(200),
  slug,
  body: z.string().min(1).max(20000),
  keywords: stringArray,
  tags: stringArray,
  requiredPermissions: permissionCodeArray,
  isActive: z.boolean().default(true),
});

export const updateKnowledgeSchema = createKnowledgeSchema.partial();

export const knowledgeQuerySchema = z.object({
  category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().max(200).optional(),
});

export type CreateKnowledgeInput = z.infer<typeof createKnowledgeSchema>;
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeSchema>;
export type KnowledgeQuery = z.infer<typeof knowledgeQuerySchema>;

// ── Insights ────────────────────────────────────────────────────────

export const insightsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export type InsightsQuery = z.infer<typeof insightsQuerySchema>;

// ── Feedback / improvement queue (Phase 6) ──────────────────────────

export const feedbackSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(["up", "down"]),
  reason: z.string().trim().max(1000).optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

export const reviewFeedbackSchema = z.object({
  reviewNote: z.string().trim().max(500).optional(),
  resultingArticleId: z.string().uuid().optional(),
});

export type ReviewFeedbackInput = z.infer<typeof reviewFeedbackSchema>;

// ── Daily brief subscription (Phase 8) ──────────────────────────────

/** Channels supported by `deliverBrief`. Keep the source of truth in
 * sync with `BriefChannel` in aria-brief.service.ts. */
const BRIEF_CHANNEL_VALUES = ["in_app", "email"] as const;

/** Section ids understood by `buildBrief`. */
const BRIEF_SECTION_VALUES = [
  "calendar",
  "approvals",
  "leave-balance",
  "expiring-visas",
  "pipeline",
  "helpdesk-mine",
] as const;

export const briefSubscriptionUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  hourLocal: z.number().int().min(0).max(23).optional(),
  // We accept any IANA-style id and let `Intl.DateTimeFormat` reject
  // unknown ones at render time. Defensive whitelisting here would
  // duplicate the Node.js timezone catalog without preventing typos.
  timezone: z.string().min(1).max(64).optional(),
  channels: z.array(z.enum(BRIEF_CHANNEL_VALUES)).min(1).optional(),
  sections: z.array(z.enum(BRIEF_SECTION_VALUES)).optional(),
  weekdaysOnly: z.boolean().optional(),
});

export type BriefSubscriptionUpdateInput = z.infer<
  typeof briefSubscriptionUpdateSchema
>;

export const briefInboxQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(14),
});

export type BriefInboxQuery = z.infer<typeof briefInboxQuerySchema>;
