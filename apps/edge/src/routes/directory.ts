import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import { listDirectorySchema } from "@nexora/contracts/modules/directory/directory.validation";
import { directoryService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const DIRECTORY_READ = [PERMISSIONS.DIRECTORY_READ, PERMISSIONS.DIRECTORY_VIEW_SENSITIVE] as const;

function canViewSensitive(permissions: string[]) {
  return permissions.includes(PERMISSIONS.DIRECTORY_VIEW_SENSITIVE);
}

export const directory = new Hono<AppEnv>()
  .get("/", requirePermission(...DIRECTORY_READ), zValidator("query", listDirectorySchema), async (c) =>
    c.json(
      await directoryService.list(
        c.var.db,
        c.req.valid("query"),
        canViewSensitive(c.var.user!.permissions),
      ),
    ),
  )
  .get("/assignable", requireAuth, zValidator("query", listDirectorySchema), async (c) =>
    c.json(await directoryService.listAssignable(c.var.db, c.req.valid("query"))),
  )
  .get("/assignable/:id", requireAuth, async (c) =>
    c.json({ data: await directoryService.getAssignableById(c.var.db, c.req.param("id")) }),
  )
  .get("/departments", requirePermission(...DIRECTORY_READ), async (c) =>
    c.json({ data: await directoryService.getDepartments(c.var.db) }),
  )
  .get("/org-chart", requirePermission(...DIRECTORY_READ), async (c) =>
    c.json({ data: await directoryService.getOrgChart(c.var.db) }),
  )
  .get("/:id", requirePermission(...DIRECTORY_READ), async (c) =>
    c.json({
      data: await directoryService.getById(
        c.var.db,
        c.req.param("id"),
        canViewSensitive(c.var.user!.permissions),
      ),
    }),
  );
