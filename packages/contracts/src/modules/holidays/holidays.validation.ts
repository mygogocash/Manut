import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const createHolidaySchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  date: dateString,
  name: z.string().min(1, "Name is required").max(120),
  notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateHolidaySchema = createHolidaySchema
  .omit({ entityId: true })
  .partial();

export const holidayQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  entityId: z.string().min(1).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
export type HolidayQuery = z.infer<typeof holidayQuerySchema>;
