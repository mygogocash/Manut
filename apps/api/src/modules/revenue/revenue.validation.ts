import { z } from "zod";

export const revenueQuerySchema = z.object({
  period: z.enum(["3m", "6m", "12m", "ytd", "all"]).default("12m"),
  entityId: z.string().optional(),
});

export type RevenueQuery = z.infer<typeof revenueQuerySchema>;
