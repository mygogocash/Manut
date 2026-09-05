import express, { type Request, Router } from "express";

import { logger } from "@/common/utils/logger";
import { getRequiredParam } from "@/common/utils/params";
import { asyncHandler } from "@/core/middleware/async-handler";
import { docusignService } from "@/modules/legal/legal.docusign.service";
import { legalService } from "@/modules/legal/legal.service";
import {
  declineSignatureSchema,
  submitSignatureSchema,
} from "@/modules/legal/legal.validation";

// Token-authenticated public router — NO `authenticate` middleware. The
// random token in the URL IS the auth; routes here are mounted at
// /api/legal-public/* so they sit outside the dashboard auth gate.
const router = Router();

function clientIp(req: Request): string | null {
  // Cloud Run sits behind a Google front-end proxy; with `trust proxy`
  // set to a small hop count, Express resolves the client IP from X-Forwarded-For.
  return req.ip ?? null;
}

router.get(
  "/sign/:token",
  asyncHandler(async (req, res) => {
    const token = getRequiredParam(req.params, "token");
    const result = await legalService.getByToken(token);
    // Mark first-view asynchronously — don't block the response.
    void legalService.markViewed(token).catch(() => {});
    res.json(result);
  }),
);

router.post(
  "/sign/:token",
  asyncHandler(async (req, res) => {
    const token = getRequiredParam(req.params, "token");
    const input = submitSignatureSchema.parse(req.body);
    const result = await legalService.submitSignature(
      token,
      input,
      clientIp(req),
      req.get("user-agent") ?? null,
    );
    res.json(result);
  }),
);

router.post(
  "/sign/:token/decline",
  asyncHandler(async (req, res) => {
    const token = getRequiredParam(req.params, "token");
    const input = declineSignatureSchema.parse(req.body);
    const result = await legalService.declineSignature(
      token,
      input,
      clientIp(req),
      req.get("user-agent") ?? null,
    );
    res.json(result);
  }),
);

// ── DocuSign Connect webhook ────────────────────────────────────────────
// Mounted with the JSON parser disabled so we can verify HMAC against
// the raw bytes (the parsed object would lose key ordering / whitespace
// and break the signature comparison).
router.post(
  "/docusign/webhook",
  express.raw({ type: "*/*", limit: "5mb" }),
  asyncHandler(async (req, res) => {
    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : "";
    const sigHeader =
      req.get("x-docusign-signature-1") ??
      req.get("X-DocuSign-Signature-1") ??
      null;
    docusignService.verifyWebhookSignature(raw, sigHeader);

    interface EnvelopeSummaryShape {
      envelopeId?: string;
      status?: string;
      completedDateTime?: string | null;
      declinedDateTime?: string | null;
      voidedDateTime?: string | null;
      voidedReason?: string | null;
      recipients?: {
        signers?: Array<{
          email?: string;
          status?: string;
          signedDateTime?: string | null;
          declinedDateTime?: string | null;
        }>;
      };
    }
    interface WebhookPayload extends EnvelopeSummaryShape {
      data?: { envelopeId?: string; envelopeSummary?: EnvelopeSummaryShape };
    }
    let parsed: WebhookPayload;
    try {
      parsed = JSON.parse(raw || "{}") as WebhookPayload;
    } catch {
      res.status(400).json({ error: { message: "Invalid JSON payload" } });
      return;
    }

    const summary = parsed.data?.envelopeSummary ?? parsed;
    const envelopeId =
      parsed.data?.envelopeId ?? summary.envelopeId ?? parsed.envelopeId;
    const status = summary.status ?? parsed.status;
    if (!envelopeId || !status) {
      res
        .status(400)
        .json({ error: { message: "Missing envelopeId or status" } });
      return;
    }

    // Multi-signer support — DocuSign sends per-recipient updates
    // under recipients.signers[]. Fan out one call per signer so
    // per-recipient state lands on the correct LegalSignature row.
    const recipients = summary.recipients?.signers ?? [];
    if (recipients.length > 0) {
      for (const rec of recipients) {
        if (!rec.email) continue;
        await legalService.handleDocusignWebhookEvent({
          envelopeId,
          status,
          completedDateTime:
            rec.signedDateTime ?? summary.completedDateTime ?? null,
          declinedDateTime:
            rec.declinedDateTime ?? summary.declinedDateTime ?? null,
          voidedDateTime: summary.voidedDateTime ?? null,
          voidedReason: summary.voidedReason ?? null,
          recipientEmail: rec.email,
          recipientStatus: rec.status ?? null,
        });
      }
    } else {
      await legalService.handleDocusignWebhookEvent({
        envelopeId,
        status,
        completedDateTime: summary.completedDateTime ?? null,
        declinedDateTime: summary.declinedDateTime ?? null,
        voidedDateTime: summary.voidedDateTime ?? null,
        voidedReason: summary.voidedReason ?? null,
      });
    }
    logger.info("docusign webhook processed", {
      envelopeId,
      status,
      recipients: recipients.length,
    });
    res.json({ data: { received: true } });
  }),
);

export default router;
