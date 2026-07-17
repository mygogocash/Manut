import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { botFxService } from "@/modules/exchange-rates/bot-fx.service";
import { exchangeRateAdminService } from "@/modules/exchange-rates/exchange-rates.admin.service";
import {
  createExchangeRateSchema,
  listExchangeRatesSchema,
  updateExchangeRateSchema,
} from "@/modules/exchange-rates/exchange-rates.validation";

const router = Router();

router.use(authenticate, requireActive);

// Read is gated wider than write so the Sales CRM forecast banner can
// still surface the active pair list to non-accounting reps. Mutations
// stay behind accounting:admin.
router.get(
  "/",
  requirePermission(
    PERMISSIONS.ACCOUNTING_READ,
    PERMISSIONS.ACCOUNTING_ADMIN,
    PERMISSIONS.CRM_READ,
  ),
  asyncHandler(async (req, res) => {
    const query = listExchangeRatesSchema.parse(req.query);
    const data = await exchangeRateAdminService.list(query);
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (req, res) => {
    const input = createExchangeRateSchema.parse(req.body);
    const data = await exchangeRateAdminService.create(input);
    res.status(201).json({ data });
  }),
);

// Manual "Sync from BOT" trigger (the cron does this daily). Pulls the
// latest Bank of Thailand rates and upserts <CUR>→THB. Returns a summary
// (synced / skipped / errors); `configured: false` if no BOT client id.
router.post(
  "/sync-bot",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (_req, res) => {
    const data = await botFxService.syncBotRates();
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (req, res) => {
    const input = updateExchangeRateSchema.parse(req.body);
    const data = await exchangeRateAdminService.update(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (req, res) => {
    await exchangeRateAdminService.delete(req.params.id as string);
    res.json({ data: { success: true } });
  }),
);

export default router;
