import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { marketingCampaignsService as svc } from "@/modules/marketing-campaigns/marketing-campaigns.service";
import {
  campaignQuerySchema,
  createCampaignSchema,
  createCreativeSchema,
  createLeverSchema,
  createPredictionSchema,
  setLeversSchema,
  updateCampaignSchema,
  updateLeverSchema,
} from "@/modules/marketing-campaigns/marketing-campaigns.validation";

const router = Router();
router.use(authenticate, requireActive);

const VIEW = [
  PERMISSIONS.MARKETING_CAMPAIGN_VIEW,
  PERMISSIONS.MARKETING_CAMPAIGN_CREATE,
  PERMISSIONS.MARKETING_CAMPAIGN_UPDATE,
  PERMISSIONS.MARKETING_CAMPAIGN_DELETE,
];
const CREATE = [PERMISSIONS.MARKETING_CAMPAIGN_CREATE];
const UPDATE = [PERMISSIONS.MARKETING_CAMPAIGN_UPDATE];
const DELETE = [PERMISSIONS.MARKETING_CAMPAIGN_DELETE];

// ── Levers config (literal, before "/:id") ──
router.get(
  "/levers",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    res.json(await svc.listLevers(req.query.active === "true"));
  }),
);
router.post(
  "/levers",
  requirePermission(...UPDATE),
  asyncHandler(async (req, res) => {
    const input = createLeverSchema.parse(req.body);
    res.status(201).json(await svc.createLever(input, req.user!.id, req));
  }),
);
router.patch(
  "/levers/:id",
  requirePermission(...UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateLeverSchema.parse(req.body);
    res.json(await svc.updateLever(id, input, req.user!.id, req));
  }),
);
router.delete(
  "/levers/:id",
  requirePermission(...UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await svc.deleteLever(id, req.user!.id, req));
  }),
);

// ── Creatives + predictions by id (literal segments) ──
router.delete(
  "/creatives/:id",
  requirePermission(...UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await svc.deleteCreative(id, req.user!.id, req));
  }),
);
router.delete(
  "/predictions/:id",
  requirePermission(...UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await svc.deletePrediction(id, req.user!.id, req));
  }),
);

// ── Campaigns ──
router.get(
  "/",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const query = campaignQuerySchema.parse(req.query);
    res.json(await svc.list(query));
  }),
);
router.post(
  "/",
  requirePermission(...CREATE),
  asyncHandler(async (req, res) => {
    const input = createCampaignSchema.parse(req.body);
    res.status(201).json(await svc.create(input, req.user!.id, req));
  }),
);
router.get(
  "/:id",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await svc.getById(id));
  }),
);
router.patch(
  "/:id",
  requirePermission(...UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateCampaignSchema.parse(req.body);
    res.json(await svc.update(id, input, req.user!.id, req));
  }),
);
router.delete(
  "/:id",
  requirePermission(...DELETE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await svc.remove(id, req.user!.id, req));
  }),
);
router.put(
  "/:id/levers",
  requirePermission(...UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = setLeversSchema.parse(req.body);
    res.json(await svc.setLevers(id, input, req.user!.id, req));
  }),
);
// Reversible archive/unarchive. Gated like update (write perm).
router.post(
  "/:id/archive",
  requirePermission(...UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await svc.archive(id, req.user!.id, req));
  }),
);
router.post(
  "/:id/unarchive",
  requirePermission(...UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await svc.unarchive(id, req.user!.id, req));
  }),
);
router.post(
  "/:id/creatives",
  requirePermission(...CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createCreativeSchema.parse(req.body);
    res.status(201).json(await svc.addCreative(id, input, req.user!.id, req));
  }),
);
router.post(
  "/:id/predictions",
  requirePermission(...CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createPredictionSchema.parse(req.body);
    res.status(201).json(await svc.addPrediction(id, input, req.user!.id, req));
  }),
);

export default router;
