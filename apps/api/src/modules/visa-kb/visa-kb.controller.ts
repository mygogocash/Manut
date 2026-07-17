import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { visaKbService } from "@/modules/visa-kb/visa-kb.service";
import {
  createVisaArticleSchema,
  updateVisaArticleSchema,
  visaArticleForRecordSchema,
  visaArticleQuerySchema,
} from "@/modules/visa-kb/visa-kb.validation";

const router = Router();

// HR-desk only — the visa knowledge base is internal immigration guidance.
router.use(
  authenticate,
  requireActive,
  requirePermission(PERMISSIONS.VISA_MANAGE),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = visaArticleQuerySchema.parse(req.query);
    const result = await visaKbService.list(query);
    res.json(result);
  }),
);

// Contextual fetch for a record's form / detail dialog. Literal path before
// "/:id" (CLAUDE.md route-order rule).
router.get(
  "/for-record",
  asyncHandler(async (req, res) => {
    const query = visaArticleForRecordSchema.parse(req.query);
    const data = await visaKbService.getForRecord(
      query.country,
      query.visaType,
    );
    res.json({ data });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createVisaArticleSchema.parse(req.body);
    const data = await visaKbService.create(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await visaKbService.getById(req.params.id as string);
    res.json({ data });
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateVisaArticleSchema.parse(req.body);
    const data = await visaKbService.update(req.params.id as string, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await visaKbService.deactivate(req.params.id as string);
    res.json({ data });
  }),
);

export default router;
