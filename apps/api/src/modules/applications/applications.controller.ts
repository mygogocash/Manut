import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { applicationsService } from "@/modules/applications/applications.service";
import { applicationQuerySchema } from "@/modules/applications/applications.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.APPLICATION_READ),
  asyncHandler(async (req, res) => {
    const query = applicationQuerySchema.parse(req.query);
    const result = await applicationsService.listApplications(query);
    res.json(result);
  }),
);

router.get(
  "/export",
  requirePermission(PERMISSIONS.APPLICATION_READ),
  asyncHandler(async (req, res) => {
    const jobId = (req.query.jobId as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const csv = await applicationsService.exportCsv({ jobId, search });
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="applications-${day}.csv"`,
    );
    res.send(csv);
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.APPLICATION_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await applicationsService.getApplicationById(id);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.APPLICATION_DELETE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await applicationsService.deleteApplication(id);
    res.json({ data: { success: true } });
  }),
);

export default router;
