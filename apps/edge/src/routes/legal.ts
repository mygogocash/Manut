import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createLegalAttachmentSchema,
  createLegalDocumentSchema,
  createShareSchema,
  legalQuerySchema,
  updateLegalAttachmentSchema,
  updateLegalDocumentSchema,
  updateVisibilitySchema,
} from "@nexora/contracts/modules/legal/legal.validation";
import { legalService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const stub = (c: { json: (b: unknown, s?: number) => Response }) =>
  c.json({ error: { code: "not_implemented", message: "DocuSign / signing deferred on edge" } }, 501);

export const legal = new Hono<AppEnv>()
  .get("/docusign/status", requirePermission(PERMISSIONS.LEGAL_SIGN_DOCUSIGN_ADMIN, PERMISSIONS.LEGAL_SIGN_SEND), stub)
  .get("/docusign/consent-url", requirePermission(PERMISSIONS.LEGAL_SIGN_DOCUSIGN_ADMIN), stub)
  .get("/folders", requirePermission(PERMISSIONS.LEGAL_READ), async (c) =>
    c.json({ data: await legalService.folders(c.var.db) }),
  )
  .get("/shared", requirePermission(PERMISSIONS.LEGAL_VIEW_SHARED), stub)
  .get("/notification-settings", requirePermission(PERMISSIONS.LEGAL_READ), stub)
  .put("/notification-settings", requirePermission(PERMISSIONS.LEGAL_UPDATE), stub)
  .get("/", requirePermission(PERMISSIONS.LEGAL_READ), zValidator("query", legalQuerySchema), async (c) =>
    c.json(await legalService.list(c.var.db, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.LEGAL_CREATE), zValidator("json", createLegalDocumentSchema), async (c) =>
    c.json({ data: await legalService.create(c.var.db, c.req.valid("json"), c.var.user!.id) }, 201),
  )
  .get("/:id", requirePermission(PERMISSIONS.LEGAL_READ), async (c) =>
    c.json({ data: await legalService.getById(c.var.db, c.req.param("id")) }),
  )
  .put("/:id", requirePermission(PERMISSIONS.LEGAL_UPDATE), zValidator("json", updateLegalDocumentSchema), async (c) =>
    c.json({ data: await legalService.update(c.var.db, c.req.param("id"), c.req.valid("json")) }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.LEGAL_DELETE), async (c) =>
    c.json(
      await legalService.remove(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    ),
  )
  .post("/:id/signatures", requirePermission(PERMISSIONS.LEGAL_SIGN_SEND), stub)
  .get("/:id/signatures", requirePermission(PERMISSIONS.LEGAL_SIGN_VIEW), stub)
  .post(
    "/:id/attachments",
    requirePermission(PERMISSIONS.LEGAL_UPDATE),
    zValidator("json", createLegalAttachmentSchema),
    async (c) =>
      c.json(
        {
          data: await legalService.addAttachment(
            c.var.db,
            c.req.param("id"),
            c.req.valid("json"),
            c.var.user!.id,
          ),
        },
        201,
      ),
  )
  .put(
    "/:id/attachments/:attachmentId",
    requirePermission(PERMISSIONS.LEGAL_UPDATE),
    zValidator("json", updateLegalAttachmentSchema),
    async (c) =>
      c.json({
        data: await legalService.updateAttachment(
          c.var.db,
          c.req.param("id"),
          c.req.param("attachmentId"),
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id/attachments/:attachmentId", requirePermission(PERMISSIONS.LEGAL_UPDATE), async (c) =>
    c.json(
      await legalService.removeAttachment(c.var.db, c.req.param("id"), c.req.param("attachmentId")),
    ),
  )
  .post(
    "/:id/shares",
    requirePermission(PERMISSIONS.LEGAL_SHARE),
    zValidator("json", createShareSchema),
    async (c) =>
      c.json(
        {
          data: await legalService.addShare(
            c.var.db,
            c.req.param("id"),
            c.req.valid("json"),
            c.var.user!.id,
          ),
        },
        201,
      ),
  )
  .delete("/:id/shares/:shareId", requirePermission(PERMISSIONS.LEGAL_SHARE), async (c) =>
    c.json(await legalService.removeShare(c.var.db, c.req.param("id"), c.req.param("shareId"))),
  )
  .put(
    "/:id/visibility",
    requirePermission(PERMISSIONS.LEGAL_UPDATE),
    zValidator("json", updateVisibilitySchema),
    async (c) =>
      c.json({ data: await legalService.setVisibility(c.var.db, c.req.param("id"), c.req.valid("json")) }),
  );
