import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const createCycleSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(2000).optional(),
    startDate: dateString,
    endDate: dateString,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const updateCycleSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    status: z.enum(["draft", "active", "closed"]).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "End date must not be before start date",
      path: ["endDate"],
    },
  );

export const cycleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["draft", "active", "closed"]).optional(),
});

export const createAppraisalSchema = z.object({
  cycleId: z.string().uuid(),
  employeeId: z.string().uuid(),
  managerId: z.string().uuid().optional(),
});

export const appraisalQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cycleId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  status: z
    .enum(["pending", "self_review", "manager_review", "completed"])
    .optional(),
});

export const selfReviewSchema = z.object({
  selfRating: z.number().int().min(1).max(5),
  selfComment: z.string().max(5000).optional(),
});

export const managerReviewSchema = z.object({
  managerRating: z.number().int().min(1).max(5),
  managerComment: z.string().max(5000).optional(),
  finalRating: z.number().int().min(1).max(5).optional(),
});

export const createGoalSchema = z.object({
  appraisalId: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(2000).optional(),
  weight: z.number().int().min(0).max(100).optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  weight: z.number().int().min(0).max(100).optional(),
  selfScore: z.number().int().min(1).max(5).optional(),
  managerScore: z.number().int().min(1).max(5).optional(),
  status: z.enum(["not_started", "in_progress", "completed"]).optional(),
});

export type CreateCycleInput = z.infer<typeof createCycleSchema>;
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;
export type CycleQuery = z.infer<typeof cycleQuerySchema>;
export type CreateAppraisalInput = z.infer<typeof createAppraisalSchema>;
export type AppraisalQuery = z.infer<typeof appraisalQuerySchema>;
export type SelfReviewInput = z.infer<typeof selfReviewSchema>;
export type ManagerReviewInput = z.infer<typeof managerReviewSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
