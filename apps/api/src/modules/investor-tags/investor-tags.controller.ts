import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { investorTagService } from "@/modules/investor-tags/investor-tags.service";
import {
  createInvestorTagSchema,
  listInvestorTagsSchema,
  reorderInvestorTagsSchema,
  updateInvestorTagSchema,
} from "@/modules/investor-tags/investor-tags.validation";

/**
 * Admin-editable investor tags.
 *
 * Gated on EXISTING investor permissions rather than a new `investor-tags:*`
 * code: the access boundary is identical to the pipeline stages catalog
 * (anyone who can read investors can see the tags; anyone who can edit an
 * investor can manage them), and CLAUDE.md says not to mint permission codes
 * plus a seed migration unless the boundary genuinely differs.
 */
const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const query = listInvestorTagsSchema.parse(req.query);
    const data = await investorTagService.list(query);
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = createInvestorTagSchema.parse(req.body);
    const data = await investorTagService.create(input);
    res.status(201).json({ data });
  }),
);

// Literal path before `/:id` — Express matches in order (CLAUDE.md).
router.put(
  "/reorder",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reorderInvestorTagsSchema.parse(req.body);
    const data = await investorTagService.reorder(input);
    res.json({ data });
  }),
);

// Literal segment before `/:id` for the same reason. Read-gated, not
// admin-gated: the Manage dialog shows the count before asking to confirm a
// delete, and seeing "12 investors" is not a privileged action.
router.get(
  "/:code/usage",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const count = await investorTagService.usageCount(
      req.params.code as string,
    );
    res.json({ data: { count } });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateInvestorTagSchema.parse(req.body);
    const data = await investorTagService.update(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const data = await investorTagService.delete(req.params.id as string);
    res.json({ data });
  }),
);

export default router;
