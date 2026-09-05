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
  bulkFieldUpdateOpportunitiesSchema,
  bulkUpdateOpportunitiesSchema,
  bulkUpdateStageConfigsSchema,
  closeLostSchema,
  createOpportunitySchema,
  forecastQuerySchema,
  listOpportunitiesSchema,
  moveBusinessUnitSchema,
  pipelineQuerySchema,
  reopenSchema,
  reorderOpportunityCardsSchema,
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
    // Board filters narrow the header rollup exactly as they narrow the
    // cards, so the two can never describe different row sets.
    const query = pipelineQuerySchema.parse(req.query);
    const data = await opportunityService.pipeline(
      req.user!.id,
      req.user!.permissions,
      query,
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

// BD-feedback (Vivek, May 2026) — distinct country / region values for
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

// Manual within-column reorder for the pipeline kanban. Deal ids, because a
// card IS a deal. Literal path, registered before `/:id`.
router.post(
  "/reorder",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reorderOpportunityCardsSchema.parse(req.body);
    const data = await opportunityService.reorderCards(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

// Bulk select-and-act. Literal path MUST precede `/:id` — Express matches in
// order and `/:id` would otherwise swallow `/bulk-business-units`.
// Owner + archive in bulk. `crm:reassign` for the owner half is enforced in the
// service, since requirePermission cannot express "only when a field is set".
router.post(
  "/bulk-update",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = bulkFieldUpdateOpportunitiesSchema.parse(req.body);
    const data = await opportunityService.bulkUpdateFields(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.post(
  "/bulk-business-units",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = bulkUpdateOpportunitiesSchema.parse(req.body);
    const data = await opportunityService.bulkUpdateBusinessUnits(
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

// Reversible archive / unarchive. Gated like update (crm:update); the
// service re-checks owner-or-team-read so a rep can't archive another
// rep's deal. Archive is orthogonal to stage — a card keeps its stage.
router.post(
  "/:id/archive",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const data = await opportunityService.archive(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/:id/unarchive",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const data = await opportunityService.unarchive(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
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

router.get(
  "/:id/business-units",
  requirePermission(PERMISSIONS.CRM_READ),
  asyncHandler(async (req, res) => {
    const data = await opportunityService.businessUnitsForDeal(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id/business-units/:businessUnit",
  requirePermission(PERMISSIONS.CRM_UPDATE),
  asyncHandler(async (req, res) => {
    const input = moveBusinessUnitSchema.parse(req.body);
    const data = await opportunityService.moveBusinessUnit(
      req.params.id as string,
      req.params.businessUnit as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

export default router;
