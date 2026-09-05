import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  bulkFieldUpdateOpportunitiesSchema,
  bulkUpdateOpportunitiesSchema,
  bulkUpdateStageConfigsSchema,
  closeLostSchema,
  createOpportunitySchema,
  forecastQuerySchema,
  listOpportunitiesSchema,
  moveBusinessUnitSchema,
  pipelineQuerySchema,
  reopenSchema,
  reorderOpportunityCardsSchema,
  updateOpportunitySchema,
} from "@nexora/contracts/modules/opportunities/opportunities.validation";
import { opportunitiesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const opportunities = new Hono<AppEnv>()
  .get(
    "/",
    requirePermission(PERMISSIONS.CRM_READ),
    zValidator("query", listOpportunitiesSchema),
    async (c) =>
      c.json(
        await opportunitiesService.list(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("query"),
        ),
      ),
  )
  .get(
    "/pipeline",
    requirePermission(PERMISSIONS.CRM_READ),
    zValidator("query", pipelineQuerySchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.pipeline(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("query"),
        ),
      }),
  )
  .get(
    "/forecast",
    requirePermission(PERMISSIONS.CRM_READ),
    zValidator("query", forecastQuerySchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.forecast(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("query").currency,
        ),
      }),
  )
  .get("/filter-options", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({
      data: await opportunitiesService.filterOptions(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .get("/dashboard", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({
      data: await opportunitiesService.dashboard(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.CRM_CREATE),
    zValidator("json", createOpportunitySchema),
    async (c) => {
      const data = await opportunitiesService.create(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("json"),
      );
      return c.json({ data }, 201);
    },
  )
  .get("/stage-config", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({ data: await opportunitiesService.listStageConfigs(c.var.db) }),
  )
  .put(
    "/stage-config",
    requirePermission(PERMISSIONS.CRM_ADMIN),
    zValidator("json", bulkUpdateStageConfigsSchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.bulkUpdateStageConfigs(
          c.var.db,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/reorder",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", reorderOpportunityCardsSchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.reorderCards(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/bulk-update",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", bulkFieldUpdateOpportunitiesSchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.bulkUpdateFields(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/bulk-business-units",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", bulkUpdateOpportunitiesSchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.bulkUpdateBusinessUnits(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .get("/:id", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({
      data: await opportunitiesService.getById(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", updateOpportunitySchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/:id/close-lost",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", closeLostSchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.closeLost(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/:id/reopen",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", reopenSchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.reopen(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post("/:id/archive", requirePermission(PERMISSIONS.CRM_UPDATE), async (c) =>
    c.json({
      data: await opportunitiesService.archive(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.CRM_UPDATE), async (c) =>
    c.json({
      data: await opportunitiesService.unarchive(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.CRM_DELETE), async (c) => {
    await opportunitiesService.remove(
      c.var.db,
      c.req.param("id"),
      c.var.user!.id,
      c.var.user!.permissions,
    );
    return c.json({ data: { success: true } });
  })
  .get("/:id/business-units", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({
      data: await opportunitiesService.businessUnitsForDeal(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .put(
    "/:id/business-units/:businessUnit",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", moveBusinessUnitSchema),
    async (c) =>
      c.json({
        data: await opportunitiesService.moveBusinessUnit(
          c.var.db,
          c.req.param("id"),
          c.req.param("businessUnit"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  );
