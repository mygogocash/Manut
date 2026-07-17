import { type Request, Router } from "express";

import { logger } from "@/common/utils/logger";
import { getRequiredParam } from "@/common/utils/params";
import { asyncHandler } from "@/core/middleware/async-handler";
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
  // The edge gateway forwards the client address through the trusted proxy
  // chain configured by the compatibility API runtime.
  return req.ip ?? null;
}

router.get(
  "/sign/:token",
  asyncHandler(async (req, res) => {
    const token = getRequiredParam(req.params, "token");
    const result = await legalService.getByToken(token);
    // Mark first-view asynchronously — don't block the response.
    void legalService.markViewed(token).catch((err) => {
      logger.warn("legal signing view audit update failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
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

export default router;
