import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { trackDocumentViewedServer } from "@/lib/events";
import { dataRoomService } from "@/modules/dataroom/dataroom.service";
import {
  createDocumentSchema,
  listDocumentsSchema,
  updateDocumentSchema,
} from "@/modules/dataroom/dataroom.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.DATAROOM_READ),
  asyncHandler(async (req, res) => {
    const query = listDocumentsSchema.parse(req.query);
    const result = await dataRoomService.list(query);
    res.json(result);
  }),
);

router.get(
  "/summary",
  requirePermission(PERMISSIONS.DATAROOM_READ),
  asyncHandler(async (req, res) => {
    const data = await dataRoomService.getCategorySummary();
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.DATAROOM_UPLOAD),
  asyncHandler(async (req, res) => {
    const input = createDocumentSchema.parse(req.body);
    const data = await dataRoomService.upload(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.DATAROOM_READ),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const data = await dataRoomService.getById(id);
    res.json({ data });
    try {
      if (req.user) {
        trackDocumentViewedServer(
          { id: req.user.id, entityId: req.user.entityId },
          { document_id: id, document_kind: "dataroom" },
        );
      }
    } catch {
      // analytics is best-effort
    }
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.DATAROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateDocumentSchema.parse(req.body);
    const data = await dataRoomService.update(req.params.id as string, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DATAROOM_MANAGE),
  asyncHandler(async (req, res) => {
    await dataRoomService.delete(req.params.id as string);
    res.json({ data: { success: true } });
  }),
);

export default router;
