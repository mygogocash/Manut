#!/usr/bin/env node
/**
 * Idempotent Supabase Auth → Better Auth credential import.
 * Follows Better Auth's Supabase migration guide + our Phase 0 finding that
 * Better Auth 1.7 requires account.issuer = 'local:credential'.
 *
 * Usage:
 *   DIRECT_URL=… node packages/db/scripts/migrate-supabase-auth.mjs [--dry-run]
 */
import postgres from "postgres";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL or DATABASE_URL required");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

const ISSUER = "local:credential";

try {
  const authUsers = await sql`
    SELECT id::text AS id, email, encrypted_password, email_confirmed_at, banned_until, deleted_at
    FROM auth.users
    WHERE encrypted_password IS NOT NULL
      AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until < now())
  `;

  let verified = 0;
  let accounts = 0;
  let skipped = 0;

  for (const u of authUsers) {
    if (!u.email) {
      skipped += 1;
      continue;
    }

    if (u.email_confirmed_at) {
      if (dryRun) {
        verified += 1;
      } else {
        const r = await sql`
          UPDATE users
          SET email_verified = true
          WHERE id = ${u.id}::uuid AND email_verified = false
        `;
        verified += r.count;
      }
    }

    const existing = await sql`
      SELECT id FROM account
      WHERE "userId" = ${u.id}::uuid AND "providerId" = 'credential'
      LIMIT 1
    `;
    if (existing.length) {
      if (!dryRun) {
        await sql`
          UPDATE account
          SET issuer = ${ISSUER},
              password = COALESCE(password, ${u.encrypted_password}),
              "updatedAt" = now()
          WHERE "userId" = ${u.id}::uuid AND "providerId" = 'credential'
        `;
      }
      skipped += 1;
      continue;
    }

    if (dryRun) {
      accounts += 1;
      continue;
    }

    await sql`
      INSERT INTO account (
        id, "userId", "accountId", "providerId", issuer, password, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${u.id}::uuid, ${u.id}, 'credential', ${ISSUER},
        ${u.encrypted_password}, now(), now()
      )
    `;
    accounts += 1;
  }

  console.log(
    JSON.stringify({
      dryRun,
      authUsers: authUsers.length,
      emailVerifiedUpdated: verified,
      credentialAccountsCreated: accounts,
      skippedOrExisting: skipped,
    }),
  );
} finally {
  await sql.end({ timeout: 1 });
}
