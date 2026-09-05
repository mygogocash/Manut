import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { trackDocumentViewedServer } from "@/lib/events";
import { legalService } from "@/modules/legal/legal.service";
import {
  createLegalAttachmentSchema,
  createLegalDocumentSchema,
  createShareSchema,
  legalQuerySchema,
  sendForSignatureSchema,
  sharedQuerySchema,
  updateLegalAttachmentSchema,
  updateLegalDocumentSchema,
  updateLegalNotificationSettingsSchema,
  updateVisibilitySchema,
} from "@/modules/legal/legal.validation";

const router = Router();

router.use(authenticate, requireActive);

// ── DocuSign admin endpoints — literal paths, gated on admin perm ──

router.get(
  "/docusign/status",
  requirePermission(
    PERMISSIONS.LEGAL_SIGN_DOCUSIGN_ADMIN,
    PERMISSIONS.LEGAL_SIGN_SEND,
  ),
  asyncHandler(async (_req, res) => {
    const result = await legalService.getDocusignStatus();
    res.json(result);
  }),
);

router.get(
  "/docusign/consent-url",
  requirePermission(PERMISSIONS.LEGAL_SIGN_DOCUSIGN_ADMIN),
  asyncHandler(async (_req, res) => {
    const result = legalService.buildDocusignConsentUrl();
    res.json(result);
  }),
);

// ── Phase 2 signing routes — literal paths must come before "/:id" ──

router.post(
  "/:id/signatures",
  requirePermission(PERMISSIONS.LEGAL_SIGN_SEND),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = sendForSignatureSchema.parse(req.body);
    const result = await legalService.sendForSignature(id, input, req.user!.id);
    res.status(201).json(result);
  }),
);

router.get(
  "/:id/signatures",
  requirePermission(PERMISSIONS.LEGAL_SIGN_VIEW, PERMISSIONS.LEGAL_SIGN_SEND),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await legalService.listSignatures(id);
    res.json(result);
  }),
);

router.delete(
  "/signatures/:signatureId",
  requirePermission(PERMISSIONS.LEGAL_SIGN_SEND),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "signatureId");
    const result = await legalService.cancelSignature(id);
    res.json(result);
  }),
);

router.get(
  "/",
  requirePermission(PERMISSIONS.LEGAL_READ),
  asyncHandler(async (req, res) => {
    const query = legalQuerySchema.parse(req.query);
    const result = await legalService.list(query);
    res.json(result);
  }),
);

// Literal route — must come before "/:id".
router.get(
  "/stats",
  requirePermission(PERMISSIONS.LEGAL_READ),
  asyncHandler(async (_req, res) => {
    const result = await legalService.stats();
    res.json(result);
  }),
);

router.get(
  "/folders",
  requirePermission(PERMISSIONS.LEGAL_READ),
  asyncHandler(async (_req, res) => {
    const result = await legalService.listFolders();
    res.json(result);
  }),
);

// Notification settings — singleton. Read for any legal reader; edit gated
// on legal:update (admin + legal team). Literal route before "/:id".
router.get(
  "/settings",
  requirePermission(PERMISSIONS.LEGAL_READ),
  asyncHandler(async (_req, res) => {
    const result = await legalService.getNotificationSettings();
    res.json(result);
  }),
);

router.put(
  "/settings",
  requirePermission(PERMISSIONS.LEGAL_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateLegalNotificationSettingsSchema.parse(req.body);
    const result = await legalService.updateNotificationSettings(input);
    res.json(result);
  }),
);

// Departments + active groups for the share dialog. Kept on the legal
// side so the share UI doesn't depend on `directory:read` / `admin:read`.
router.get(
  "/share-options",
  requirePermission(PERMISSIONS.LEGAL_SHARE),
  asyncHandler(async (_req, res) => {
    const result = await legalService.listShareOptions();
    res.json(result);
  }),
);

// ── Shared-with-me routes — gated on legal:view-shared, must come
// before "/:id" so "/shared-with-me" doesn't get eaten as an id ──

router.get(
  "/shared-with-me",
  requirePermission(PERMISSIONS.LEGAL_VIEW_SHARED),
  asyncHandler(async (req, res) => {
    const query = sharedQuerySchema.parse(req.query);
    const result = await legalService.listSharedWithMe(req.user!.id, query);
    res.json(result);
  }),
);

router.get(
  "/shared-with-me/:id",
  requirePermission(PERMISSIONS.LEGAL_VIEW_SHARED),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await legalService.getByIdForRecipient(id, req.user!.id);
    res.json(result);
  }),
);

router.get(
  "/shared-with-me/:id/download",
  requirePermission(PERMISSIONS.LEGAL_VIEW_SHARED),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await legalService.getDownloadUrlForRecipient(
      id,
      req.user!.id,
    );
    res.json(result);
  }),
);

// Literal segment — must come before "/:id". Mints a short-lived
// signed URL because the `documents` Supabase bucket is private.
router.get(
  "/:id/download",
  requirePermission(PERMISSIONS.LEGAL_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await legalService.getDownloadUrl(id);
    res.json(result);
  }),
);

// ── Attachments — supporting docs grouped under a parent agreement ──

router.post(
  "/:id/attachments",
  requirePermission(PERMISSIONS.LEGAL_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createLegalAttachmentSchema.parse(req.body);
    const result = await legalService.addAttachment(id, input, req.user!.id);
    res.status(201).json(result);
  }),
);

router.put(
  "/:id/attachments/:attachmentId",
  requirePermission(PERMISSIONS.LEGAL_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const attachmentId = getRequiredParam(req.params, "attachmentId");
    const input = updateLegalAttachmentSchema.parse(req.body);
    const result = await legalService.updateAttachment(id, attachmentId, input);
    res.json(result);
  }),
);

router.delete(
  "/:id/attachments/:attachmentId",
  requirePermission(PERMISSIONS.LEGAL_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const attachmentId = getRequiredParam(req.params, "attachmentId");
    const result = await legalService.removeAttachment(id, attachmentId);
    res.json(result);
  }),
);

router.get(
  "/:id/attachments/:attachmentId/download",
  requirePermission(PERMISSIONS.LEGAL_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const attachmentId = getRequiredParam(req.params, "attachmentId");
    const result = await legalService.getAttachmentDownloadUrl(
      id,
      attachmentId,
    );
    res.json(result);
  }),
);

// ── Sharing — gated on legal:share ──────────────────────────────────────

router.put(
  "/:id/visibility",
  requirePermission(PERMISSIONS.LEGAL_SHARE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateVisibilitySchema.parse(req.body);
    const result = await legalService.setVisibility(id, input);
    res.json(result);
  }),
);

router.get(
  "/:id/shares",
  requirePermission(PERMISSIONS.LEGAL_SHARE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await legalService.listShares(id);
    res.json(result);
  }),
);

router.post(
  "/:id/shares",
  requirePermission(PERMISSIONS.LEGAL_SHARE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createShareSchema.parse(req.body);
    const result = await legalService.addShare(id, input, req.user!.id);
    res.status(201).json(result);
  }),
);

router.delete(
  "/:id/shares/:shareId",
  requirePermission(PERMISSIONS.LEGAL_SHARE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const shareId = getRequiredParam(req.params, "shareId");
    const result = await legalService.removeShare(id, shareId);
    res.json(result);
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.LEGAL_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await legalService.getById(id);
    res.json(result);
    try {
      if (req.user) {
        trackDocumentViewedServer(
          { id: req.user.id, entityId: req.user.entityId },
          { document_id: id, document_kind: "legal" },
        );
      }
    } catch {
      // analytics is best-effort
    }
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.LEGAL_CREATE),
  asyncHandler(async (req, res) => {
    const input = createLegalDocumentSchema.parse(req.body);
    const result = await legalService.create(input);
    res.status(201).json(result);
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.LEGAL_UPDATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateLegalDocumentSchema.parse(req.body);
    const result = await legalService.update(id, input);
    res.json(result);
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.LEGAL_DELETE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await legalService.remove(id);
    res.json(result);
  }),
);

export default router;
