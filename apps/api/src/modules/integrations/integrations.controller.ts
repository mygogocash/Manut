import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { logger } from "@/common/utils/logger";
import { authenticate, requirePermission } from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { getPortalUrl } from "@/lib/portal-url";
import { integrationsService } from "@/modules/integrations/integrations.service";
import {
  driveListSchema,
  gmailListSchema,
  gmailModifySchema,
  gmailReadSchema,
  gmailSendSchema,
  gmailTrashSchema,
  oauthCallbackSchema,
  oauthStartSchema,
} from "@/modules/integrations/integrations.validation";

const router = Router();

/** Append (or merge) a query param onto a path or full URL. */
function withQuery(target: string, key: string, value: string): string {
  const sep = target.includes("?") ? "&" : "?";
  return `${target}${sep}${key}=${encodeURIComponent(value)}`;
}

router.get(
  "/status",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const data = await integrationsService.getStatus(req.user!.id);
    res.json({ data });
  }),
);

router.get(
  "/google/oauth-start",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const input = oauthStartSchema.parse(req.query);
    const result = await integrationsService.startOauth({
      userId: req.user!.id,
      redirect: input.redirect,
    });
    res.json({ data: result });
  }),
);

// Auth-less but state-verified by service. Google sends the user here after consent.
router.get("/google/oauth-callback", async (req, res) => {
  // Resolve the portal URL at request time so test env stubs (set in
  // `beforeEach`) and any runtime env mutation are honoured. The eager
  // module-level const captured the prod fallback before tests could
  // set NEXT_PUBLIC_APP_URL → http://localhost:3000.
  const base = getPortalUrl();
  const settingsPath = "/settings?tab=integrations";

  let parsed: ReturnType<typeof oauthCallbackSchema.parse>;
  try {
    parsed = oauthCallbackSchema.parse(req.query);
  } catch {
    return res.redirect(
      303,
      `${base}${withQuery(settingsPath, "error", "invalid_request")}`,
    );
  }

  if (parsed.error) {
    return res.redirect(
      303,
      `${base}${withQuery(settingsPath, "error", parsed.error)}`,
    );
  }

  try {
    const result = await integrationsService.completeOauth({
      code: parsed.code,
      state: parsed.state,
    });
    const target = result.redirect ?? settingsPath;
    return res.redirect(303, `${base}${withQuery(target, "connected", "1")}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    logger.error("oauth-callback completeOauth failed", {
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    const code = message.includes("INVALID_OR_EXPIRED_STATE")
      ? "invalid_state"
      : "oauth_failed";
    return res.redirect(
      303,
      `${base}${withQuery(settingsPath, "error", code)}`,
    );
  }
});

router.delete(
  "/google",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const result = await integrationsService.disconnect({
      userId: req.user!.id,
    });
    res.json({ data: result });
  }),
);

router.post(
  "/gmail/list",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const input = gmailListSchema.parse(req.body);
    const result = await integrationsService.listGmail(req.user!.id, {
      folder: input.folder,
      labelId: input.labelId,
      pageSize: input.pageSize,
      pageToken: input.pageToken,
    });
    res.json(result);
  }),
);

router.get(
  "/gmail/labels",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const result = await integrationsService.listGmailLabels(req.user!.id);
    res.json({ data: result });
  }),
);

router.post(
  "/gmail/modify",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const input = gmailModifySchema.parse(req.body);
    const result = await integrationsService.modifyGmail(
      req.user!.id,
      input.messageId,
      {
        addLabelIds: input.addLabelIds,
        removeLabelIds: input.removeLabelIds,
      },
    );
    res.json({ data: result });
  }),
);

router.post(
  "/gmail/trash",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const input = gmailTrashSchema.parse(req.body);
    const result = await integrationsService.trashGmail(
      req.user!.id,
      input.messageId,
    );
    res.json({ data: result });
  }),
);

router.post(
  "/gmail/untrash",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const input = gmailTrashSchema.parse(req.body);
    const result = await integrationsService.untrashGmail(
      req.user!.id,
      input.messageId,
    );
    res.json({ data: result });
  }),
);

// Diagnostic — calls Google Gmail + Drive APIs directly with the user's
// stored access token (no MCP). Reveals whether 403s are MCP-specific or
// token/scope/policy-wide. Remove after debugging.
router.get(
  "/google/probe",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const { googleTokenRepository } =
      await import("@/modules/integrations/google-token.repository");
    const { accessToken } = await googleTokenRepository.getValid(req.user!.id);

    const probe = async (label: string, url: string) => {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await r.text();
      return { label, status: r.status, body: body.slice(0, 500) };
    };

    const results = await Promise.all([
      probe(
        "tokeninfo",
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      ),
      probe(
        "gmail.users.getProfile",
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      ),
      probe(
        "gmail.users.messages.list",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1",
      ),
      probe(
        "drive.about.get",
        "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)",
      ),
    ]);

    res.json({ data: results });
  }),
);

router.post(
  "/gmail/read",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const input = gmailReadSchema.parse(req.body);
    const result = await integrationsService.readGmail(
      req.user!.id,
      input.messageId,
    );
    res.json({ data: result });
  }),
);

router.post(
  "/gmail/send",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const input = gmailSendSchema.parse(req.body);
    // zod's `.parse` guarantees each attachment carries every required
    // field, but `z.infer` on an array nested inside an optional field
    // sometimes widens fields to optional under stricter tsc settings
    // (CI is stricter than local cache). Narrow at the call site —
    // the data has already been validated.
    const attachments = input.attachments?.map((a) => ({
      filename: a.filename!,
      mimeType: a.mimeType!,
      contentBase64: a.contentBase64!,
    }));
    const result = await integrationsService.sendGmail(req.user!.id, {
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      body: input.body,
      bodyHtml: input.bodyHtml,
      inReplyTo: input.inReplyTo,
      references: input.references,
      threadId: input.threadId,
      attachments,
    });
    res.json({ data: result });
  }),
);

router.post(
  "/drive/list",
  authenticate,
  requirePermission(PERMISSIONS.INTEGRATIONS_USE),
  asyncHandler(async (req, res) => {
    const input = driveListSchema.parse(req.body);
    const result = await integrationsService.listDrive(
      req.user!.id,
      input.query,
      input.pageSize,
      input.pageToken,
    );
    res.json(result);
  }),
);

export default router;
