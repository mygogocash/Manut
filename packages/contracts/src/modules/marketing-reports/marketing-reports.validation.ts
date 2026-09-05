import { z } from "zod";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
  .optional();

const filter = {
  from: dateStr,
  to: dateStr,
  status: z.string().trim().optional(),
  channel: z.string().trim().optional(),
  country: z.string().trim().optional(),
  ownerId: z.string().uuid().optional(),
};

export const reportFilterSchema = z.object(filter);

export const reportListQuerySchema = z.object({
  ...filter,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  sortBy: z
    .enum([
      "name",
      "campaignDate",
      "status",
      "expectedReach",
      "actualReach",
      "budget",
    ])
    .default("campaignDate"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const summaryQuerySchema = z.object({
  ...filter,
  granularity: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
});

export type ReportListQuery = z.output<typeof reportListQuerySchema>;
export type SummaryQuery = z.output<typeof summaryQuerySchema>;
export type ReportFilterQuery = z.output<typeof reportFilterSchema>;
