import { z } from "zod";

export const createJobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().optional(),
  type: z.string().min(1, "Job type is required"),
  location: z.string().min(1, "Location is required"),
  department: z.string().min(1, "Department is required"),
  description: z.string().min(1, "Description is required"),
  active: z.boolean().default(true),
});

export const updateJobSchema = createJobSchema.partial();

export const jobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  department: z.string().optional(),
  type: z.string().optional(),
  active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobQuery = z.infer<typeof jobQuerySchema>;
