import { Router } from "express";

import attendanceRoutes from "@/modules/hrms/attendance.controller";
import attendancePhase2Routes from "@/modules/hrms/attendance-phase2.controller";
import attendancePhase3Routes from "@/modules/hrms/attendance-phase3.controller";
import hrmsRoutes from "@/modules/hrms/hrms.controller";

const router = Router();
router.use(hrmsRoutes);
router.use(attendanceRoutes);
router.use(attendancePhase2Routes);
router.use(attendancePhase3Routes);

export { router as hrmsRoutes };
export default router;
