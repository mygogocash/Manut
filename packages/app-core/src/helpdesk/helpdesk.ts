import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

export const helpdeskTicketCategorySchema = z.enum([
  "account-access",
  "software-access",
  "hardware",
  "network",
  "file-drive",
  "security",
  "procurement",
  "other",
]);

export const helpdeskTicketPrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "urgent",
]);

export const helpdeskTicketStatusSchema = z.enum([
  "open",
  "in-progress",
  "review",
  "resolved",
  "closed",
]);

const personSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .transform((person) => ({ id: person.id, name: person.name }));

// List foundation strips description, resolution notes, attachments, emails.
const helpdeskTicketApiSchema = z
  .object({
    id: z.string().min(1),
    ticketNumber: z.number().int().nonnegative(),
    title: z.string().min(1),
    category: helpdeskTicketCategorySchema,
    priority: helpdeskTicketPrioritySchema,
    status: helpdeskTicketStatusSchema,
    createdAt: z.string().min(1),
    createdBy: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough(),
    assignee: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const helpdeskTicketSchema = helpdeskTicketApiSchema.transform(
  (ticket) => ({
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt,
    createdBy: personSchema.parse(ticket.createdBy),
    assignee: ticket.assignee ? personSchema.parse(ticket.assignee) : null,
  }),
);

const helpdeskMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative().optional(),
    totalPages: z.number().int().nonnegative().optional(),
  })
  .transform((meta) => ({
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    totalPages: meta.totalPages ?? meta.pages ?? 1,
  }));

const helpdeskTicketsResponseSchema = z
  .object({
    data: z.array(helpdeskTicketSchema),
    meta: helpdeskMetaSchema,
  })
  .strict();

export const helpdeskTicketListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: helpdeskTicketStatusSchema.optional(),
    scope: z.enum(["mine", "all"]).default("mine"),
  })
  .strict();

export type HelpdeskTicket = z.infer<typeof helpdeskTicketSchema>;
export type HelpdeskTicketListParams = z.input<
  typeof helpdeskTicketListParamsSchema
>;
export type HelpdeskTicketList = z.infer<typeof helpdeskTicketsResponseSchema>;

export const HELPDESK_TICKETS_QUERY_ROOT = ["helpdesk", "tickets"] as const;

export function helpdeskTicketsQueryKey(params: HelpdeskTicketListParams = {}) {
  return [
    ...HELPDESK_TICKETS_QUERY_ROOT,
    helpdeskTicketListParamsSchema.parse(params),
  ] as const;
}

function encodeHelpdeskQuery(
  params: z.output<typeof helpdeskTicketListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
    ["scope", params.scope],
  ];
  return entries
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

export async function listHelpdeskTickets(
  client: ApiClient,
  params: HelpdeskTicketListParams = {},
  signal?: RequestAbortSignal,
): Promise<HelpdeskTicketList> {
  const query = encodeHelpdeskQuery(
    helpdeskTicketListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/helpdesk?${query}`,
    signal ? { signal } : undefined,
  );
  return helpdeskTicketsResponseSchema.parse(response);
}

export function helpdeskTicketStatusLabel(
  status: z.infer<typeof helpdeskTicketStatusSchema>,
): string {
  switch (status) {
    case "open":
      return "Open";
    case "in-progress":
      return "In progress";
    case "review":
      return "Review";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
