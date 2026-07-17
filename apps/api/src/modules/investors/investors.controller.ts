import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import { authenticate, requirePermission } from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { investorsService } from "@/modules/investors/investors.service";
import {
  bulkDeleteInvestorsSchema,
  bulkUpdateInvestorsSchema,
  createInvestorSchema,
  importInvestorsSchema,
  reorderInvestorsSchema,
  updateInvestorSchema,
} from "@/modules/investors/investors.validation";

const router = Router();

router.get(
  "/dashboard",
  authenticate,
  requirePermission(PERMISSIONS.INVESTOR_DASHBOARD_READ),
  asyncHandler(async (_req, res) => {
    const result = await investorsService.dashboard();
    res.json({ data: result });
  }),
);

// Per-stage est/act roll-up for the pipeline column headers. Literal
// path declared before "/:id" so Express matches it first.
router.get(
  "/pipeline-totals",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const result = await investorsService.pipelineTotals(
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: result });
  }),
);

router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    // Cap raised from 100 → 1000 so the Investor Dashboard Export
    // (#705) can pull a full snapshot in one call. Same ceiling
    // legal-crm uses.
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 20));
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const type =
      typeof req.query.type === "string" ? req.query.type : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const sortBy =
      typeof req.query.sortBy === "string" ? req.query.sortBy : undefined;
    const sortOrder =
      req.query.sortOrder === "desc" || req.query.sortOrder === "asc"
        ? req.query.sortOrder
        : undefined;
    const result = await investorsService.list(
      req.user!.id,
      req.user!.permissions,
      page,
      limit,
      search,
      type,
      status,
      sortBy,
      sortOrder,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_CREATE),
  asyncHandler(async (req, res) => {
    const input = createInvestorSchema.parse(req.body);
    const investor = await investorsService.create(req.user!.id, input);
    res.status(201).json({ data: investor });
  }),
);

// Literal /import must register before the /:id routes — Express
// matches in order and would otherwise parse "import" as an id
// (CLAUDE.md route-order pitfall).
router.post(
  "/import",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_CREATE),
  asyncHandler(async (req, res) => {
    const input = importInvestorsSchema.parse(req.body);
    const result = await investorsService.bulkCreate(req.user!.id, input);
    res.json({ data: result });
  }),
);

// Drag-to-reorder. Literal route must register before `/:id` per the
// CLAUDE.md route-order pitfall. Update permission gates writes so
// non-`investors:update` readers can't shuffle the queue.
router.post(
  "/reorder",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reorderInvestorsSchema.parse(req.body);
    const data = await investorsService.reorder(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

// Bulk select-and-act (selection bar). Literal routes before `/:id`.
router.post(
  "/bulk-update",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = bulkUpdateInvestorsSchema.parse(req.body);
    const data = await investorsService.bulkUpdate(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.post(
  "/bulk-delete",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_DELETE),
  asyncHandler(async (req, res) => {
    const input = bulkDeleteInvestorsSchema.parse(req.body);
    const data = await investorsService.bulkDelete(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const investor = await investorsService.getById(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: investor });
  }),
);

router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateInvestorSchema.parse(req.body);
    const investor = await investorsService.update(
      id,
      input,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: investor });
  }),
);

router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.INVESTORS_DELETE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await investorsService.delete(id, req.user!.id, req.user!.permissions);
    res.json({ data: { success: true } });
  }),
);

export default router;
