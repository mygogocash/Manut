import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { opportunityService } from "@/modules/opportunities/opportunities.service";
import {
  bulkUpdateStageConfigsSchema,
  closeLostSchema,
  createOpportunitySchema,
  forecastQuerySchema,
  listOpportunitiesSchema,
  reopenSchema,
  reorderWithinStageSchema,
  updateOpportunitySchema,
} from "@/modules/opportunities/opportunities.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const query = listOpportunitiesSchema.parse(req.query);
    const result = await opportunityService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.get(
  "/pipeline",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const data = await opportunityService.pipeline(
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.get(
  "/forecast",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const query = forecastQuerySchema.parse(req.query);
    const data = await opportunityService.forecast(
      req.user!.id,
      req.user!.permissions,
      query.currency,
    );
    res.json({ data });
  }),
);

// Distinct country / region values for
// the pipeline filter selects. Literal path registered before `/:id` so
// the param route does not eat the request (CLAUDE.md route-order rule).
router.get(
  "/filter-options",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const data = await opportunityService.filterOptions(
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

// Sales CRM dashboard — flat joined rows for the analytics tab. Literal
// path registered before `/:id` (CLAUDE.md route-order rule).
router.get(
  "/dashboard",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const data = await opportunityService.dashboard(
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.CRM_CREATE),
  asyncHandler(async (req, res) => {
    const input = createOpportunitySchema.parse(req.body);
    const data = await opportunityService.create(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

// ─── Stage config (admin) ─────────────────────────────────
//
// Read is open to anyone with `crm:read` so the kanban / opp form can
// load labels + auto-fill probabilities. Bulk edit is `crm:admin`,
// matching "Manage FX rates" and "Manage lost reasons" on the same
// page so the BD admin / non-admin split stays consistent. Literal
// paths registered before `/:id` (CLAUDE.md route-order rule) so the
// param route doesn't swallow them.

router.get(
  "/stage-config",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (_req, res) => {
    const data = await opportunityService.listStageConfigs();
    res.json({ data });
  }),
);

router.put(
  "/stage-config",
  requirePermission(PERMISSIONS.CRM_ADMIN),
  asyncHandler(async (req, res) => {
    const input = bulkUpdateStageConfigsSchema.parse(req.body);
    const data = await opportunityService.bulkUpdateStageConfigs(input);
    res.json({ data });
  }),
);

// Manual within-column reorder for the pipeline kanban. Literal path,
// registered before `/:id`. Gated on crm:update — same as a stage move.
router.post(
  "/reorder-within-stage",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reorderWithinStageSchema.parse(req.body);
    const data = await opportunityService.reorderWithinStage(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const data = await opportunityService.getById(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateOpportunitySchema.parse(req.body);
    const data = await opportunityService.update(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/close-lost",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = closeLostSchema.parse(req.body);
    const data = await opportunityService.closeLost(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/reopen",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reopenSchema.parse(req.body);
    const data = await opportunityService.reopen(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.CRM_DELETE),
  asyncHandler(async (req, res) => {
    await opportunityService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
