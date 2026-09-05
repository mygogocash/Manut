import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../lib/context";
import { HttpException } from "@nexora/core";

/**
 * Same wire shape as the legacy Express errorHandler
 * (apps/api/src/core/middleware/error-handler.ts): `{ error: { code, message, details? } }`.
 */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const log = (level: "warn" | "error", payload: Record<string, unknown>) =>
    console[level](JSON.stringify({ level, requestId: c.var.requestId, method: c.req.method, path: c.req.path, ...payload }));

  if (err instanceof ZodError) {
    log("warn", { code: "VALIDATION_ERROR", issues: err.issues.length });
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Validation failed", details: err.issues.map((i) => ({ field: i.path.length ? i.path.join(".") : undefined, message: i.message })) } }, 422);
  }
  if (err instanceof HttpException) {
    log(err.status >= 500 ? "error" : "warn", { code: err.code, message: err.message });
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status as 400);
  }
  if (isPostgresError(err)) {
    const mapped = mapPostgresError(err.code);
    log(mapped.status >= 500 ? "error" : "warn", { pgCode: err.code, message: err.message });
    return c.json({ error: { code: mapped.code, message: mapped.message } }, mapped.status);
  }
  log("error", { error: err.message, stack: err.stack });
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
};

function isPostgresError(err: unknown): err is Error & { code: string } {
  if (!(err instanceof Error)) return false;
  const code = (err as unknown as { code?: unknown }).code;
  return typeof code === "string" && /^\d{2}[0-9A-Z]{3}$/.test(code);
}

/** SQLSTATE → same envelope the Prisma error mapper produced (P2002/P2003/P2025). */
function mapPostgresError(code: string): { status: 400 | 404 | 409 | 500 | 503; code: string; message: string } {
  switch (code) {
    case "23505": return { status: 409, code: "CONFLICT", message: "A record with this value already exists" };
    case "23503": return { status: 400, code: "INVALID_REFERENCE", message: "Related data is missing or invalid (for example a foreign key does not match an existing record)" };
    case "08000": case "08003": case "08006": case "57P01": return { status: 503, code: "SERVICE_UNAVAILABLE", message: "Database is unavailable" };
    default: return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
  }
}
