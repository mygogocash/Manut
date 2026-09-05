#!/usr/bin/env node
/**
 * Storage migration: inventory + rewrite plan for Supabase Storage / GCS → R2.
 *
 * Phase 7 tooling. Does NOT call rclone itself — prints the inventory and the
 * suggested `rclone sync` commands. Rewrites DB fileUrl values when not --dry-run.
 *
 * Usage:
 *   DIRECT_URL=… node packages/db/scripts/migrate-storage.mjs --dry-run
 *   DIRECT_URL=… node packages/db/scripts/migrate-storage.mjs --delta --dry-run
 *   DIRECT_URL=… R2_PUBLIC=… R2_PRIVATE=… node packages/db/scripts/migrate-storage.mjs
 *
 * Env:
 *   DIRECT_URL / DATABASE_URL — Postgres
 *   SUPABASE_S3_* / GCS_* — optional; used only in printed rclone recipes
 *   R2_REWRITE_PREFIX_PUBLIC  default https://cdn.intranet…/public/
 *   R2_REWRITE_PREFIX_PRIVATE default r2:private:
 */
import postgres from "postgres";

const dryRun = process.argv.includes("--dry-run");
const delta = process.argv.includes("--delta");
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL or DATABASE_URL required");
  process.exit(1);
}

const PUBLIC_PREFIX = process.env.R2_REWRITE_PREFIX_PUBLIC ?? "https://cdn.intranet.thebinaryholdings.com/public/";
const PRIVATE_PREFIX = process.env.R2_REWRITE_PREFIX_PRIVATE ?? "r2:private:";

/** Tables/columns known to hold storage URLs (extend as ports land). */
const TARGETS = [
  { table: "blogs", column: "cover_image_url", kind: "public" },
  { table: "articles", column: "cover_image_url", kind: "public" },
  { table: "news", column: "cover_image_url", kind: "public" },
  { table: "wall_posts", column: "image_url", kind: "public" },
  { table: "expense_receipts", column: "file_url", kind: "private" },
  { table: "hrms_agreements", column: "file_url", kind: "private" },
  { table: "certificates", column: "file_url", kind: "private" },
  { table: "project_attachments", column: "file_url", kind: "private" },
  { table: "uploads", column: "url", kind: "public" },
];

const sql = postgres(url, { max: 1, prepare: false });

function classify(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return "empty";
  if (urlStr.startsWith("r2:") || urlStr.includes("cdn.intranet")) return "already-r2";
  if (urlStr.includes("supabase") || urlStr.includes("/storage/v1/")) return "supabase";
  if (urlStr.includes("storage.googleapis.com") || urlStr.includes("googleapis.com")) return "gcs";
  return "other";
}

function rewrite(urlStr, kind) {
  const c = classify(urlStr);
  if (c === "already-r2" || c === "empty") return null;
  // Keep path tail after last /object/public/ or /object/ or bucket/
  let key = urlStr;
  const markers = ["/object/public/", "/object/sign/", "/object/", ".com/"];
  for (const m of markers) {
    const i = urlStr.indexOf(m);
    if (i >= 0) {
      key = urlStr.slice(i + m.length).split("?")[0];
      break;
    }
  }
  key = key.replace(/^\/+/, "");
  return kind === "private" ? `${PRIVATE_PREFIX}${key}` : `${PUBLIC_PREFIX}${key}`;
}

try {
  const inventory = [];
  let rewriteCandidates = 0;
  let rewritten = 0;

  for (const t of TARGETS) {
    const exists = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${t.table} AND column_name = ${t.column}
      LIMIT 1
    `;
    if (!exists.length) {
      inventory.push({ ...t, status: "missing-column", counts: {} });
      continue;
    }

    const rows = await sql.unsafe(
      `SELECT id::text AS id, ${t.column} AS url FROM ${t.table} WHERE ${t.column} IS NOT NULL` +
        (delta ? ` AND ${t.column} NOT LIKE 'r2:%' AND ${t.column} NOT LIKE '%cdn.intranet%'` : ""),
    );

    const counts = { supabase: 0, gcs: 0, "already-r2": 0, other: 0, empty: 0 };
    for (const row of rows) {
      const c = classify(row.url);
      counts[c] = (counts[c] ?? 0) + 1;
      const next = rewrite(row.url, t.kind);
      if (!next) continue;
      rewriteCandidates += 1;
      if (!dryRun) {
        await sql.unsafe(`UPDATE ${t.table} SET ${t.column} = $1 WHERE id = $2::uuid`, [next, row.id]);
        rewritten += 1;
      }
    }
    inventory.push({ ...t, status: "ok", rowCount: rows.length, counts });
  }

  console.log(JSON.stringify({
    dryRun,
    delta,
    rewriteCandidates,
    rewritten,
    inventory,
    rcloneRecipe: [
      "# After wrangler R2 buckets exist:",
      "# rclone sync supabase-s3:bucket-public r2:intranet-staging-public --checksum",
      "# rclone sync supabase-s3:bucket-private r2:intranet-staging-private --checksum",
      "# rclone sync gcs:tbh-intranet-uploads r2:intranet-staging-public --checksum",
    ],
  }, null, 2));
} finally {
  await sql.end();
}
