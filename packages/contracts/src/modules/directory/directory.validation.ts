import { z } from "zod";

export const listDirectorySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // Bumped 100 → 500 (Kunanon, 2026-05-25). Owner / Members pickers
  // call `/directory/assignable?limit=500` to load the full roster
  // for client-side search. The previous cap rejected those calls
  // with 422 "Validation failed", which surfaced as "No users
  // found" in every project-form picker.
  limit: z.coerce.number().int().positive().max(500).default(20),
  search: z.string().optional(),
  entityId: z.string().optional(),
  department: z.string().optional(),
});

export type ListDirectoryQuery = z.infer<typeof listDirectorySchema>;
