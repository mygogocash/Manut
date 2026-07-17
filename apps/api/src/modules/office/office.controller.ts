import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { officeService } from "@/modules/office/office.service";
import {
  assetImportSchema,
  assetQuerySchema,
  bookDeskSchema,
  bookRoomSchema,
  createAssetSchema,
  createDeskSchema,
  createOfficeSchema,
  createRoomSchema,
  deskQuerySchema,
  roomQuerySchema,
  searchRoomsSchema,
  updateAssetSchema,
  updateDeskSchema,
  updateOfficeSchema,
  updateRoomSchema,
} from "@/modules/office/office.validation";

const router = Router();

router.use(authenticate, requireActive);

// ─── Offices ────────────────────────────────────────────

router.get(
  "/offices",
  requirePermission(
    PERMISSIONS.OFFICE_READ,
    PERMISSIONS.OFFICE_BOOK,
    PERMISSIONS.OFFICE_MANAGE,
  ),
  asyncHandler(async (_req, res) => {
    const data = await officeService.listOffices();
    res.json({ data });
  }),
);

router.post(
  "/offices",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const input = createOfficeSchema.parse(req.body);
    const data = await officeService.createOffice(input);
    res.status(201).json({ data });
  }),
);

router.put(
  "/offices/:id",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateOfficeSchema.parse(req.body);
    const data = await officeService.updateOffice(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/offices/:id",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await officeService.deleteOffice(id);
    res.json({ data: { success: true } });
  }),
);

// ─── Desks ──────────────────────────────────────────────

router.get(
  "/desks",
  requirePermission(
    PERMISSIONS.OFFICE_READ,
    PERMISSIONS.OFFICE_BOOK,
    PERMISSIONS.OFFICE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = deskQuerySchema.parse(req.query);
    const data = await officeService.listDesks(query);
    res.json({ data });
  }),
);

// Literal-segment route — must be registered before any `/desks/:id`
// route; Express matches in registration order and `:id` would
// otherwise swallow `/manage`.
router.get(
  "/desks/manage",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const officeId =
      typeof req.query.officeId === "string" ? req.query.officeId : undefined;
    const data = await officeService.listAllDesks(officeId);
    res.json({ data });
  }),
);

router.post(
  "/desks",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const input = createDeskSchema.parse(req.body);
    const data = await officeService.createDesk(input);
    res.status(201).json({ data });
  }),
);

router.post(
  "/desks/book",
  requirePermission(PERMISSIONS.OFFICE_BOOK),
  asyncHandler(async (req, res) => {
    const input = bookDeskSchema.parse(req.body);
    const data = await officeService.bookDesk(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

router.delete(
  "/desks/bookings/:id",
  requirePermission(PERMISSIONS.OFFICE_BOOK),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await officeService.cancelDeskBooking(id, req.user!.id);
    res.json({ data: { success: true } });
  }),
);

router.put(
  "/desks/:id",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateDeskSchema.parse(req.body);
    const data = await officeService.updateDesk(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/desks/:id",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await officeService.deleteDesk(id);
    res.json({ data: { success: true } });
  }),
);

// ─── Rooms ──────────────────────────────────────────────

router.get(
  "/rooms",
  requirePermission(
    PERMISSIONS.OFFICE_READ,
    PERMISSIONS.OFFICE_BOOK,
    PERMISSIONS.OFFICE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = roomQuerySchema.parse(req.query);
    const data = await officeService.listRooms(query);
    res.json({ data });
  }),
);

router.get(
  "/rooms/manage",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const officeId =
      typeof req.query.officeId === "string" ? req.query.officeId : undefined;
    const data = await officeService.listAllRooms(officeId);
    res.json({ data });
  }),
);

router.post(
  "/rooms",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const input = createRoomSchema.parse(req.body);
    const data = await officeService.createRoom(input);
    res.status(201).json({ data });
  }),
);

// Search-driven room finder: picks rooms free for the entire date +
// time window. Powers the new sidebar-filter UI.
router.get(
  "/rooms/search",
  requirePermission(
    PERMISSIONS.OFFICE_READ,
    PERMISSIONS.OFFICE_BOOK,
    PERMISSIONS.OFFICE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const input = searchRoomsSchema.parse(req.query);
    const data = await officeService.searchRooms(input);
    res.json({ data });
  }),
);

router.post(
  "/rooms/book",
  requirePermission(PERMISSIONS.OFFICE_BOOK),
  asyncHandler(async (req, res) => {
    const input = bookRoomSchema.parse(req.body);
    const data = await officeService.bookRoom(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

// User's own upcoming room bookings (today + future). Powers the
// "My bookings" panel on /office so the requester can cancel without
// hunting by date. Literal path — must precede "/rooms/:id".
router.get(
  "/rooms/my-bookings",
  requirePermission(PERMISSIONS.OFFICE_BOOK),
  asyncHandler(async (req, res) => {
    const data = await officeService.listMyRoomBookings(req.user!.id);
    res.json({ data });
  }),
);

router.delete(
  "/rooms/bookings/:id",
  requirePermission(PERMISSIONS.OFFICE_BOOK),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await officeService.cancelRoomBooking(id, req.user!.id);
    res.json({ data: { success: true } });
  }),
);

router.put(
  "/rooms/:id",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateRoomSchema.parse(req.body);
    const data = await officeService.updateRoom(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/rooms/:id",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await officeService.deleteRoom(id);
    res.json({ data: { success: true } });
  }),
);

// ─── Assets ─────────────────────────────────────────────

router.get(
  "/assets",
  // Any employee with the basic office bundle (`office:read`,
  // `office:book`, or `office:manage`) can browse the asset list. Widening
  // the read gate matches the intent ("anyone in HR /
  // ops should see the inventory") without granting edit rights.
  requirePermission(
    PERMISSIONS.OFFICE_READ,
    PERMISSIONS.OFFICE_BOOK,
    PERMISSIONS.OFFICE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = assetQuerySchema.parse(req.query);
    const result = await officeService.listAssets(query);
    res.json(result);
  }),
);

router.post(
  "/assets",
  // Asset CRUD is treated as an HR-side operation — anyone with
  // `office:manage` (facilities) or `user:update` (HR Manager) can
  // create / edit / delete inventory rows without granting broad writes.
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const input = createAssetSchema.parse(req.body);
    const data = await officeService.createAsset(input);
    res.status(201).json({ data });
  }),
);

// Bulk import — preview + commit. Frontend parses the multi-sheet
// HR template locally and POSTs canonical rows. Literal paths must
// come before the `/:id` routes below or Express's order-sensitive
// matcher swallows them.
router.post(
  "/assets/import/preview",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const { rows } = assetImportSchema.parse(req.body);
    const result = await officeService.previewAssetImport(rows);
    res.json({ data: result });
  }),
);

router.post(
  "/assets/import/commit",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const { rows } = assetImportSchema.parse(req.body);
    const result = await officeService.commitAssetImport(rows);
    res.json({ data: result });
  }),
);

router.get(
  "/assets/:id",
  requirePermission(
    PERMISSIONS.OFFICE_READ,
    PERMISSIONS.OFFICE_BOOK,
    PERMISSIONS.OFFICE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await officeService.getAssetById(id);
    res.json({ data });
  }),
);

router.put(
  "/assets/:id",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateAssetSchema.parse(req.body);
    const data = await officeService.updateAsset(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/assets/:id",
  requirePermission(PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await officeService.deleteAsset(id);
    res.json({ data: { success: true } });
  }),
);

export default router;
