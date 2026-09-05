import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PERMISSIONS } from "@nexora/contracts";
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
} from "@nexora/contracts/modules/office/office.validation";
import { officeService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const officeRead = [
  PERMISSIONS.OFFICE_READ,
  PERMISSIONS.OFFICE_BOOK,
  PERMISSIONS.OFFICE_MANAGE,
] as const;

const officeManage = [PERMISSIONS.OFFICE_MANAGE, PERMISSIONS.USER_UPDATE] as const;

const optionalOfficeIdQuery = z.object({ officeId: z.string().optional() });

export const office = new Hono<AppEnv>()
  .get("/offices", requirePermission(...officeRead), async (c) =>
    c.json({ data: await officeService.listOffices(c.var.db) }),
  )
  .post("/offices", requirePermission(...officeManage), zValidator("json", createOfficeSchema), async (c) => {
    const data = await officeService.createOffice(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .put("/offices/:id", requirePermission(...officeManage), zValidator("json", updateOfficeSchema), async (c) => {
    const data = await officeService.updateOffice(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/offices/:id", requirePermission(...officeManage), async (c) => {
    await officeService.deleteOffice(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  })
  .get("/desks", requirePermission(...officeRead), zValidator("query", deskQuerySchema), async (c) =>
    c.json({ data: await officeService.listDesks(c.var.db, c.req.valid("query")) }),
  )
  .get("/desks/manage", requirePermission(...officeManage), zValidator("query", optionalOfficeIdQuery), async (c) =>
    c.json({ data: await officeService.listAllDesks(c.var.db, c.req.valid("query").officeId) }),
  )
  .post("/desks", requirePermission(...officeManage), zValidator("json", createDeskSchema), async (c) => {
    const data = await officeService.createDesk(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .post("/desks/book", requirePermission(PERMISSIONS.OFFICE_BOOK), zValidator("json", bookDeskSchema), async (c) => {
    const data = await officeService.bookDesk(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .delete("/desks/bookings/:id", requirePermission(PERMISSIONS.OFFICE_BOOK), async (c) => {
    await officeService.cancelDeskBooking(c.var.db, c.req.param("id"), c.var.user!.id);
    return c.json({ data: { success: true } });
  })
  .put("/desks/:id", requirePermission(...officeManage), zValidator("json", updateDeskSchema), async (c) => {
    const data = await officeService.updateDesk(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/desks/:id", requirePermission(...officeManage), async (c) => {
    await officeService.deleteDesk(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  })
  .get("/rooms", requirePermission(...officeRead), zValidator("query", roomQuerySchema), async (c) =>
    c.json({ data: await officeService.listRooms(c.var.db, c.req.valid("query")) }),
  )
  .get("/rooms/manage", requirePermission(...officeManage), zValidator("query", optionalOfficeIdQuery), async (c) =>
    c.json({ data: await officeService.listAllRooms(c.var.db, c.req.valid("query").officeId) }),
  )
  .get("/rooms/search", requirePermission(...officeRead), zValidator("query", searchRoomsSchema), async (c) =>
    c.json({ data: await officeService.searchRooms(c.var.db, c.req.valid("query")) }),
  )
  .get("/rooms/my-bookings", requirePermission(PERMISSIONS.OFFICE_BOOK), async (c) =>
    c.json({ data: await officeService.listMyRoomBookings(c.var.db, c.var.user!.id) }),
  )
  .post("/rooms", requirePermission(...officeManage), zValidator("json", createRoomSchema), async (c) => {
    const data = await officeService.createRoom(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .post("/rooms/book", requirePermission(PERMISSIONS.OFFICE_BOOK), zValidator("json", bookRoomSchema), async (c) => {
    const data = await officeService.bookRoom(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .delete("/rooms/bookings/:id", requirePermission(PERMISSIONS.OFFICE_BOOK), async (c) => {
    await officeService.cancelRoomBooking(c.var.db, c.req.param("id"), c.var.user!.id);
    return c.json({ data: { success: true } });
  })
  .put("/rooms/:id", requirePermission(...officeManage), zValidator("json", updateRoomSchema), async (c) => {
    const data = await officeService.updateRoom(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/rooms/:id", requirePermission(...officeManage), async (c) => {
    await officeService.deleteRoom(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  })
  .get("/assets", requirePermission(...officeRead), zValidator("query", assetQuerySchema), async (c) =>
    c.json(await officeService.listAssets(c.var.db, c.req.valid("query"))),
  )
  .post("/assets/import/preview", requirePermission(...officeManage), zValidator("json", assetImportSchema), async (c) => {
    const { rows, office: officeTarget } = c.req.valid("json");
    return c.json({ data: await officeService.previewAssetImport(c.var.db, rows, officeTarget) });
  })
  .post("/assets/import/commit", requirePermission(...officeManage), zValidator("json", assetImportSchema), async (c) => {
    const { rows, office: officeTarget } = c.req.valid("json");
    return c.json({ data: await officeService.commitAssetImport(c.var.db, rows, officeTarget) });
  })
  .post("/assets", requirePermission(...officeManage), zValidator("json", createAssetSchema), async (c) => {
    const data = await officeService.createAsset(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/assets/:id", requirePermission(...officeRead), async (c) =>
    c.json({ data: await officeService.getAssetById(c.var.db, c.req.param("id")) }),
  )
  .put("/assets/:id", requirePermission(...officeManage), zValidator("json", updateAssetSchema), async (c) => {
    const data = await officeService.updateAsset(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/assets/:id", requirePermission(...officeManage), async (c) => {
    await officeService.deleteAsset(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
