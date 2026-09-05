import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createMarketingCampaignSchema,
  marketingCampaignQuerySchema,
  updateMarketingCampaignSchema,
} from "@nexora/contracts/modules/marketing/marketing.validation";
import { marketingService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const marketing = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_VIEW), zValidator("query", marketingCampaignQuerySchema), async (c) =>
    c.json(await marketingService.list(c.var.db, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_CREATE), zValidator("json", createMarketingCampaignSchema), async (c) => {
    const data = await marketingService.create(c.var.db, c.req.valid("json"), c.var.user!.id);
    return c.json({ data }, 201);
  })
  .get("/:id", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_VIEW), async (c) =>
    c.json({ data: await marketingService.getById(c.var.db, c.req.param("id")) }),
  )
  .put("/:id", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_UPDATE), zValidator("json", updateMarketingCampaignSchema), async (c) =>
    c.json({ data: await marketingService.update(c.var.db, c.req.param("id"), c.req.valid("json")) }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_DELETE), async (c) => {
    await marketingService.remove(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
