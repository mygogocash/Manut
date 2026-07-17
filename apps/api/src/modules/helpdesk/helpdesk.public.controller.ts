/**
 * Unauthenticated GitHub webhook receiver for the IT Helpdesk ↔
 * GitHub Issues sync. Mounted under `/api/helpdesk-public` (no
 * session middleware) so GitHub can call it directly. The HMAC
 * signature shared secret stands in for auth — see
 * `verifyGithubSignature` in the sync service.
 */
import { type Request, Router } from "express";

import { logger } from "@/common/utils/logger";
import { asyncHandler } from "@/core/middleware/async-handler";
import {
  getGithubWebhookSecret,
  handleGithubWebhookEvent,
  verifyGithubSignature,
} from "@/modules/helpdesk/helpdesk-github-sync.service";

const router = Router();

// GitHub signs the literal request bytes; we capture them in `app.ts`
// via `express.json({ verify })` before the parser consumes the
// stream. Route-level `express.raw` would be too late because the
// global `express.json` already ran. `req.rawBody` is the canonical
// signature input.
router.post(
  "/github/webhook",
  asyncHandler(async (req, res) => {
    const rawBuf = (req as Request & { rawBody?: Buffer }).rawBody;
    const raw = rawBuf instanceof Buffer ? rawBuf.toString("utf8") : "";
    const sig =
      req.get("x-hub-signature-256") ?? req.get("X-Hub-Signature-256") ?? "";
    const event = req.get("x-github-event") ?? req.get("X-GitHub-Event") ?? "";

    const secret = await getGithubWebhookSecret();
    if (!secret) {
      res
        .status(503)
        .json({ error: { message: "GitHub webhook not configured" } });
      return;
    }

    if (!verifyGithubSignature(raw, sig, secret)) {
      res.status(401).json({ error: { message: "Invalid signature" } });
      return;
    }

    if (!event) {
      res.status(400).json({ error: { message: "Missing event header" } });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw || "{}");
    } catch {
      res.status(400).json({ error: { message: "Invalid JSON payload" } });
      return;
    }

    const result = await handleGithubWebhookEvent(event, payload);
    logger.info("helpdesk github webhook processed", {
      event,
      matched: result.matched,
    });
    res.json({ ok: true, ...result });
  }),
);

export default router;
