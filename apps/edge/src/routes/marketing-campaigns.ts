import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PERMISSIONS } from "@nexora/contracts";
import {
  campaignQuerySchema,
  createCampaignSchema,
  updateCampaignSchema,
} from "@nexora/contracts/modules/marketing-campaigns/marketing-campaigns.validation";
import { marketingCampaignsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const leversQuery = z.object({ activeOnly: z.enum(["true", "false"]).optional() });
const stub = (c: { json: (b: unknown, s?: number) => Response }) =>
  c.json({ error: { code: "not_implemented", message: "Campaign analytics / creatives deferred" } }, 501);

export const marketingCampaigns = new Hono<AppEnv>()
  .get("/levers", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_VIEW), zValidator("query", leversQuery), async (c) => {
    const activeOnly = c.req.valid("query").activeOnly === "true";
    return c.json(await marketingCampaignsService.listLevers(c.var.db, activeOnly));
  })
  .get("/campaigns", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_VIEW), zValidator("query", campaignQuerySchema), async (c) =>
    c.json(await marketingCampaignsService.listCampaigns(c.var.db, c.req.valid("query"))),
  )
  .post(
    "/campaigns",
    requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_CREATE),
    zValidator("json", createCampaignSchema),
    async (c) =>
      c.json(await marketingCampaignsService.createCampaign(c.var.db, c.req.valid("json"), c.var.user!.id), 201),
  )
  .get("/campaigns/:id", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_VIEW), async (c) =>
    c.json(await marketingCampaignsService.getCampaignById(c.var.db, c.req.param("id"))),
  )
  .patch(
    "/campaigns/:id",
    requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_UPDATE),
    zValidator("json", updateCampaignSchema),
    async (c) =>
      c.json(await marketingCampaignsService.updateCampaign(c.var.db, c.req.param("id"), c.req.valid("json"))),
  )
  .delete("/campaigns/:id", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_DELETE), async (c) =>
    c.json(await marketingCampaignsService.archiveCampaign(c.var.db, c.req.param("id"))),
  )
  .get("/campaigns/:id/creatives", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_VIEW), stub)
  .post("/campaigns/:id/creatives", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_CREATE), stub)
  .post("/campaigns/:id/predictions", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_UPDATE), stub)
  .get("/campaigns/:id/attribution", requirePermission(PERMISSIONS.MARKETING_CAMPAIGN_VIEW), stub);
