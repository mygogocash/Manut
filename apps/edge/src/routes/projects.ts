import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createColumnSchema,
  createProjectSchema,
  createTaskSchema,
  manageMembersSchema,
  projectQuerySchema,
  reorderProjectsSchema,
  reorderTasksSchema,
  updateColumnSchema,
  updateProjectSchema,
  updateTaskSchema,
} from "@nexora/contracts/modules/projects/projects.validation";
import { projectsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const PROJECT_READ_PERMS = [
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.PROJECTS_READ_ALL,
  PERMISSIONS.IT_CRM_READ,
  PERMISSIONS.IT_CRM_READ_ALL,
  PERMISSIONS.PRODUCT_CRM_READ,
  PERMISSIONS.PRODUCT_CRM_READ_ALL,
  PERMISSIONS.LEGAL_CRM_READ,
  PERMISSIONS.LEGAL_CRM_READ_ALL,
  PERMISSIONS.ACCOUNTING_CRM_READ,
  PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
  PERMISSIONS.HR_CRM_READ,
  PERMISSIONS.HR_CRM_READ_ALL,
] as const;

const PROJECT_WRITE_PERMS = [
  PERMISSIONS.PROJECTS_UPDATE,
  PERMISSIONS.PROJECTS_MANAGE,
  PERMISSIONS.IT_CRM_UPDATE,
  PERMISSIONS.IT_CRM_MANAGE,
  PERMISSIONS.PRODUCT_CRM_UPDATE,
  PERMISSIONS.PRODUCT_CRM_MANAGE,
  PERMISSIONS.LEGAL_CRM_UPDATE,
  PERMISSIONS.LEGAL_CRM_MANAGE,
  PERMISSIONS.ACCOUNTING_CRM_UPDATE,
  PERMISSIONS.ACCOUNTING_CRM_MANAGE,
  PERMISSIONS.HR_CRM_UPDATE,
  PERMISSIONS.HR_CRM_MANAGE,
] as const;

const PROJECT_CREATE_PERMS = [
  PERMISSIONS.PROJECTS_CREATE,
  PERMISSIONS.IT_CRM_CREATE,
  PERMISSIONS.PRODUCT_CRM_CREATE,
  PERMISSIONS.LEGAL_CRM_CREATE,
  PERMISSIONS.ACCOUNTING_CRM_CREATE,
  PERMISSIONS.HR_CRM_CREATE,
] as const;

const PROJECT_ARCHIVE_PERMS = [
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.PROJECTS_READ_ALL,
  PERMISSIONS.PROJECTS_DELETE,
  PERMISSIONS.PROJECTS_MANAGE,
  PERMISSIONS.IT_CRM_READ,
  PERMISSIONS.IT_CRM_READ_ALL,
  PERMISSIONS.IT_CRM_DELETE,
  PERMISSIONS.IT_CRM_MANAGE,
  PERMISSIONS.PRODUCT_CRM_READ,
  PERMISSIONS.PRODUCT_CRM_READ_ALL,
  PERMISSIONS.PRODUCT_CRM_DELETE,
  PERMISSIONS.PRODUCT_CRM_MANAGE,
  PERMISSIONS.LEGAL_CRM_READ,
  PERMISSIONS.LEGAL_CRM_READ_ALL,
  PERMISSIONS.LEGAL_CRM_DELETE,
  PERMISSIONS.LEGAL_CRM_MANAGE,
  PERMISSIONS.ACCOUNTING_CRM_READ,
  PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
  PERMISSIONS.ACCOUNTING_CRM_DELETE,
  PERMISSIONS.ACCOUNTING_CRM_MANAGE,
  PERMISSIONS.HR_CRM_READ,
  PERMISSIONS.HR_CRM_READ_ALL,
  PERMISSIONS.HR_CRM_DELETE,
  PERMISSIONS.HR_CRM_MANAGE,
] as const;

const PROJECT_UPDATE_ROUTE_PERMS = [
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.PROJECTS_READ_ALL,
  PERMISSIONS.PROJECTS_UPDATE,
  PERMISSIONS.PROJECTS_MANAGE,
  PERMISSIONS.IT_CRM_READ,
  PERMISSIONS.IT_CRM_READ_ALL,
  PERMISSIONS.IT_CRM_UPDATE,
  PERMISSIONS.IT_CRM_MANAGE,
  PERMISSIONS.PRODUCT_CRM_READ,
  PERMISSIONS.PRODUCT_CRM_READ_ALL,
  PERMISSIONS.PRODUCT_CRM_UPDATE,
  PERMISSIONS.PRODUCT_CRM_MANAGE,
  PERMISSIONS.LEGAL_CRM_READ,
  PERMISSIONS.LEGAL_CRM_READ_ALL,
  PERMISSIONS.LEGAL_CRM_UPDATE,
  PERMISSIONS.LEGAL_CRM_MANAGE,
  PERMISSIONS.ACCOUNTING_CRM_READ,
  PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
  PERMISSIONS.ACCOUNTING_CRM_UPDATE,
  PERMISSIONS.ACCOUNTING_CRM_MANAGE,
  PERMISSIONS.HR_CRM_READ,
  PERMISSIONS.HR_CRM_READ_ALL,
  PERMISSIONS.HR_CRM_UPDATE,
  PERMISSIONS.HR_CRM_MANAGE,
] as const;

const PROJECT_DELETE_ROUTE_PERMS = [
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.PROJECTS_READ_ALL,
  PERMISSIONS.PROJECTS_DELETE,
  PERMISSIONS.PROJECTS_MANAGE,
  PERMISSIONS.IT_CRM_READ,
  PERMISSIONS.IT_CRM_READ_ALL,
  PERMISSIONS.IT_CRM_DELETE,
  PERMISSIONS.IT_CRM_MANAGE,
  PERMISSIONS.PRODUCT_CRM_READ,
  PERMISSIONS.PRODUCT_CRM_READ_ALL,
  PERMISSIONS.PRODUCT_CRM_DELETE,
  PERMISSIONS.PRODUCT_CRM_MANAGE,
  PERMISSIONS.LEGAL_CRM_READ,
  PERMISSIONS.LEGAL_CRM_READ_ALL,
  PERMISSIONS.LEGAL_CRM_DELETE,
  PERMISSIONS.LEGAL_CRM_MANAGE,
  PERMISSIONS.ACCOUNTING_CRM_READ,
  PERMISSIONS.ACCOUNTING_CRM_READ_ALL,
  PERMISSIONS.ACCOUNTING_CRM_DELETE,
  PERMISSIONS.ACCOUNTING_CRM_MANAGE,
  PERMISSIONS.HR_CRM_READ,
  PERMISSIONS.HR_CRM_READ_ALL,
  PERMISSIONS.HR_CRM_DELETE,
  PERMISSIONS.HR_CRM_MANAGE,
] as const;

function notImplemented(message: string) {
  return (c: { json: (body: unknown, status?: number) => Response }) =>
    c.json({ error: { code: "NOT_IMPLEMENTED", message } }, 501);
}

export const projects = new Hono<AppEnv>()
  // ── Workflow stubs (literal before /:id) ────────────────────────────────
  .get("/workflow/queue", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow queue requires Node workflow service"))
  // ── List / create ───────────────────────────────────────────────────────
  .get("/", requirePermission(...PROJECT_READ_PERMS), zValidator("query", projectQuerySchema), async (c) =>
    c.json(await projectsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post("/", requirePermission(...PROJECT_CREATE_PERMS), zValidator("json", createProjectSchema), async (c) =>
    c.json(
      {
        data: await projectsService.create(c.var.db, c.var.user!.id, c.req.valid("json")),
      },
      201,
    ),
  )
  .post("/import", requirePermission(...PROJECT_CREATE_PERMS), notImplemented("Project import requires Node xlsx pipeline"))
  .get("/tasks/export", requirePermission(...PROJECT_READ_PERMS), notImplemented("Task export requires Node pipeline"))
  .post("/tasks/import", requirePermission(...PROJECT_CREATE_PERMS), notImplemented("Task import requires Node pipeline"))
  .post("/import-combined", requirePermission(...PROJECT_CREATE_PERMS), notImplemented("Combined import requires Node pipeline"))
  .get("/dashboard", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project dashboard rollup requires Node aggregates"))
  .put(
    "/reorder",
    requirePermission(...PROJECT_WRITE_PERMS),
    zValidator("json", reorderProjectsSchema),
    async (c) =>
      c.json({
        data: await projectsService.reorder(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  // ── By id ───────────────────────────────────────────────────────────────
  .get("/:id", requirePermission(...PROJECT_READ_PERMS), async (c) =>
    c.json({
      data: await projectsService.getById(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.param("id"),
      ),
    }),
  )
  .put(
    "/:id",
    requirePermission(...PROJECT_UPDATE_ROUTE_PERMS),
    zValidator("json", updateProjectSchema),
    async (c) =>
      c.json({
        data: await projectsService.update(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.param("id"),
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id", requirePermission(...PROJECT_DELETE_ROUTE_PERMS), async (c) => {
    await projectsService.remove(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.param("id"));
    return c.json({ data: { success: true } });
  })
  .post("/:id/archive", requirePermission(...PROJECT_ARCHIVE_PERMS), async (c) =>
    c.json({
      data: await projectsService.archive(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.param("id"),
      ),
    }),
  )
  .post("/:id/unarchive", requirePermission(...PROJECT_ARCHIVE_PERMS), async (c) =>
    c.json({
      data: await projectsService.unarchive(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.param("id"),
      ),
    }),
  )
  .post("/:id/move", requirePermission(...PROJECT_WRITE_PERMS, PERMISSIONS.PARTNERS_CREATE), notImplemented("Move project requires partner sync (Node-only)"))
  // ── Workflow stubs on project ───────────────────────────────────────────
  .get("/:id/workflow/emails", requirePermission(...PROJECT_READ_PERMS), notImplemented("Workflow emails require Node email service"))
  .post("/:id/workflow/emails/retry", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Workflow email retry requires Node email service"))
  .get("/:id/workflow", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow state requires Node workflow service"))
  .get("/:id/workflow/detail", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow detail requires Node workflow service"))
  .post("/:id/workflow/submit", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow submit requires Node workflow service"))
  .post("/:id/workflow/approve", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow approve requires Node workflow service"))
  .post("/:id/workflow/complete", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow complete requires Node workflow service"))
  .post("/:id/workflow/return", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow return requires Node workflow service"))
  .post("/:id/workflow/escalate", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow escalate requires Node workflow service"))
  .post("/:id/workflow/reopen", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow reopen requires Node workflow service"))
  .post("/:id/workflow/archive", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow archive requires Node workflow service"))
  .post("/:id/workflow/reject", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project workflow reject requires Node workflow service"))
  // ── Members ─────────────────────────────────────────────────────────────
  .get("/:id/members", requirePermission(...PROJECT_READ_PERMS), async (c) =>
    c.json({
      data: await projectsService.getMembers(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.param("id"),
      ),
    }),
  )
  .put(
    "/:id/members",
    requirePermission(...PROJECT_WRITE_PERMS),
    zValidator("json", manageMembersSchema),
    async (c) =>
      c.json({
        data: await projectsService.setMembers(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.param("id"),
          c.req.valid("json"),
        ),
      }),
  )
  // ── Columns ─────────────────────────────────────────────────────────────
  .post(
    "/:id/columns",
    requirePermission(...PROJECT_WRITE_PERMS),
    zValidator("json", createColumnSchema),
    async (c) =>
      c.json(
        {
          data: await projectsService.addColumn(
            c.var.db,
            c.var.user!.id,
            c.var.user!.permissions,
            c.req.param("id"),
            c.req.valid("json"),
          ),
        },
        201,
      ),
  )
  .put(
    "/:id/columns/:columnId",
    requirePermission(...PROJECT_WRITE_PERMS),
    zValidator("json", updateColumnSchema),
    async (c) =>
      c.json({
        data: await projectsService.updateColumn(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.param("id"),
          c.req.param("columnId"),
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id/columns/:columnId", requirePermission(...PROJECT_WRITE_PERMS), async (c) => {
    await projectsService.deleteColumn(
      c.var.db,
      c.var.user!.id,
      c.var.user!.permissions,
      c.req.param("id"),
      c.req.param("columnId"),
    );
    return c.json({ data: { success: true } });
  })
  // ── AI / timeline / milestones stubs ────────────────────────────────────
  .post("/:id/ai/generate-tasks", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("AI task generation requires Gemini (Node-only)"))
  .get("/:id/timeline", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project timeline requires Node Gantt aggregates"))
  .get("/:id/milestones", requirePermission(...PROJECT_READ_PERMS), notImplemented("Milestones list requires Node service"))
  .post("/:id/milestones", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Milestone create requires Node service"))
  .put("/:id/milestones/:milestoneId", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Milestone update requires Node service"))
  .delete("/:id/milestones/:milestoneId", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Milestone delete requires Node service"))
  // ── Tasks ───────────────────────────────────────────────────────────────
  .post(
    "/:id/tasks",
    requirePermission(...PROJECT_WRITE_PERMS),
    zValidator("json", createTaskSchema),
    async (c) =>
      c.json(
        {
          data: await projectsService.addTask(
            c.var.db,
            c.var.user!.id,
            c.var.user!.permissions,
            c.req.param("id"),
            c.req.valid("json"),
          ),
        },
        201,
      ),
  )
  .post(
    "/:id/tasks/reorder",
    requirePermission(...PROJECT_WRITE_PERMS),
    zValidator("json", reorderTasksSchema),
    async (c) =>
      c.json({
        data: await projectsService.reorderTasks(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.param("id"),
          c.req.valid("json"),
        ),
      }),
  )
  .get("/:id/tasks/:taskId/detail", requirePermission(...PROJECT_READ_PERMS), notImplemented("Task detail requires Node comment/dependency joins"))
  .post("/:id/tasks/:taskId/comments", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Task comments require Node service"))
  .put(
    "/:id/tasks/:taskId",
    requirePermission(...PROJECT_WRITE_PERMS),
    zValidator("json", updateTaskSchema),
    async (c) =>
      c.json({
        data: await projectsService.updateTask(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.param("id"),
          c.req.param("taskId"),
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id/tasks/:taskId", requirePermission(...PROJECT_WRITE_PERMS), async (c) => {
    await projectsService.deleteTask(
      c.var.db,
      c.var.user!.id,
      c.var.user!.permissions,
      c.req.param("id"),
      c.req.param("taskId"),
    );
    return c.json({ data: { success: true } });
  })
  .put("/:id/tasks/:taskId/assignees", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Task assignees endpoint requires Node manageAssigneesSchema handler"))
  .get("/:id/tasks/:taskId/dependencies", requirePermission(...PROJECT_READ_PERMS), notImplemented("Task dependencies require Node service"))
  .post("/:id/tasks/:taskId/dependencies", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Task dependencies require Node service"))
  .delete("/:id/tasks/:taskId/dependencies/:dependencyId", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Task dependencies require Node service"))
  .get("/:id/resources", requirePermission(...PROJECT_READ_PERMS), notImplemented("Project resources require Node service"))
  .post("/:id/resources", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Project resources require Node service"))
  .put("/:id/resources/:resourceId", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Project resources require Node service"))
  .delete("/:id/resources/:resourceId", requirePermission(...PROJECT_WRITE_PERMS), notImplemented("Project resources require Node service"));
