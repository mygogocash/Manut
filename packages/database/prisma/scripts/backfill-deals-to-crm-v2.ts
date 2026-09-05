import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../../../.env") });

import { PrismaClient } from "../../src/generated/prisma";

// =============================================================================
// PRD §9 backfill — Deal → Sales CRM v2.
//
// For every row in `deals`:
//   - stage='lead' → insert a Lead row (owner preserved, source='other').
//   - any other stage → insert / reuse an Account, optionally a Contact
//     parsed from `Deal.contact`, and a fresh Opportunity. The Opportunity
//     inherits value, stage, probability, closeDate, type, notes, ownerId.
//     `partnerId` flows from Deal → Account (per PRD §11.6).
//
// Idempotency:
//   Each new row carries `legacy_deal_id = <Deal.id>`. The script skips any
//   Deal whose id is already present in `crm_leads.legacy_deal_id` /
//   `crm_opportunities.legacy_deal_id`, so re-runs are safe and incremental
//   (e.g. running once on prod, then again after a few new Deals trickle in).
//
// Account dedupe inside the loop:
//   Legacy Deal data has no domain. We dedupe by case-insensitive name only
//   so two Deals on "Acme" collapse to one Account. Domain-based dedupe is
//   the live API path and is not needed here.
//
// Read-only run:
//   Pass `--dry-run` to see counts without writing.
//
// Usage:
//   pnpm --filter @nexora/database tsx prisma/scripts/backfill-deals-to-crm-v2.ts
//   pnpm --filter @nexora/database tsx prisma/scripts/backfill-deals-to-crm-v2.ts --dry-run
// =============================================================================

const prisma = new PrismaClient();

interface Stats {
  scanned: number;
  skipped: number;
  leadsCreated: number;
  accountsCreated: number;
  accountsReused: number;
  contactsCreated: number;
  opportunitiesCreated: number;
}

function splitContact(raw: string | null): { firstName: string; lastName: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(" ");
  if (idx === -1) {
    // Single token — promote to firstName, leave lastName blank-ish so the
    // schema NOT NULL still holds.
    return { firstName: trimmed, lastName: "—" };
  }
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1).trim() || "—",
  };
}

async function backfill(opts: { dryRun: boolean }): Promise<Stats> {
  const stats: Stats = {
    scanned: 0,
    skipped: 0,
    leadsCreated: 0,
    accountsCreated: 0,
    accountsReused: 0,
    contactsCreated: 0,
    opportunitiesCreated: 0,
  };

  // Cache resolved Account ids by case-folded name so multiple Deals on the
  // same company collapse to one Account inside this run.
  const accountByName = new Map<string, string>();

  const deals = await prisma.deal.findMany({ orderBy: { createdAt: "asc" } });

  for (const deal of deals) {
    stats.scanned += 1;

    if (deal.stage === "lead") {
      // ── lead branch ─────────────────────────────────────────────────
      const existing = await prisma.lead.findUnique({
        where: { legacyDealId: deal.id },
        select: { id: true },
      });
      if (existing) {
        stats.skipped += 1;
        continue;
      }

      if (opts.dryRun) {
        stats.leadsCreated += 1;
        continue;
      }

      const contact = splitContact(deal.contact);
      await prisma.lead.create({
        data: {
          company: deal.company,
          firstName: contact?.firstName ?? "—",
          lastName: contact?.lastName ?? "—",
          source: "other",
          status: "new",
          owner: { connect: { id: deal.ownerId } },
          notes: deal.notes,
          legacyDealId: deal.id,
        },
      });
      stats.leadsCreated += 1;
      continue;
    }

    // ── opportunity branch ─────────────────────────────────────────────
    const existingOpp = await prisma.opportunity.findUnique({
      where: { legacyDealId: deal.id },
      select: { id: true },
    });
    if (existingOpp) {
      stats.skipped += 1;
      continue;
    }

    // 1. Resolve / create Account (case-insensitive name, no domain).
    let accountId: string | undefined;
    const cacheKey = deal.company.trim().toLowerCase();

    const cached = accountByName.get(cacheKey);
    if (cached) {
      accountId = cached;
      stats.accountsReused += 1;
    } else {
      const existingAccount = await prisma.account.findFirst({
        where: { name: { equals: deal.company, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingAccount) {
        accountId = existingAccount.id;
        stats.accountsReused += 1;
        accountByName.set(cacheKey, accountId);
      } else if (!opts.dryRun) {
        const created = await prisma.account.create({
          data: {
            name: deal.company,
            country: deal.country,
            owner: { connect: { id: deal.ownerId } },
            // PRD §11.6 — push the Deal's partner link onto the Account.
            ...(deal.partnerId && {
              partner: { connect: { id: deal.partnerId } },
            }),
          },
          select: { id: true },
        });
        accountId = created.id;
        stats.accountsCreated += 1;
        accountByName.set(cacheKey, accountId);
      } else {
        stats.accountsCreated += 1;
        // dry-run: synthesise a sentinel id so the contact / opp branches
        // below still book-keep counts, but never actually run the writes.
        accountId = `dry-${cacheKey}`;
        accountByName.set(cacheKey, accountId);
      }
    }

    // 2. Optional Contact from Deal.contact.
    let contactId: string | undefined;
    const parsed = splitContact(deal.contact);
    if (parsed) {
      if (!opts.dryRun && accountId && !accountId.startsWith("dry-")) {
        const existingCount = await prisma.contact.count({
          where: { accountId },
        });
        const created = await prisma.contact.create({
          data: {
            account: { connect: { id: accountId } },
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            isPrimary: existingCount === 0,
          },
          select: { id: true },
        });
        contactId = created.id;
      }
      stats.contactsCreated += 1;
    }

    // 3. Opportunity — preserves the legacy stage, probability, value,
    //    closeDate, type, notes, owner.
    if (!opts.dryRun && accountId && !accountId.startsWith("dry-")) {
      await prisma.opportunity.create({
        data: {
          name: deal.company,
          account: { connect: { id: accountId } },
          ...(contactId && { contact: { connect: { id: contactId } } }),
          stage: deal.stage,
          value: deal.value,
          // legacy column had no per-deal currency — assume USD; reps can
          // edit post-backfill.
          currency: "USD",
          probability: deal.probability,
          // Treat every backfilled probability as rep-set so future stage
          // moves don't silently overwrite carried-over numbers.
          probabilityCustom: true,
          closeDate: deal.closeDate ?? undefined,
          type: deal.type,
          notes: deal.notes,
          owner: { connect: { id: deal.ownerId } },
          legacyDealId: deal.id,
        },
      });
    }
    stats.opportunitiesCreated += 1;
  }

  return stats;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(
    `🌱 Sales CRM v2 backfill ${dryRun ? "(DRY RUN — no writes)" : ""}`,
  );

  const start = Date.now();
  const stats = await backfill({ dryRun });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log("─────────────────────────────────────────");
  console.log(`Deals scanned:           ${stats.scanned}`);
  console.log(`Already-backfilled (skipped): ${stats.skipped}`);
  console.log(`Leads created:           ${stats.leadsCreated}`);
  console.log(`Accounts created:        ${stats.accountsCreated}`);
  console.log(`Accounts reused:         ${stats.accountsReused}`);
  console.log(`Contacts created:        ${stats.contactsCreated}`);
  console.log(`Opportunities created:   ${stats.opportunitiesCreated}`);
  console.log(`Elapsed: ${elapsed}s`);
  console.log("─────────────────────────────────────────");
}

main()
  .catch((e: unknown) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Exposed for unit tests so the migration logic can run against a stubbed
// PrismaClient without touching env / process.exit.
export { backfill, splitContact };
