import { z } from "zod";

export const applicationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  jobId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type ApplicationQuery = z.infer<typeof applicationQuerySchema>;
