import type { CookieOptions, Response } from "express";
import { Router } from "express";

import { logger } from "@/common/utils/logger";
import {
  authenticate,
  requireActive,
  resolveAuthUserFromToken,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { supabaseAdmin } from "@/infrastructure/supabase/admin";
import { authService } from "@/modules/auth/auth.service";
import {
  authEmailRequestSchema,
  changePasswordSchema,
  exchangeSessionSchema,
  loginSchema,
  recoverPasswordSchema,
  updateMyProfileSchema,
} from "@/modules/auth/auth.validation";

const IS_PROD = process.env.NODE_ENV === "production";

function setAuthCookies(
  res: Response,
  session: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  },
) {
  const cookieBase: CookieOptions = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
    path: "/",
  };

  res.cookie("manut_access_token", session.accessToken, {
    ...cookieBase,
    maxAge: session.expiresIn * 1000,
  });

  res.cookie("manut_refresh_token", session.refreshToken, {
    ...cookieBase,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response) {
  const cookieBase: CookieOptions = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
    path: "/",
  };
  res.clearCookie("manut_access_token", cookieBase);
  res.clearCookie("manut_refresh_token", cookieBase);
}

function requestIp(req: { ip?: string; socket?: { remoteAddress?: string } }) {
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

function sendAuthenticatedPayload(
  res: Response,
  result: Awaited<ReturnType<typeof authService.login>>,
) {
  setAuthCookies(res, result.session);
  const { session: _session, ...payload } = result;
  res.json(payload);
}

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    logger.info(`User logged in: ${input.email}`);

    sendAuthenticatedPayload(res, result);
  }),
);

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const input = authEmailRequestSchema.parse(req.body);
    await authService.requestPasswordReset(input, { ip: requestIp(req) });
    res.json({
      success: true,
      message:
        "If this email belongs to an active Intranet account, a reset link will be sent shortly.",
    });
  }),
);

router.post(
  "/magic-link",
  asyncHandler(async (req, res) => {
    const input = authEmailRequestSchema.parse(req.body);
    await authService.requestMagicLink(input, { ip: requestIp(req) });
    res.json({
      success: true,
      message:
        "If this email belongs to an active Intranet account, a sign-in link will be sent shortly.",
    });
  }),
);

router.post(
  "/recover-password",
  asyncHandler(async (req, res) => {
    const input = recoverPasswordSchema.parse(req.body);
    const result = await authService.recoverPassword(input, {
      ip: requestIp(req),
    });
    sendAuthenticatedPayload(res, result);
  }),
);

router.post(
  "/exchange-session",
  asyncHandler(async (req, res) => {
    const input = exchangeSessionSchema.parse(req.body);
    const result = await authService.exchangeSession(input, {
      ip: requestIp(req),
    });
    sendAuthenticatedPayload(res, result);
  }),
);

router.post("/logout", (_req, res) => {
  logger.info("User logged out");
  clearAuthCookies(res);
  res.json({ success: true });
});

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.manut_refresh_token;
    if (!refreshToken) {
      res.status(401).json({
        error: { code: "NO_REFRESH_TOKEN", message: "No refresh token" },
      });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      clearAuthCookies(res);
      res.status(401).json({
        error: { code: "REFRESH_FAILED", message: "Session expired" },
      });
      return;
    }

    try {
      await resolveAuthUserFromToken(data.session.access_token);
    } catch (err) {
      clearAuthCookies(res);
      throw err;
    }

    setAuthCookies(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    });

    res.json({ success: true });
  }),
);

router.get(
  "/me",
  authenticate,
  requireActive,
  asyncHandler(async (req, res) => {
    const result = await authService.getMe(req.user!.id);
    res.json(result);
  }),
);

router.get(
  "/me/profile",
  authenticate,
  requireActive,
  asyncHandler(async (req, res) => {
    const result = await authService.getMyProfile(req.user!.id);
    res.json({ data: result });
  }),
);

router.patch(
  "/me/profile",
  authenticate,
  requireActive,
  asyncHandler(async (req, res) => {
    const input = updateMyProfileSchema.parse(req.body);
    const result = await authService.updateMyProfile(req.user!.id, input);
    res.json({ data: result });
  }),
);

router.post(
  "/change-password",
  authenticate,
  asyncHandler(async (req, res) => {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    clearAuthCookies(res);
    res.json({ success: true });
  }),
);

export default router;
