import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createPartnerColumnSchema,
  createPartnerTaskCommentSchema,
  createPartnerTaskResourceSchema,
  createPartnerTaskSchema,
  managePartnerMembersSchema,
  managePartnerTaskAssigneesSchema,
  updatePartnerColumnSchema,
  updatePartnerTaskSchema,
} from "@nexora/contracts/modules/partners/partner-workspace.validation";
import {
  createContactSchema,
  createPartnerSchema,
  importPartnersSchema,
  importPartnerTasksSchema,
  partnerQuerySchema,
  reorderPartnersSchema,
  updateContactSchema,
  updatePartnerSchema,
} from "@nexora/contracts/modules/partners/partners.validation";
import { partnerWorkspaceService, partnersService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const partners = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.PARTNERS_READ), zValidator("query", partnerQuerySchema), async (c) =>
    c.json(await partnersService.list(c.var.db, c.req.valid("query"))),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.PARTNERS_CREATE),
    zValidator("json", createPartnerSchema),
    async (c) => {
      const data = await partnersService.create(c.var.db, c.req.valid("json"), c.var.user!.id);
      return c.json({ data }, 201);
    },
  )
  .post(
    "/import",
    requirePermission(PERMISSIONS.PARTNERS_CREATE),
    zValidator("json", importPartnersSchema),
    async (c) => {
      const data = await partnersService.importRows(c.var.db, c.req.valid("json").rows, c.var.user!.id);
      return c.json({ data }, 201);
    },
  )
  .get(
    "/tasks/export",
    requirePermission(PERMISSIONS.PARTNERS_READ),
    zValidator("query", partnerQuerySchema),
    async (c) => {
      const data = await partnersService.exportTasks(c.var.db, c.req.valid("query"));
      return c.json({ data });
    },
  )
  .post(
    "/tasks/import",
    requirePermission(PERMISSIONS.PARTNERS_CREATE),
    zValidator("json", importPartnerTasksSchema),
    async (c) => {
      const data = await partnersService.importTasks(c.var.db, c.req.valid("json").rows);
      return c.json({ data }, 201);
    },
  )
  .post(
    "/reorder",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", reorderPartnersSchema),
    async (c) => c.json(await partnersService.reorder(c.var.db, c.req.valid("json").ids)),
  )
  .get("/:id", requirePermission(PERMISSIONS.PARTNERS_READ), async (c) =>
    c.json({ data: await partnersService.getById(c.var.db, c.req.param("id")) }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", updatePartnerSchema),
    async (c) =>
      c.json({
        data: await partnersService.update(c.var.db, c.req.param("id"), c.req.valid("json"), c.var.user!.id),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.PARTNERS_DELETE), async (c) => {
    await partnersService.remove(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  })
  .get("/:id/contacts", requirePermission(PERMISSIONS.PARTNERS_READ), async (c) =>
    c.json({ data: await partnersService.listContacts(c.var.db, c.req.param("id")) }),
  )
  .post(
    "/:id/contacts",
    requirePermission(PERMISSIONS.PARTNERS_CREATE),
    zValidator("json", createContactSchema),
    async (c) => {
      const data = await partnersService.createContact(c.var.db, c.req.param("id"), c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .put(
    "/:id/contacts/:contactId",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", updateContactSchema),
    async (c) =>
      c.json({
        data: await partnersService.updateContact(
          c.var.db,
          c.req.param("id"),
          c.req.param("contactId"),
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id/contacts/:contactId", requirePermission(PERMISSIONS.PARTNERS_DELETE), async (c) => {
    await partnersService.deleteContact(c.var.db, c.req.param("id"), c.req.param("contactId"));
    return c.json({ data: { success: true } });
  })
  .get("/:id/board", requirePermission(PERMISSIONS.PARTNERS_READ), async (c) =>
    c.json({ data: await partnerWorkspaceService.getBoard(c.var.db, c.req.param("id")) }),
  )
  .post(
    "/:id/tasks",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", createPartnerTaskSchema),
    async (c) => {
      const data = await partnerWorkspaceService.createTask(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
        c.var.user!.id,
      );
      return c.json({ data }, 201);
    },
  )
  .put(
    "/:id/tasks/:taskId",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", updatePartnerTaskSchema),
    async (c) =>
      c.json({
        data: await partnerWorkspaceService.updateTask(
          c.var.db,
          c.req.param("id"),
          c.req.param("taskId"),
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id/tasks/:taskId", requirePermission(PERMISSIONS.PARTNERS_UPDATE), async (c) => {
    await partnerWorkspaceService.deleteTask(c.var.db, c.req.param("id"), c.req.param("taskId"));
    return c.json({ data: { success: true } });
  })
  .post(
    "/:id/columns",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", createPartnerColumnSchema),
    async (c) => {
      const data = await partnerWorkspaceService.createColumn(c.var.db, c.req.param("id"), c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .put(
    "/:id/columns/:columnId",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", updatePartnerColumnSchema),
    async (c) =>
      c.json({
        data: await partnerWorkspaceService.updateColumn(
          c.var.db,
          c.req.param("id"),
          c.req.param("columnId"),
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id/columns/:columnId", requirePermission(PERMISSIONS.PARTNERS_UPDATE), async (c) => {
    await partnerWorkspaceService.deleteColumn(c.var.db, c.req.param("id"), c.req.param("columnId"));
    return c.json({ data: { success: true } });
  })
  .get("/:id/members", requirePermission(PERMISSIONS.PARTNERS_READ), async (c) =>
    c.json({ data: await partnerWorkspaceService.listMembers(c.var.db, c.req.param("id")) }),
  )
  .put(
    "/:id/members",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", managePartnerMembersSchema),
    async (c) =>
      c.json({ data: await partnerWorkspaceService.setMembers(c.var.db, c.req.param("id"), c.req.valid("json")) }),
  )
  .post(
    "/:id/tasks/:taskId/comments",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", createPartnerTaskCommentSchema),
    async (c) => {
      const data = await partnerWorkspaceService.createTaskComment(
        c.var.db,
        c.req.param("id"),
        c.req.param("taskId"),
        c.req.valid("json"),
        c.var.user!.id,
      );
      return c.json({ data }, 201);
    },
  )
  .put(
    "/:id/tasks/:taskId/assignees",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", managePartnerTaskAssigneesSchema),
    async (c) =>
      c.json({
        data: await partnerWorkspaceService.setTaskAssignees(
          c.var.db,
          c.req.param("id"),
          c.req.param("taskId"),
          c.req.valid("json"),
        ),
      }),
  )
  .get("/:id/tasks/:taskId/resources", requirePermission(PERMISSIONS.PARTNERS_READ), async (c) =>
    c.json({
      data: await partnerWorkspaceService.listTaskResources(
        c.var.db,
        c.req.param("id"),
        c.req.param("taskId"),
      ),
    }),
  )
  .post(
    "/:id/tasks/:taskId/resources",
    requirePermission(PERMISSIONS.PARTNERS_UPDATE),
    zValidator("json", createPartnerTaskResourceSchema),
    async (c) => {
      const data = await partnerWorkspaceService.addTaskResource(
        c.var.db,
        c.req.param("id"),
        c.req.param("taskId"),
        c.req.valid("json"),
        c.var.user!.id,
      );
      return c.json({ data }, 201);
    },
  )
  .delete("/:id/tasks/:taskId/resources/:resourceId", requirePermission(PERMISSIONS.PARTNERS_UPDATE), async (c) => {
    const data = await partnerWorkspaceService.removeTaskResource(
      c.var.db,
      c.req.param("id"),
      c.req.param("taskId"),
      c.req.param("resourceId"),
    );
    return c.json({ data });
  });
