import { z } from "zod";

export const updateCrmSettingsSchema = z.object({
  notifyEmails: z
    .array(z.string().trim().toLowerCase().email("Invalid email"))
    .max(50, "At most 50 recipients")
    .default([]),
  notifyOnCreate: z.boolean().default(true),
  notifyOwnerOnCreate: z.boolean().default(true),
  notifyOwnerOnStageChange: z.boolean().default(true),
});

export type UpdateCrmSettingsInput = z.infer<typeof updateCrmSettingsSchema>;
