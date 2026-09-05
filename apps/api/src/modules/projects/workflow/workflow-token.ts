import { createHmac, timingSafeEqual } from "node:crypto";

import type { WorkflowStatus } from "@/modules/projects/workflow/workflow.types";

// One-click approval links for workflow emails.
//
// SECURITY MODEL — an action link performs a state change for someone who has
// not signed in, so it is deliberately constrained:
//
//  1. HMAC-SHA256 signed with WORKFLOW_EMAIL_TOKEN_SECRET. Without that secret
//     configured, no action links are emitted at all (the email still carries
//     the deep link) — there is no insecure default.
//  2. Bound to ONE project, ONE actor, ONE action, and the EXACT stage the
//     project was in when the mail was sent. The moment the project leaves
//     that stage the token is void, which makes it naturally single-use and
//     immune to replay — no token table required.
//  3. Expires (default 7 days).
//  4. The embedded actor is re-checked against live permissions when the token
//     is redeemed, so revoking someone's role also kills their pending links.
//  5. Only `approve` / `complete` are issued. Rejection requires a reason, so
//     reject links land in the UI rather than acting directly.

// Read lazily rather than at module load: env files are not guaranteed to be
// populated before this module is first imported.
function secret(): string | undefined {
  return process.env.WORKFLOW_EMAIL_TOKEN_SECRET?.trim() || undefined;
}
const DEFAULT_TTL_DAYS = 7;

export type TokenAction = "approve" | "complete";

interface TokenPayload {
  /** project id */ p: string;
  /** actor user id */ u: string;
  /** action */ a: TokenAction;
  /** stage the token is valid for */ s: WorkflowStatus;
  /** expiry, epoch seconds */ e: number;
}

/** Action links are only available when a signing secret is configured. */
export function actionLinksEnabled(): boolean {
  const s = secret();
  return Boolean(s && s.length >= 16);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(body: string): string {
  return b64url(createHmac("sha256", secret()!).update(body).digest());
}

/** Returns a signed token, or null when action links are disabled. */
export function issueActionToken(input: {
  projectId: string;
  userId: string;
  action: TokenAction;
  stage: WorkflowStatus;
  ttlDays?: number;
}): string | null {
  if (!actionLinksEnabled()) return null;
  const payload: TokenPayload = {
    p: input.projectId,
    u: input.userId,
    a: input.action,
    s: input.stage,
    e:
      Math.floor(Date.now() / 1000) +
      (input.ttlDays ?? DEFAULT_TTL_DAYS) * 86_400,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export type TokenVerification =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: "disabled" | "malformed" | "invalid" | "expired" };

export function verifyActionToken(token: string): TokenVerification {
  if (!actionLinksEnabled()) return { ok: false, reason: "disabled" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, signature] = parts;

  // Constant-time comparison — never leak signature validity through timing.
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(
        body.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString(),
    ) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (!payload?.p || !payload?.u || !payload?.a || !payload?.s) {
    return { ok: false, reason: "malformed" };
  }
  if (payload.e < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}
