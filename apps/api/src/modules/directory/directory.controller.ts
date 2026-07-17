import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { directoryService } from "@/modules/directory/directory.service";
import { listDirectorySchema } from "@/modules/directory/directory.validation";

const router = Router();

router.use(authenticate, requireActive);

function hasSensitiveAccess(req: Express.Request): boolean {
  const permissions =
    (req.user as { permissions?: string[] })?.permissions ?? [];
  return permissions.includes(PERMISSIONS.DIRECTORY_VIEW_SENSITIVE);
}

router.get(
  "/",
  requirePermission(
    PERMISSIONS.DIRECTORY_READ,
    PERMISSIONS.DIRECTORY_VIEW_SENSITIVE,
  ),
  asyncHandler(async (req, res) => {
    const query = listDirectorySchema.parse(req.query);
    const data = await directoryService.list(query, hasSensitiveAccess(req));
    res.json(data);
  }),
);

// Minimal "assignable user" picker — any signed-in active user can
// hit this to fill an Owner / Approver / Reporter combobox. Returns
// only the fields the picker needs (id, name, email, jobTitle,
// avatarUrl) and never any HR-sensitive data, so it's safe to expose
// without `directory:read`. Solves the "I can't pick another person
// as owner" case where a team-specific role
// lacked `directory:read`.
router.get(
  "/assignable",
  asyncHandler(async (req, res) => {
    const query = listDirectorySchema.parse(req.query);
    const data = await directoryService.listAssignable(query);
    res.json(data);
  }),
);

// Single-user lookup with the same lean projection. Same auth posture
// as /assignable — needed by the picker to hydrate a pre-selected
// owner when editing a record without `directory:read`.
router.get(
  "/assignable/:id",
  asyncHandler(async (req, res) => {
    const data = await directoryService.getAssignableById(
      req.params.id as string,
    );
    res.json({ data });
  }),
);

router.get(
  "/departments",
  requirePermission(
    PERMISSIONS.DIRECTORY_READ,
    PERMISSIONS.DIRECTORY_VIEW_SENSITIVE,
  ),
  asyncHandler(async (req, res) => {
    const data = await directoryService.getDepartments();
    res.json({ data });
  }),
);

router.get(
  "/org-chart",
  requirePermission(
    PERMISSIONS.DIRECTORY_READ,
    PERMISSIONS.DIRECTORY_VIEW_SENSITIVE,
  ),
  asyncHandler(async (req, res) => {
    const data = await directoryService.getOrgChart();
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(
    PERMISSIONS.DIRECTORY_READ,
    PERMISSIONS.DIRECTORY_VIEW_SENSITIVE,
  ),
  asyncHandler(async (req, res) => {
    const data = await directoryService.getById(
      req.params.id as string,
      hasSensitiveAccess(req),
    );
    res.json({ data });
  }),
);

export default router;
