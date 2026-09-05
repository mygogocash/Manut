import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createInvestorStageSchema,
  reorderInvestorStagesSchema,
  updateInvestorStageSchema,
} from "@nexora/contracts/modules/investor-pipeline-stages/investor-pipeline-stages.validation";
import { investorPipelineStagesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const investorPipelineStages = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.INVESTORS_READ), async (c) => c.json({ data: await investorPipelineStagesService.list(c.var.db) }))
  .post("/", requirePermission(PERMISSIONS.INVESTORS_UPDATE), zValidator("json", createInvestorStageSchema), async (c) => {
    const data = await investorPipelineStagesService.create(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .put(
    "/reorder",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", reorderInvestorStagesSchema),
    async (c) => c.json({ data: await investorPipelineStagesService.reorder(c.var.db, c.req.valid("json")) }),
  )
  .put(
    "/:key",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", updateInvestorStageSchema),
    async (c) => c.json({ data: await investorPipelineStagesService.update(c.var.db, c.req.param("key"), c.req.valid("json")) }),
  )
  .delete("/:key", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({ data: await investorPipelineStagesService.remove(c.var.db, c.req.param("key")) }),
  );
