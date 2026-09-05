/**
 * Backfill the advance/overpayment columns that `prisma db push` cannot fill.
 *
 *   node packages/database/scripts/backfill-advance-side-vendor.mjs --dry-run
 *   node packages/database/scripts/backfill-advance-side-vendor.mjs
 *
 * Targets whatever DATABASE_URL resolves to, so pass it explicitly for staging:
 *
 *   DATABASE_URL="$STAGING_DATABASE_URL" \
 *     node packages/database/scripts/backfill-advance-side-vendor.mjs
 *
 * WHY THIS SCRIPT EXISTS
 *
 * Staging syncs schema with `prisma db push`, not `prisma migrate deploy`. Push
 * reconciles the SHAPE of the database against the schema and never executes a
 * migration file, so any DATA statement inside one is silently skipped there.
 * The columns appear; the values do not.
 *
 * Migration 20261230000000_advance_kind_side_and_vat carries two such
 * statements. On prod they run with the migration. On staging they need this.
 *
 * WHAT IT DOES
 *
 *   1. `side` — retires the old free-text sentinel. Rows whose `notes` said
 *      'vendor-advance' are supplier-side ('ap'); everything else is 'ar',
 *      which is already the column default.
 *
 *   2. `vendor_id` — recovers the contact link from the free-text name, but
 *      ONLY where exactly one active contact in the same entity matches. An
 *      ambiguous name is left null on purpose: guessing would attach the money
 *      to the wrong party, and a contact merge would then move it somewhere
 *      nobody chose. Unmatched rows are reported so they can be fixed by hand.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 *   - `kind` is left at its 'refundable' default. Every pre-existing advance was
 *     booked at full value with no VAT split, which IS the refundable treatment.
 *     Reclassifying history as 'advance' would assert a tax point that was never
 *     declared.
 *   - `deactivated_at` on chart_of_accounts is left null. The reuse warning
 *     quotes that date to a person, and an invented date is worse than an
 *     absent one — the UI renders "date unknown".
 *
 * Idempotent. Every statement is constrained to rows that still need it, so a
 * second run reports zero changes rather than doing anything twice.
 */
import { PrismaClient } from "../src/generated/prisma/client.js";

const DRY_RUN = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

function line() {
  console.log("─".repeat(72));
}

async function reportSideCandidates() {
  const rows = await prisma.$queryRaw`
    SELECT count(*)::int AS n
    FROM "customer_advances"
    WHERE "notes" = 'vendor-advance' AND "side" <> 'ap'
  `;
  return rows[0]?.n ?? 0;
}

async function reportVendorCandidates() {
  const rows = await prisma.$queryRaw`
    SELECT count(*)::int AS n
    FROM "customer_advances" ca
    WHERE ca."vendor_id" IS NULL
      AND EXISTS (
        SELECT 1 FROM "vendors" v
        WHERE v."entity_id" = ca."entity_id"
          AND v."deleted_at" IS NULL
          AND lower(btrim(v."name")) = lower(btrim(ca."counterparty"))
      )
      AND (
        SELECT count(*) FROM "vendors" v2
        WHERE v2."entity_id" = ca."entity_id"
          AND v2."deleted_at" IS NULL
          AND lower(btrim(v2."name")) = lower(btrim(ca."counterparty"))
      ) = 1
  `;
  return rows[0]?.n ?? 0;
}

/** Rows that will stay null — ambiguous name, or no contact by that name. */
async function reportUnmatchable() {
  return prisma.$queryRaw`
    SELECT ca."id", ca."counterparty", ca."entity_id" AS "entityId",
           (
             SELECT count(*)::int FROM "vendors" v
             WHERE v."entity_id" = ca."entity_id"
               AND v."deleted_at" IS NULL
               AND lower(btrim(v."name")) = lower(btrim(ca."counterparty"))
           ) AS "matches"
    FROM "customer_advances" ca
    WHERE ca."vendor_id" IS NULL
      AND (
        SELECT count(*) FROM "vendors" v2
        WHERE v2."entity_id" = ca."entity_id"
          AND v2."deleted_at" IS NULL
          AND lower(btrim(v2."name")) = lower(btrim(ca."counterparty"))
      ) <> 1
    ORDER BY ca."counterparty"
  `;
}

async function main() {
  line();
  console.log(
    DRY_RUN
      ? "Advance backfill — DRY RUN, nothing will be written"
      : "Advance backfill — WRITING",
  );
  line();

  const total = await prisma.customerAdvance.count();
  console.log(`customer_advances rows: ${total}`);

  if (total === 0) {
    console.log(
      "\nNothing to backfill: the table is empty. On a staging database that " +
        "has never captured an overpayment this is the expected result, and " +
        "the feature will work correctly on new records regardless.",
    );
    return;
  }

  const sideCount = await reportSideCandidates();
  const vendorCount = await reportVendorCandidates();
  console.log(`  side  → 'ap'    : ${sideCount} row(s) need it`);
  console.log(`  vendor_id linked: ${vendorCount} row(s) can be matched`);

  if (!DRY_RUN) {
    const sideDone = await prisma.$executeRaw`
      UPDATE "customer_advances"
      SET "side" = 'ap'
      WHERE "notes" = 'vendor-advance' AND "side" <> 'ap'
    `;
    const vendorDone = await prisma.$executeRaw`
      UPDATE "customer_advances" ca
      SET "vendor_id" = v.id
      FROM "vendors" v
      WHERE ca."vendor_id" IS NULL
        AND v."entity_id" = ca."entity_id"
        AND v."deleted_at" IS NULL
        AND lower(btrim(v."name")) = lower(btrim(ca."counterparty"))
        AND (
          SELECT count(*) FROM "vendors" v2
          WHERE v2."entity_id" = ca."entity_id"
            AND v2."deleted_at" IS NULL
            AND lower(btrim(v2."name")) = lower(btrim(ca."counterparty"))
        ) = 1
    `;
    line();
    console.log(`side updated      : ${sideDone}`);
    console.log(`vendor_id updated : ${vendorDone}`);
  }

  const unmatchable = await reportUnmatchable();
  if (unmatchable.length > 0) {
    line();
    console.log(
      `${unmatchable.length} row(s) left WITHOUT a contact link — link these by hand:`,
    );
    for (const row of unmatchable) {
      const why =
        row.matches === 0
          ? "no contact by that name"
          : `${row.matches} contacts share that name`;
      console.log(`  ${row.id}  "${row.counterparty}"  (${why})`);
    }
    console.log(
      "\nThese are left null deliberately. Attaching the money to a guessed " +
        "contact would let a later merge move it to a party nobody chose.",
    );
  }

  line();
  console.log(DRY_RUN ? "Dry run complete — nothing written." : "Done.");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
