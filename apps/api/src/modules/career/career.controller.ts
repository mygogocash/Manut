import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { careerService } from "@/modules/career/career.service";
import {
  createJobSchema,
  jobQuerySchema,
  updateJobSchema,
} from "@/modules/career/career.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.CAREER_READ),
  asyncHandler(async (req, res) => {
    const query = jobQuerySchema.parse(req.query);
    const result = await careerService.listJobs(query);
    res.json(result);
  }),
);

router.get(
  "/titles",
  requirePermission(PERMISSIONS.CAREER_READ),
  asyncHandler(async (_req, res) => {
    const data = await careerService.getJobTitles();
    res.json({ data });
  }),
);

router.get(
  "/export",
  requirePermission(PERMISSIONS.CAREER_READ),
  asyncHandler(async (req, res) => {
    const search = (req.query.search as string) || undefined;
    const csv = await careerService.exportCsv({ search });
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="jobs-${day}.csv"`,
    );
    res.send(csv);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.CAREER_CREATE),
  asyncHandler(async (req, res) => {
    const input = createJobSchema.parse(req.body);
    const data = await careerService.createJob(input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.CAREER_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await careerService.getJobById(id);
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.CAREER_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateJobSchema.parse(req.body);
    const data = await careerService.updateJob(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.CAREER_DELETE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await careerService.deleteJob(id);
    res.json({ data: { success: true } });
  }),
);

export default router;
