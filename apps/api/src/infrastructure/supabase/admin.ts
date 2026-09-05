import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/common/utils/logger";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when URL and service role key are present (same criteria as real admin client). */
export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_KEY,
);

/**
 * Supabase Storage and DB RLS are bypassed only when the Authorization JWT
 * role is `service_role`. Mis-pasting the anon key yields "new row violates
 * row-level security policy" on storage uploads.
 */
function assertJwtServiceRole(key: string): void {
  const parts = key.split(".");
  if (parts.length !== 3) {
    logger.warn(
      "SUPABASE_SERVICE_ROLE_KEY does not look like a JWT; cannot verify role. Wrong keys often cause Storage RLS errors on upload.",
    );
    return;
  }
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { role?: string };
    if (payload.role === "anon" || payload.role === "authenticated") {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not the service_role secret (JWT role is "' +
          payload.role +
          '"). Use Project Settings > API > service_role key in Supabase Dashboard; the anon key cannot upload to Storage under RLS.',
      );
    }
    if (payload.role !== "service_role") {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY JWT role must be "service_role" (got "' +
          String(payload.role) +
          '"). Paste the service_role secret from Supabase Dashboard > Settings > API.',
      );
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      logger.warn(
        "Could not parse SUPABASE_SERVICE_ROLE_KEY JWT payload; skipping role check.",
      );
      return;
    }
    throw err;
  }
}

function createSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    logger.warn("Supabase env vars not set - auth features will not work");
    return new Proxy({} as SupabaseClient, {
      get: () => {
        throw new Error("Supabase is not configured");
      },
    });
  }

  assertJwtServiceRole(SUPABASE_SERVICE_KEY);

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  });
}

export const supabaseAdmin = createSupabaseAdmin();
