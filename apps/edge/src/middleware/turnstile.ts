import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../lib/context";
import { BadRequestException, ForbiddenException } from "../lib/errors";

/**
 * Verifies Cloudflare Turnstile when TURNSTILE_SECRET is set.
 * Token may arrive as `cf-turnstile-response` form field or `x-turnstile-token` header.
 * No-op when the secret is unset (local/dev).
 */
export const requireTurnstile = createMiddleware<AppEnv>(async (c, next) => {
  const secret = c.env.TURNSTILE_SECRET;
  if (!secret) {
    await next();
    return;
  }

  let token = c.req.header("x-turnstile-token") ?? "";
  if (!token) {
    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await c.req.raw.clone().json().catch(() => null)) as { turnstileToken?: string } | null;
      token = body?.turnstileToken ?? "";
    } else if (contentType.includes("form")) {
      const form = await c.req.raw.clone().formData().catch(() => null);
      token = String(form?.get("cf-turnstile-response") ?? "");
    }
  }
  if (!token) throw new BadRequestException("Turnstile token required");

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const ip = c.req.header("cf-connecting-ip");
  if (ip) form.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { success?: boolean };
  if (!data.success) throw new ForbiddenException("Turnstile verification failed");
  await next();
});
