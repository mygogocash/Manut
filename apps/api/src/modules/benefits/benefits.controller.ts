import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { benefitsService } from "@/modules/benefits/benefits.service";
import {
  benefitImportSchema,
  createBenefitSchema,
  enrollSchema,
  listBenefitsSchema,
  updateBenefitSchema,
} from "@/modules/benefits/benefits.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/my-enrollments",
  requirePermission(
    PERMISSIONS.BENEFITS_READ,
    PERMISSIONS.BENEFITS_ENROLL,
    PERMISSIONS.BENEFITS_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const data = await benefitsService.getMyEnrollments(req.user!.id);
    res.json({ data });
  }),
);

router.get(
  "/",
  requirePermission(PERMISSIONS.BENEFITS_READ),
  asyncHandler(async (req, res) => {
    const query = listBenefitsSchema.parse(req.query);
    const result = await benefitsService.list(query);
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.BENEFITS_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createBenefitSchema.parse(req.body);
    const data = await benefitsService.create(input);
    res.status(201).json({ data });
  }),
);

// Bulk import — preview + commit. Literal paths must come before
// `/:id` or Express's order-sensitive matcher swallows them.
router.post(
  "/import/preview",
  requirePermission(PERMISSIONS.BENEFITS_MANAGE),
  asyncHandler(async (req, res) => {
    const { rows } = benefitImportSchema.parse(req.body);
    const result = await benefitsService.previewBenefitImport(rows);
    res.json({ data: result });
  }),
);

router.post(
  "/import/commit",
  requirePermission(PERMISSIONS.BENEFITS_MANAGE),
  asyncHandler(async (req, res) => {
    const { rows } = benefitImportSchema.parse(req.body);
    const result = await benefitsService.commitBenefitImport(rows);
    res.json({ data: result });
  }),
);

router.get(
  "/:id",
  requirePermission(
    PERMISSIONS.BENEFITS_READ,
    PERMISSIONS.BENEFITS_ENROLL,
    PERMISSIONS.BENEFITS_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const data = await benefitsService.getById(req.params.id as string);
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.BENEFITS_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateBenefitSchema.parse(req.body);
    const data = await benefitsService.update(req.params.id as string, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.BENEFITS_MANAGE),
  asyncHandler(async (req, res) => {
    await benefitsService.delete(req.params.id as string);
    res.status(204).end();
  }),
);

router.post(
  "/enroll",
  requirePermission(PERMISSIONS.BENEFITS_ENROLL),
  asyncHandler(async (req, res) => {
    const input = enrollSchema.parse(req.body);
    const data = await benefitsService.enroll(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

router.put(
  "/enrollments/:id/unenroll",
  requirePermission(PERMISSIONS.BENEFITS_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await benefitsService.unenroll(req.params.id as string);
    res.json({ data });
  }),
);

export default router;
