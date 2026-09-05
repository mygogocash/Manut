import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createRequestSchema,
  createSystemSchema,
  decisionSchema,
  grantSchema,
  rejectSchema,
  requestQuerySchema,
  revokeAssignmentSchema,
  updateRequestSchema,
  updateSystemSchema,
} from "@nexora/contracts/modules/it-access/it-access.validation";
import { itAccessService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const READ = [
  PERMISSIONS.IT_ACCESS_REQUEST,
  PERMISSIONS.IT_ACCESS_VIEW,
  PERMISSIONS.IT_ACCESS_APPROVE,
  PERMISSIONS.IT_ACCESS_MANAGE,
] as const;
const VIEW_ALL = [
  PERMISSIONS.IT_ACCESS_VIEW,
  PERMISSIONS.IT_ACCESS_APPROVE,
  PERMISSIONS.IT_ACCESS_MANAGE,
] as const;
const MANAGE = [PERMISSIONS.IT_ACCESS_MANAGE] as const;

export const itAccess = new Hono<AppEnv>()
  .get("/systems", requirePermission(...READ), async (c) =>
    c.json(await itAccessService.listSystems(c.var.db, c.req.query("active") === "true")),
  )
  .post(
    "/systems",
    requirePermission(...MANAGE),
    zValidator("json", createSystemSchema),
    async (c) => {
      const data = await itAccessService.createSystem(
        c.var.db,
        c.req.valid("json"),
        c.var.user!.id,
      );
      return c.json(data, 201);
    },
  )
  .patch(
    "/systems/:id",
    requirePermission(...MANAGE),
    zValidator("json", updateSystemSchema),
    async (c) =>
      c.json(
        await itAccessService.updateSystem(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
        ),
      ),
  )
  .delete("/systems/:id", requirePermission(...MANAGE), async (c) =>
    c.json(await itAccessService.deleteSystem(c.var.db, c.req.param("id"), c.var.user!.id)),
  )
  .get("/assignments", requirePermission(...VIEW_ALL), async (c) =>
    c.json(
      await itAccessService.listAssignments(c.var.db, {
        employeeId: c.req.query("employeeId"),
        systemId: c.req.query("systemId"),
        status: c.req.query("status"),
      }),
    ),
  )
  .post(
    "/assignments/:id/revoke",
    requirePermission(...MANAGE),
    zValidator("json", revokeAssignmentSchema),
    async (c) =>
      c.json(
        await itAccessService.revokeAssignment(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
        ),
      ),
  )
  .post("/offboarding/:employeeId", requirePermission(...MANAGE), async (c) => {
    const body = (await c.req.json<{ reason?: string }>().catch(() => ({}))) as {
      reason?: string;
    };
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Employee offboarding";
    return c.json(
      await itAccessService.offboardEmployee(
        c.var.db,
        c.req.param("employeeId"),
        c.var.user!.id,
        reason,
      ),
    );
  })
  .get("/audit", requirePermission(...VIEW_ALL), async (c) =>
    c.json(
      await itAccessService.listAudit(c.var.db, {
        requestId: c.req.query("requestId"),
        targetUserId: c.req.query("targetUserId"),
      }),
    ),
  )
  .get(
    "/requests",
    requirePermission(...READ),
    zValidator("query", requestQuerySchema),
    async (c) =>
      c.json(
        await itAccessService.listRequests(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("query"),
        ),
      ),
  )
  .post(
    "/requests",
    requirePermission(...READ),
    zValidator("json", createRequestSchema),
    async (c) => {
      const data = await itAccessService.createRequest(
        c.var.db,
        c.req.valid("json"),
        c.var.user!.id,
        c.var.user!.permissions,
      );
      return c.json(data, 201);
    },
  )
  .get("/requests/:id", requirePermission(...READ), async (c) =>
    c.json(
      await itAccessService.getRequest(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    ),
  )
  .patch(
    "/requests/:id",
    requirePermission(...READ),
    zValidator("json", updateRequestSchema),
    async (c) =>
      c.json(
        await itAccessService.updateRequest(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
          c.var.user!.permissions,
        ),
      ),
  )
  .delete("/requests/:id", requirePermission(...READ), async (c) =>
    c.json(
      await itAccessService.deleteRequest(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    ),
  )
  .post("/requests/:id/submit", requirePermission(...READ), async (c) =>
    c.json(
      await itAccessService.submitRequest(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    ),
  )
  .post(
    "/requests/:id/approve",
    requirePermission(...READ),
    zValidator("json", decisionSchema),
    async (c) =>
      c.json(
        await itAccessService.approveRequest(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
          c.var.user!.permissions,
        ),
      ),
  )
  .post(
    "/requests/:id/reject",
    requirePermission(...READ),
    zValidator("json", rejectSchema),
    async (c) =>
      c.json(
        await itAccessService.rejectRequest(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
          c.var.user!.permissions,
        ),
      ),
  )
  .post(
    "/requests/:id/grant",
    requirePermission(...MANAGE),
    zValidator("json", grantSchema),
    async (c) =>
      c.json(
        await itAccessService.grantRequest(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
        ),
      ),
  );
