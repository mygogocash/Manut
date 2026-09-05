import { z } from "zod";

// Push request validation.
//
// The endpoint is the one field worth being strict about: it is a URL we will
// later hand to an HTTP client, so an unvalidated value is an SSRF primitive.
// Restricting it to https keeps a caller from registering `http://localhost:…`
// or a file/gopher scheme and using the send loop as a request forwarder.

const httpsUrl = z
  .string()
  .min(1, "Endpoint is required")
  .max(2048, "Endpoint is too long")
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Endpoint must be a valid https URL");

export const subscribeSchema = z.object({
  endpoint: httpsUrl,
  keys: z.object({
    // Base64url, browser-issued. Bounded so a caller cannot post megabytes.
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  // Sent by the client for its own convenience; truncated before storage and
  // never trusted for anything.
  userAgent: z.string().max(512).optional(),
});

export const unsubscribeSchema = z.object({
  endpoint: httpsUrl,
});

/**
 * The development-only test trigger.
 *
 * No recipient field: it always sends to the caller. A route that accepts
 * "who to notify" would be a way to push arbitrary text at colleagues.
 */
export const testNotificationSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  body: z.string().min(1).max(160).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
export type TestNotificationInput = z.infer<typeof testNotificationSchema>;

/**
 * Parses a subscribe request into a properly-required shape.
 *
 * Why this exists: `apps/api/tsconfig.json` sets `strict: false`, so
 * `strictNullChecks` is off, and Zod's inference then marks every field
 * optional — `undefined extends string` is true without it. The schema above
 * genuinely rejects a missing `p256dh` or `auth` at runtime; the optionality is
 * a type-level artefact only.
 *
 * Rather than sprinkle `!` at each call site, the artefact is confined here so
 * the service keeps an honest, required-field signature.
 */
export function parseSubscribeInput(body: unknown): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
} {
  const parsed = subscribeSchema.parse(body);
  return {
    endpoint: parsed.endpoint as string,
    keys: {
      p256dh: parsed.keys.p256dh as string,
      auth: parsed.keys.auth as string,
    },
    userAgent: parsed.userAgent,
  };
}

/** Same reasoning as `parseSubscribeInput`. */
export function parseUnsubscribeInput(body: unknown): { endpoint: string } {
  const parsed = unsubscribeSchema.parse(body);
  return { endpoint: parsed.endpoint as string };
}
