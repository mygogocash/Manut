import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { accountService } from "@/modules/revenue-accounts/accounts.service";
import {
  createAccountSchema,
  importAccountsSchema,
  listAccountsSchema,
  reorderAccountsSchema,
  updateAccountSchema,
} from "@/modules/revenue-accounts/accounts.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
  asyncHandler(async (req, res) => {
    const query = listAccountsSchema.parse(req.query);
    const result = await accountService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.SALES_REVENUE_CREATE),
  asyncHandler(async (req, res) => {
    const input = createAccountSchema.parse(req.body);
    const data = await accountService.create(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

// Literal /reorder + /import must register before the /:id routes —
// Express matches in order and would otherwise parse them as ids
// (CLAUDE.md route-order pitfall).
router.post(
  "/reorder",
  requirePermission(PERMISSIONS.SALES_REVENUE_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reorderAccountsSchema.parse(req.body);
    const data = await accountService.reorder(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.post(
  "/import",
  requirePermission(PERMISSIONS.SALES_REVENUE_CREATE),
  asyncHandler(async (req, res) => {
    const input = importAccountsSchema.parse(req.body);
    const data = await accountService.bulkCreate(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
  asyncHandler(async (req, res) => {
    const data = await accountService.getById(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.SALES_REVENUE_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateAccountSchema.parse(req.body);
    const data = await accountService.update(
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
  requirePermission(PERMISSIONS.SALES_REVENUE_DELETE),
  asyncHandler(async (req, res) => {
    await accountService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
