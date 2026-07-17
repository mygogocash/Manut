import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { learningService } from "@/modules/learning/learning.service";
import {
  completionQuerySchema,
  createCompletionSchema,
  createModuleSchema,
  importModulesSchema,
  moduleQuerySchema,
  updateModuleSchema,
} from "@/modules/learning/learning.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/modules",
  requirePermission(
    PERMISSIONS.LEARNING_READ,
    PERMISSIONS.LEARNING_COMPLETE,
    PERMISSIONS.LEARNING_MANAGE,
    PERMISSIONS.LEARNING_HR_READ,
  ),
  asyncHandler(async (req, res) => {
    const query = moduleQuerySchema.parse(req.query);
    const result = await learningService.listModules(query);
    res.json(result);
  }),
);

router.post(
  "/modules",
  requirePermission(PERMISSIONS.LEARNING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createModuleSchema.parse(req.body);
    const data = await learningService.createModule(input);
    res.status(201).json({ data });
  }),
);

// Literal /modules/import must register before /modules/:id —
// Express matches in order, and "import" would otherwise resolve as
// a module id (CLAUDE.md route-order pitfall).
router.post(
  "/modules/import",
  requirePermission(PERMISSIONS.LEARNING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = importModulesSchema.parse(req.body);
    const data = await learningService.bulkCreate(input);
    res.json({ data });
  }),
);

router.put(
  "/modules/:id",
  requirePermission(PERMISSIONS.LEARNING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateModuleSchema.parse(req.body);
    const data = await learningService.updateModule(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.get(
  "/completions",
  requirePermission(
    PERMISSIONS.LEARNING_READ,
    PERMISSIONS.LEARNING_HR_READ,
    PERMISSIONS.LEARNING_COMPLETE,
    PERMISSIONS.LEARNING_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = completionQuerySchema.parse(req.query);
    const result = await learningService.listCompletions(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/completions",
  requirePermission(PERMISSIONS.LEARNING_COMPLETE),
  asyncHandler(async (req, res) => {
    const input = createCompletionSchema.parse(req.body);
    const data = await learningService.markCompleted(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

export default router;
