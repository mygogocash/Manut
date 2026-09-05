import { Hono } from "hono";
import { isNull } from "drizzle-orm";
import { schema } from "@nexora/db";
import { PERMISSIONS } from "@nexora/contracts";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

/** Minimal roles list (Phase 2). Full CRUD + reorder in a later wave. */
export const roles = new Hono<AppEnv>().get("/", requirePermission(PERMISSIONS.ROLE_READ, PERMISSIONS.USER_READ), async (c) => {
  const rows = await c.var.db
    .select({
      id: schema.roles.id,
      name: schema.roles.name,
      description: schema.roles.description,
      isSystem: schema.roles.isSystem,
      defaultRoute: schema.roles.defaultRoute,
    })
    .from(schema.roles)
    .where(isNull(schema.roles.deletedAt))
    .orderBy(schema.roles.name);

  return c.json({ data: rows });
});
