import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  benefitImportSchema,
  createBenefitSchema,
  enrollSchema,
  listBenefitsSchema,
  updateBenefitSchema,
} from "@nexora/contracts/modules/benefits/benefits.validation";
import { benefitsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const benefits = new Hono<AppEnv>()
  .get(
    "/my-enrollments",
    requirePermission(PERMISSIONS.BENEFITS_READ, PERMISSIONS.BENEFITS_ENROLL, PERMISSIONS.BENEFITS_MANAGE),
    async (c) => c.json({ data: await benefitsService.getMyEnrollments(c.var.db, c.var.user!.id) }),
  )
  .get("/", requirePermission(PERMISSIONS.BENEFITS_READ), zValidator("query", listBenefitsSchema), async (c) => {
    return c.json(await benefitsService.list(c.var.db, c.req.valid("query")));
  })
  .post("/", requirePermission(PERMISSIONS.BENEFITS_MANAGE), zValidator("json", createBenefitSchema), async (c) => {
    const data = await benefitsService.create(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .post("/import/preview", requirePermission(PERMISSIONS.BENEFITS_MANAGE), zValidator("json", benefitImportSchema), async (c) => {
    const { rows } = c.req.valid("json");
    return c.json({ data: await benefitsService.previewBenefitImport(c.var.db, rows) });
  })
  .post("/import/commit", requirePermission(PERMISSIONS.BENEFITS_MANAGE), zValidator("json", benefitImportSchema), async (c) => {
    const { rows } = c.req.valid("json");
    return c.json({ data: await benefitsService.commitBenefitImport(c.var.db, rows) });
  })
  .get(
    "/:id",
    requirePermission(PERMISSIONS.BENEFITS_READ, PERMISSIONS.BENEFITS_ENROLL, PERMISSIONS.BENEFITS_MANAGE),
    async (c) => c.json({ data: await benefitsService.getById(c.var.db, c.req.param("id")) }),
  )
  .put("/:id", requirePermission(PERMISSIONS.BENEFITS_MANAGE), zValidator("json", updateBenefitSchema), async (c) => {
    const data = await benefitsService.update(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/:id", requirePermission(PERMISSIONS.BENEFITS_MANAGE), async (c) => {
    await benefitsService.remove(c.var.db, c.req.param("id"));
    return c.body(null, 204);
  })
  .post("/enroll", requirePermission(PERMISSIONS.BENEFITS_ENROLL), zValidator("json", enrollSchema), async (c) => {
    const data = await benefitsService.enroll(c.var.db, c.req.valid("json"), c.var.user!.id);
    return c.json({ data }, 201);
  })
  .put("/enrollments/:id/unenroll", requirePermission(PERMISSIONS.BENEFITS_MANAGE), async (c) => {
    const data = await benefitsService.unenroll(c.var.db, c.req.param("id"));
    return c.json({ data });
  });
