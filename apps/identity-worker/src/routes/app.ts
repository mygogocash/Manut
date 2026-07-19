import { Hono } from "hono";
import { z } from "zod";

import { createBetterAuthStubPort } from "../adapters/better-auth-stub";
import {
  ASSURANCE_POLICY_VERSION,
  BETTER_AUTH_PINNED_VERSION,
  BLOCKED_PASSWORD_ROUTES,
  BLOCKED_STOCK_PHONE_ROUTES,
  PINNED_BETTER_AUTH_CONFIG,
  PUBLIC_IDENTITY_ROUTE_INVENTORY,
} from "../better-auth-config";
import { IdentityHttpError, resolveIdentityDbMode } from "../fail-closed";
import type { IdentityBindings } from "../runtime";

type AppEnv = { Bindings: IdentityBindings };

const signInBodySchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(3).optional(),
  returnPath: z.string().max(512).optional(),
});

export function createIdentityApp() {
  const app = new Hono<AppEnv>();

  app.onError((error, c) => {
    if (error instanceof IdentityHttpError) {
      const status = error.status as 400 | 404 | 503;
      return c.json(error.toJSON(), status);
    }
    if (error instanceof z.ZodError) {
      return c.json(
        {
          code: "IDENTITY_VALIDATION_ERROR",
          message: "Invalid identity request.",
        },
        400,
      );
    }
    return c.json(
      {
        code: "IDENTITY_INTERNAL_ERROR",
        message: "Unexpected identity worker error.",
      },
      500,
    );
  });

  app.get("/health", (c) => {
    const dbMode = resolveIdentityDbMode(c.env);
    return c.json({
      ok: dbMode === "ready",
      service: "manut-identity-spike",
      spike: true,
      productionAuthCutover: false,
      identityDb: dbMode,
      betterAuthPinnedVersion:
        c.env.BETTER_AUTH_PINNED_VERSION ?? BETTER_AUTH_PINNED_VERSION,
    });
  });

  app.get("/api/identity/spike/config", (c) => {
    return c.json({
      pinnedVersion: BETTER_AUTH_PINNED_VERSION,
      assurancePolicyVersion: ASSURANCE_POLICY_VERSION,
      config: PINNED_BETTER_AUTH_CONFIG,
      publicRoutes: PUBLIC_IDENTITY_ROUTE_INVENTORY,
      blockedStockPhoneRoutes: BLOCKED_STOCK_PHONE_ROUTES,
      blockedPasswordRoutes: BLOCKED_PASSWORD_ROUTES,
      identityDb: resolveIdentityDbMode(c.env),
      productionAuthCutover: false,
    });
  });

  // Block stock Better Auth phone routes on every method.
  for (const path of BLOCKED_STOCK_PHONE_ROUTES) {
    app.all(path, (c) =>
      c.json(
        {
          code: "IDENTITY_STOCK_PHONE_ROUTE_BLOCKED",
          message:
            "Stock phone OTP routes are blocked. Use the private challenge wrapper via public Identity endpoints.",
        },
        404,
      ),
    );
  }

  for (const path of BLOCKED_PASSWORD_ROUTES) {
    app.all(path, (c) =>
      c.json(
        {
          code: "IDENTITY_PASSWORD_ROUTES_DISABLED",
          message:
            "Password routes are disabled. Target identity is passwordless (magic link / private phone OTP).",
        },
        404,
      ),
    );
  }

  app.post("/api/identity/sign-in/magic-link", async (c) => {
    const body = signInBodySchema.parse(await c.req.json());
    if (!body.email) {
      throw new IdentityHttpError(
        400,
        "IDENTITY_VALIDATION_ERROR",
        "email is required for magic-link sign-in.",
      );
    }
    const port = createBetterAuthStubPort(c.env);
    const challenge = await port.requestCustomerSignIn({
      method: "magic_link",
      email: body.email,
      returnPath: body.returnPath,
    });
    return c.json(challenge);
  });

  app.post("/api/identity/sign-in/phone", async (c) => {
    const body = signInBodySchema.parse(await c.req.json());
    if (!body.phone) {
      throw new IdentityHttpError(
        400,
        "IDENTITY_VALIDATION_ERROR",
        "phone is required for phone OTP sign-in.",
      );
    }
    const port = createBetterAuthStubPort(c.env);
    const challenge = await port.requestCustomerSignIn({
      method: "phone_otp",
      phone: body.phone,
    });
    return c.json(challenge);
  });

  // Consume / verify remain fail-closed until D1 + Better Auth adapter are real.
  app.post("/api/identity/magic-link/consume", async (c) => {
    const port = createBetterAuthStubPort(c.env);
    await port.consumeEmailMagicLink({ token: "unused" });
    return c.json({ ok: true });
  });

  app.post("/api/identity/phone/verify", async (c) => {
    const port = createBetterAuthStubPort(c.env);
    await port.verifyPhoneOtp({ challengeId: "unused", code: "000000" });
    return c.json({ ok: true });
  });

  return app;
}
