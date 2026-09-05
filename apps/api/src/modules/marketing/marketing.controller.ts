import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { marketingService } from "@/modules/marketing/marketing.service";
import {
  createMarketingCampaignSchema,
  marketingCampaignQuerySchema,
  updateMarketingCampaignSchema,
} from "@/modules/marketing/marketing.validation";

// Marketing campaign CRM (OneWave). RBAC reuses the partners (Marketing
// CRM) perms so no Roles-UI / seed change is needed.
const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/dashboard",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const data = await marketingService.dashboard(req.query.fresh === "1");
    res.json({ data });
  }),
);

// OneWave holistic dashboard (P1) — normalized multi-tab sheet snapshot +
// full campaign detail. `?fresh=1` forces a re-ingest of the sheet.
router.get(
  "/holistic-dashboard",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const data = await marketingService.holisticDashboard(
      req.query.fresh === "1",
    );
    res.json({ data });
  }),
);

router.get(
  "/campaigns",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const query = marketingCampaignQuerySchema.parse(req.query);
    const result = await marketingService.list(query);
    res.json(result);
  }),
);

router.post(
  "/campaigns",
  requirePermission(PERMISSIONS.PARTNERS_CREATE),
  asyncHandler(async (req, res) => {
    const input = createMarketingCampaignSchema.parse(req.body);
    const data = await marketingService.create(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

// Literal-suffixed `/:id/...` route registers before the bare `/:id`.
router.get(
  "/campaigns/:id/prediction-download",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await marketingService.getPredictionDownloadUrl(id);
    res.json({ data });
  }),
);

router.get(
  "/campaigns/:id",
  requirePermission(PERMISSIONS.PARTNERS_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await marketingService.getById(id);
    res.json({ data });
  }),
);

router.put(
  "/campaigns/:id",
  requirePermission(PERMISSIONS.PARTNERS_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateMarketingCampaignSchema.parse(req.body);
    const data = await marketingService.update(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/campaigns/:id",
  requirePermission(PERMISSIONS.PARTNERS_DELETE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await marketingService.delete(id);
    res.json({ data: { success: true } });
  }),
);

export default router;
