import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  checklistTemplateQuerySchema,
  createChecklistTemplateSchema,
  toggleChecklistItemSchema,
  updateChecklistTemplateSchema,
} from "@nexora/contracts/modules/visa-checklist/visa-checklist.validation";
import { visaChecklistService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const visaChecklist = new Hono<AppEnv>()
  .use(requirePermission(PERMISSIONS.VISA_MANAGE))
  .get("/templates", zValidator("query", checklistTemplateQuerySchema), async (c) => {
    const data = await visaChecklistService.listTemplates(c.var.db, c.req.valid("query"));
    return c.json({ data });
  })
  .post("/templates", zValidator("json", createChecklistTemplateSchema), async (c) => {
    const data = await visaChecklistService.createTemplate(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/templates/:id", async (c) =>
    c.json({ data: await visaChecklistService.getTemplate(c.var.db, c.req.param("id")) }),
  )
  .put("/templates/:id", zValidator("json", updateChecklistTemplateSchema), async (c) => {
    const data = await visaChecklistService.updateTemplate(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/templates/:id", async (c) => {
    const data = await visaChecklistService.deactivateTemplate(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .get("/record/:visaRecordId", async (c) => {
    const data = await visaChecklistService.getChecklist(c.var.db, c.req.param("visaRecordId"));
    return c.json({ data });
  })
  .post(
    "/record/:visaRecordId/items/:itemId/toggle",
    zValidator("json", toggleChecklistItemSchema),
    async (c) => {
      const { completed } = c.req.valid("json");
      const data = await visaChecklistService.toggleItem(
        c.var.db,
        c.req.param("visaRecordId"),
        c.req.param("itemId"),
        completed,
        c.var.user!.id,
      );
      return c.json({ data });
    },
  );
