import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createHolidaySchema,
  holidayQuerySchema,
  updateHolidaySchema,
} from "@nexora/contracts/modules/holidays/holidays.validation";
import { holidaysService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const holidays = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ), zValidator("query", holidayQuerySchema), async (c) => {
    return c.json(await holidaysService.list(c.var.db, c.req.valid("query")));
  })
  .post("/", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), zValidator("json", createHolidaySchema), async (c) => {
    const data = await holidaysService.create(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .put("/:id", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), zValidator("json", updateHolidaySchema), async (c) => {
    const data = await holidaysService.update(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/:id", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), async (c) => {
    const data = await holidaysService.remove(c.var.db, c.req.param("id"));
    return c.json({ data });
  });
