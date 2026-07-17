import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { holidaysService } from "@/modules/holidays/holidays.service";
import {
  createHolidaySchema,
  holidayQuerySchema,
  updateHolidaySchema,
} from "@/modules/holidays/holidays.validation";

const router = Router();

router.use(authenticate, requireActive);

// Read is open to anyone with leave:read so employees can see the
// holiday calendar that applies to their entity.
router.get(
  "/",
  requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const query = holidayQuerySchema.parse(req.query);
    const result = await holidaysService.list(query);
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const input = createHolidaySchema.parse(req.body);
    const data = await holidaysService.create(input);
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateHolidaySchema.parse(req.body);
    const data = await holidaysService.update(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await holidaysService.remove(id);
    res.json({ data });
  }),
);

export default router;
