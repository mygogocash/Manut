import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  appraisalQuerySchema,
  createAppraisalSchema,
  createCycleSchema,
  createGoalSchema,
  cycleQuerySchema,
  managerReviewSchema,
  selfReviewSchema,
  updateCycleSchema,
  updateGoalSchema,
} from "@nexora/contracts/modules/performance/performance.validation";
import { performanceService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const performance = new Hono<AppEnv>()
  .get(
    "/cycles",
    requirePermission(PERMISSIONS.PERFORMANCE_HR_MANAGE, PERMISSIONS.PERFORMANCE_READ),
    zValidator("query", cycleQuerySchema),
    async (c) => c.json(await performanceService.listCycles(c.var.db, c.req.valid("query"))),
  )
  .post("/cycles", requirePermission(PERMISSIONS.PERFORMANCE_HR_MANAGE), zValidator("json", createCycleSchema), async (c) => {
    const data = await performanceService.createCycle(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get(
    "/cycles/:id",
    requirePermission(PERMISSIONS.PERFORMANCE_HR_MANAGE, PERMISSIONS.PERFORMANCE_READ),
    async (c) => {
      const data = await performanceService.getCycleById(c.var.db, c.req.param("id"));
      return c.json({ data });
    },
  )
  .put("/cycles/:id", requirePermission(PERMISSIONS.PERFORMANCE_HR_MANAGE), zValidator("json", updateCycleSchema), async (c) => {
    const data = await performanceService.updateCycle(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .get(
    "/appraisals",
    requirePermission(
      PERMISSIONS.PERFORMANCE_READ,
      PERMISSIONS.PERFORMANCE_SELF_REVIEW,
      PERMISSIONS.PERFORMANCE_MANAGER_REVIEW,
      PERMISSIONS.PERFORMANCE_HR_MANAGE,
    ),
    zValidator("query", appraisalQuerySchema),
    async (c) =>
      c.json(
        await performanceService.listAppraisals(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("query"),
        ),
      ),
  )
  .post("/appraisals", requirePermission(PERMISSIONS.PERFORMANCE_HR_MANAGE), zValidator("json", createAppraisalSchema), async (c) => {
    const data = await performanceService.createAppraisal(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get(
    "/appraisals/:id",
    requirePermission(
      PERMISSIONS.PERFORMANCE_READ,
      PERMISSIONS.PERFORMANCE_SELF_REVIEW,
      PERMISSIONS.PERFORMANCE_MANAGER_REVIEW,
      PERMISSIONS.PERFORMANCE_HR_MANAGE,
    ),
    async (c) => {
      const data = await performanceService.getAppraisalById(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      );
      return c.json({ data });
    },
  )
  .put(
    "/appraisals/:id/self-review",
    requirePermission(PERMISSIONS.PERFORMANCE_SELF_REVIEW),
    zValidator("json", selfReviewSchema),
    async (c) => {
      const data = await performanceService.submitSelfReview(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .put(
    "/appraisals/:id/manager-review",
    requirePermission(PERMISSIONS.PERFORMANCE_MANAGER_REVIEW),
    zValidator("json", managerReviewSchema),
    async (c) => {
      const data = await performanceService.submitManagerReview(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .get(
    "/appraisals/:id/goals",
    requirePermission(
      PERMISSIONS.PERFORMANCE_GOALS,
      PERMISSIONS.PERFORMANCE_SELF_REVIEW,
      PERMISSIONS.PERFORMANCE_MANAGER_REVIEW,
      PERMISSIONS.PERFORMANCE_HR_MANAGE,
    ),
    async (c) => {
      const data = await performanceService.listGoals(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      );
      return c.json({ data });
    },
  )
  .post("/goals", requirePermission(PERMISSIONS.PERFORMANCE_GOALS), zValidator("json", createGoalSchema), async (c) => {
    const data = await performanceService.createGoal(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .put("/goals/:goalId", requirePermission(PERMISSIONS.PERFORMANCE_GOALS), zValidator("json", updateGoalSchema), async (c) => {
    const data = await performanceService.updateGoal(
      c.var.db,
      c.req.param("goalId"),
      c.var.user!.id,
      c.req.valid("json"),
    );
    return c.json({ data });
  })
  .delete("/goals/:goalId", requirePermission(PERMISSIONS.PERFORMANCE_GOALS), async (c) => {
    await performanceService.deleteGoal(c.var.db, c.req.param("goalId"), c.var.user!.id);
    return c.body(null, 204);
  });
