import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { performanceService } from "@/modules/performance/performance.service";
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
} from "@/modules/performance/performance.validation";

const router = Router();

router.use(authenticate, requireActive);

// ── Cycles ────────────────────────────────────────────────

router.get(
  "/cycles",
  requirePermission(
    PERMISSIONS.PERFORMANCE_HR_MANAGE,
    PERMISSIONS.PERFORMANCE_READ,
  ),
  asyncHandler(async (req, res) => {
    const query = cycleQuerySchema.parse(req.query);
    const result = await performanceService.listCycles(query);
    res.json(result);
  }),
);

router.post(
  "/cycles",
  requirePermission(PERMISSIONS.PERFORMANCE_HR_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createCycleSchema.parse(req.body);
    const data = await performanceService.createCycle(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/cycles/:id",
  requirePermission(
    PERMISSIONS.PERFORMANCE_HR_MANAGE,
    PERMISSIONS.PERFORMANCE_READ,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await performanceService.getCycleById(id);
    res.json({ data });
  }),
);

router.put(
  "/cycles/:id",
  requirePermission(PERMISSIONS.PERFORMANCE_HR_MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateCycleSchema.parse(req.body);
    const data = await performanceService.updateCycle(id, input);
    res.json({ data });
  }),
);

// ── Appraisals ────────────────────────────────────────────

router.get(
  "/appraisals",
  requirePermission(
    PERMISSIONS.PERFORMANCE_READ,
    PERMISSIONS.PERFORMANCE_SELF_REVIEW,
    PERMISSIONS.PERFORMANCE_MANAGER_REVIEW,
    PERMISSIONS.PERFORMANCE_HR_MANAGE,
    PERMISSIONS.PERFORMANCE_GOALS,
  ),
  asyncHandler(async (req, res) => {
    const query = appraisalQuerySchema.parse(req.query);
    const result = await performanceService.listAppraisals(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/appraisals",
  requirePermission(PERMISSIONS.PERFORMANCE_HR_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createAppraisalSchema.parse(req.body);
    const data = await performanceService.createAppraisal(input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/appraisals/:id",
  requirePermission(
    PERMISSIONS.PERFORMANCE_READ,
    PERMISSIONS.PERFORMANCE_SELF_REVIEW,
    PERMISSIONS.PERFORMANCE_MANAGER_REVIEW,
    PERMISSIONS.PERFORMANCE_HR_MANAGE,
    PERMISSIONS.PERFORMANCE_GOALS,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await performanceService.getAppraisalById(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/appraisals/:id/self-review",
  requirePermission(PERMISSIONS.PERFORMANCE_SELF_REVIEW),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = selfReviewSchema.parse(req.body);
    const data = await performanceService.submitSelfReview(
      id,
      req.user!.id,
      input,
    );
    res.json({ data });
  }),
);

router.put(
  "/appraisals/:id/manager-review",
  requirePermission(PERMISSIONS.PERFORMANCE_MANAGER_REVIEW),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = managerReviewSchema.parse(req.body);
    const data = await performanceService.submitManagerReview(
      id,
      req.user!.id,
      input,
    );
    res.json({ data });
  }),
);

// ── Goals ─────────────────────────────────────────────────

router.get(
  "/appraisals/:id/goals",
  requirePermission(
    PERMISSIONS.PERFORMANCE_GOALS,
    PERMISSIONS.PERFORMANCE_SELF_REVIEW,
    PERMISSIONS.PERFORMANCE_MANAGER_REVIEW,
    PERMISSIONS.PERFORMANCE_HR_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await performanceService.listGoals(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/goals",
  requirePermission(PERMISSIONS.PERFORMANCE_GOALS),
  asyncHandler(async (req, res) => {
    const input = createGoalSchema.parse(req.body);
    const data = await performanceService.createGoal(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

router.put(
  "/goals/:goalId",
  requirePermission(PERMISSIONS.PERFORMANCE_GOALS),
  asyncHandler(async (req, res) => {
    const goalId = getRequiredParam(req.params, "goalId");
    const input = updateGoalSchema.parse(req.body);
    const data = await performanceService.updateGoal(
      goalId,
      req.user!.id,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/goals/:goalId",
  requirePermission(PERMISSIONS.PERFORMANCE_GOALS),
  asyncHandler(async (req, res) => {
    const goalId = getRequiredParam(req.params, "goalId");
    await performanceService.deleteGoal(goalId, req.user!.id);
    res.status(204).send();
  }),
);

export default router;
