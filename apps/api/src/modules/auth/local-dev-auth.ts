import { createHmac, timingSafeEqual } from "node:crypto";

import { Prisma } from "@nexora/database";

import { UnauthorizedException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";

const TOKEN_PREFIX = "dev1.";
const ACCESS_TTL_SEC = 60 * 60;
const REFRESH_TTL_SEC = 60 * 60 * 24 * 7;

type TokenKind = "access" | "refresh";

type TokenPayload = {
  sub: string;
  typ: TokenKind;
  iat: number;
  exp: number;
};

export type LocalDevSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
};

export function isLocalDevAuthAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    !process.env.K_SERVICE &&
    !process.env.VERCEL
  );
}

export function isSupabaseNotConfiguredError(err: unknown): boolean {
  return err instanceof Error && err.message === "Supabase is not configured";
}

export function isLocalDevToken(token: string | undefined): boolean {
  return typeof token === "string" && token.startsWith(TOKEN_PREFIX);
}

function secret(): string {
  return process.env.DEV_AUTH_SECRET?.trim() || "intranet-local-dev-auth";
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function signPayload(payload: TokenPayload): string {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", secret()).update(body).digest();
  return `${TOKEN_PREFIX}${body}.${b64url(mac)}`;
}

function readPayload(token: string): TokenPayload | null {
  if (!isLocalDevToken(token)) return null;
  const raw = token.slice(TOKEN_PREFIX.length);
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = createHmac("sha256", secret()).update(body).digest();
    actual = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (
      typeof parsed.sub !== "string" ||
      (parsed.typ !== "access" && parsed.typ !== "refresh") ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp * 1000 <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function issueLocalDevSession(userId: string): LocalDevSession {
  const now = Math.floor(Date.now() / 1000);
  const access = signPayload({
    sub: userId,
    typ: "access",
    iat: now,
    exp: now + ACCESS_TTL_SEC,
  });
  const refresh = signPayload({
    sub: userId,
    typ: "refresh",
    iat: now,
    exp: now + REFRESH_TTL_SEC,
  });
  return {
    accessToken: access,
    refreshToken: refresh,
    expiresIn: ACCESS_TTL_SEC,
    expiresAt: now + ACCESS_TTL_SEC,
  };
}

export function verifyLocalDevAccessToken(token: string): string | null {
  if (!isLocalDevAuthAllowed()) return null;
  const payload = readPayload(token);
  if (!payload || payload.typ !== "access") return null;
  return payload.sub;
}

export function refreshLocalDevSession(refreshToken: string): LocalDevSession | null {
  if (!isLocalDevAuthAllowed()) return null;
  const payload = readPayload(refreshToken);
  if (!payload || payload.typ !== "refresh") return null;
  return issueLocalDevSession(payload.sub);
}

export async function loginWithLocalCredentials(input: {
  email: string;
  password: string;
}): Promise<{ userId: string; session: LocalDevSession }> {
  if (!isLocalDevAuthAllowed()) {
    throw new UnauthorizedException("Invalid credentials");
  }

  const email = input.email.trim().toLowerCase();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT u.id
    FROM users u
    JOIN account a ON a."userId" = u.id
    WHERE lower(u.email) = ${email}
      AND u.is_active = true
      AND u.deleted_at IS NULL
      AND a."providerId" = 'credential'
      AND a.password IS NOT NULL
      AND a.password = crypt(${input.password}, a.password)
    LIMIT 1
  `);

  const userId = rows[0]?.id;
  if (!userId) {
    throw new UnauthorizedException("Invalid credentials");
  }

  return { userId, session: issueLocalDevSession(userId) };
}
