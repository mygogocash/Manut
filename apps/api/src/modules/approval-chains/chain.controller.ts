import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
  requireSystemAdmin,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { chainService } from "@/modules/approval-chains/chain.service";
import type { ChainScope } from "@/modules/approval-chains/chain.types";
import {
  chainReorderSchema,
  chainScopeParamSchema,
  chainStepCreateSchema,
  chainStepUpdateSchema,
  chainUpdateSchema,
} from "@/modules/approval-chains/chain.validation";

// Approval chain configuration API, for the Project CRM.
//
// ── Reads vs writes ──
//
// Reading a chain needs `projects:read`: the Project CRM shows "who approves
// next" to anyone who can see a request, and hiding that would make the queue
// unreadable.
//
// EVERY write is restricted to the system Admin role. This is one setting that
// decides who may approve everything in a flow, so it is not delegated through a
// permission code — a code cannot express "super admin only", because super
// admins are granted every code and any code can also be granted to a custom
// role. See `isSystemAdmin` in auth.guard.ts.

const router = Router();

router.use(authenticate, requireActive);

/** Both chains at once, for the admin editor. */
router.get(
  "/",
  requirePermission(PERMISSIONS.PROJECTS_READ),
  asyncHandler(async (_req, res) => {
    const data = await chainService.listChains();
    res.json({ data });
  }),
);

/** One chain. 404 rather than an empty shape, so a missing chain is visible. */
router.get(
  "/:scope",
  requirePermission(PERMISSIONS.PROJECTS_READ),
  asyncHandler(async (req, res) => {
    const { scope } = chainScopeParamSchema.parse(req.params);
    const data = await chainService.getChain(scope as ChainScope);
    if (!data) {
      res.status(404).json({ message: "No chain configured for that scope" });
      return;
    }
    res.json({ data });
  }),
);

// ── Writes: system administrators only ──────────────────────────────────

router.put(
  "/:scope",
  requireSystemAdmin(),
  asyncHandler(async (req, res) => {
    const { scope } = chainScopeParamSchema.parse(req.params);
    const input = chainUpdateSchema.parse(req.body);
    await chainService.updateChain(scope as ChainScope, input);
    const data = await chainService.getChain(scope as ChainScope);
    res.json({ data });
  }),
);

/** Add a stage. Lands at the end of the chain. */
router.post(
  "/:scope/steps",
  requireSystemAdmin(),
  asyncHandler(async (req, res) => {
    const { scope } = chainScopeParamSchema.parse(req.params);
    const input = chainStepCreateSchema.parse(req.body);
    await chainService.addStep(scope as ChainScope, {
      name: input.name,
      description: input.description ?? null,
      approverUserId: input.approverUserId ?? null,
    });
    const data = await chainService.getChain(scope as ChainScope);
    res.status(201).json({ data });
  }),
);

/**
 * Reorder the whole chain. Declared BEFORE `/steps/:stepId` because Express
 * matches in order and `reorder` would otherwise be read as a step id.
 */
router.put(
  "/:scope/steps/reorder",
  requireSystemAdmin(),
  asyncHandler(async (req, res) => {
    const { scope } = chainScopeParamSchema.parse(req.params);
    const input = chainReorderSchema.parse(req.body);
    await chainService.reorderSteps(scope as ChainScope, input.orderedIds);
    const data = await chainService.getChain(scope as ChainScope);
    res.json({ data });
  }),
);

router.put(
  "/:scope/steps/:stepId",
  requireSystemAdmin(),
  asyncHandler(async (req, res) => {
    const { scope } = chainScopeParamSchema.parse(req.params);
    const input = chainStepUpdateSchema.parse(req.body);
    await chainService.updateStep(req.params.stepId as string, input);
    const data = await chainService.getChain(scope as ChainScope);
    res.json({ data });
  }),
);

router.delete(
  "/:scope/steps/:stepId",
  requireSystemAdmin(),
  asyncHandler(async (req, res) => {
    const { scope } = chainScopeParamSchema.parse(req.params);
    await chainService.removeStep(req.params.stepId as string);
    const data = await chainService.getChain(scope as ChainScope);
    res.json({ data });
  }),
);

export default router;
