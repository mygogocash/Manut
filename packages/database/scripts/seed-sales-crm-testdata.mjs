/**
 * Seed test data for Sales CRM.
 *
 *   node packages/database/scripts/seed-sales-crm-testdata.mjs
 *   node packages/database/scripts/seed-sales-crm-testdata.mjs --clean
 *   node packages/database/scripts/seed-sales-crm-testdata.mjs --catalogs-only
 *
 * `--catalogs-only` fills the lookup catalogs and writes NO records — the
 * business-unit / lead-source / lost-reason / stage-config rows that migrations
 * create and `prisma db push` does not. That is what staging needs to make the
 * nav children, filters and chips work; it does not need synthetic deals.
 *
 * Targets whatever DATABASE_URL resolves to, so pass it explicitly for staging:
 *
 *   DATABASE_URL="$STAGING_DATABASE_URL" \
 *     node packages/database/scripts/seed-sales-crm-testdata.mjs --catalogs-only
 *
 * Written to replace "mirror production Sales CRM onto staging". A mirror is
 * not possible without also copying `users` (every `owner_id` is
 * `UUID NOT NULL` with `ON DELETE RESTRICT`), and it would put real third-party
 * contact names, emails, phones and deal values into an environment whose RLS
 * is applied by a migration that staging never runs. This produces the same
 * SHAPE with none of the data.
 *
 * Coverage — every Sales CRM surface has something to show:
 *   * all six opportunity stages, so no kanban column is empty
 *     (qualified / proposal / negotiation / closed_won / live / closed_lost)
 *   * every business unit view, plus an untagged deal for the `__none__`
 *     "Unassigned" child
 *   * one deal per business unit chip combination, including a deal whose
 *     units DISAGREE (Onewave live while Onewave Revenue is still at
 *     proposal) — the case the per-unit board exists for
 *   * all five lead statuses (new / contacted / qualified / converted /
 *     disqualified), with the converted lead actually pointing at its
 *     opportunity so the audit trail renders
 *   * a closed_lost deal carrying a lostReason code
 *   * tasks overdue / due-soon / done / cancelled, on both leads and
 *     opportunities
 *   * all four activity types (call / email / meeting / note)
 *   * an account with no opportunities, and a deal with no contact
 *
 * Every `name` / `company` / `subject` carries the "[TEST] " prefix so cleanup
 * is exact. `--clean` removes those rows and nothing else. Contacts have no
 * name field to prefix — they cascade from their account.
 *
 * Writes rows DIRECTLY rather than through the services, deliberately: the
 * services fan out notification email, and seeding must not mail real people.
 *
 * NOTE — the lookup catalogs are upserted, not assumed. `crm_business_units`,
 * `crm_lead_sources`, `crm_lost_reasons` and `opportunity_stage_config` are
 * populated by MIGRATIONS, and staging syncs with `prisma db push`, which never
 * runs them. On a db:push-synced database those tables exist but are EMPTY, so
 * chips would render raw codes and the stage columns would have no labels. This
 * script fills them idempotently before seeding records.
 *
 * Writes to whatever DATABASE_URL resolves to. Check it before running.
 */
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();
const PREFIX = "[TEST] ";

const STAGE = {
  QUALIFIED: "qualified",
  PROPOSAL: "proposal",
  NEGOTIATION: "negotiation",
  WON: "closed_won",
  LIVE: "live",
  LOST: "closed_lost",
};

const BU = {
  ONEWAVE: "onewave",
  REVENUE: "onewave-revenue",
  ARIA: "aria",
};

/** Fixed clock so re-runs produce identical relative dates. */
const BASE = new Date("2026-08-27T00:00:00.000Z");
const day = (n) => new Date(BASE.getTime() + n * 86_400_000);
/** @db.Date columns — strip the time so the stored value is unambiguous. */
const dateOnly = (n) => new Date(day(n).toISOString().slice(0, 10));

// ── Lookup catalogs ────────────────────────────────────────────────
// Codes must match the migration seeds exactly; a mismatch renders the raw
// code in the chip instead of a label. Business-unit `color` is a shared Badge
// variant NAME, never a Tailwind class, so it resolves through Badge's literal
// VARIANT_STYLES map and survives Tailwind's static scan.

const BUSINESS_UNITS = [
  { code: BU.ONEWAVE, label: "Onewave", color: "blue", sortOrder: 10, isActive: true },
  { code: BU.REVENUE, label: "Onewave Revenue", color: "teal", sortOrder: 20, isActive: true },
  // ARIA seeds INACTIVE, matching migration 20261225000000_retire_aria_business_unit.
  // ARIA is a module, not a way of tagging cards; an ACTIVE row here puts a
  // third "ARIA" entry back in the Sales CRM nav group, which is the exact bug
  // that migration exists to prevent. The row must still EXIST, because records
  // migrated from the retired ARIA Revenue CRM carry the `aria` code and
  // `labelForBusinessUnitCode` needs it to render "ARIA" rather than the raw
  // code. Absent on staging (db:push never runs migrations), so seeding it
  // active is not a no-op there — it is a regression.
  { code: BU.ARIA, label: "ARIA", color: "violet", sortOrder: 30, isActive: false },
];

const LEAD_SOURCES = [
  { code: "web", label: "Web inbound", sortOrder: 10 },
  { code: "referral", label: "Referral", sortOrder: 20 },
  { code: "conference", label: "Conference", sortOrder: 30 },
  { code: "partner", label: "Partner", sortOrder: 40 },
  { code: "cold", label: "Cold outreach", sortOrder: 50 },
  { code: "other", label: "Other", sortOrder: 60 },
];

const LOST_REASONS = [
  { code: "price", label: "Price", sortOrder: 10 },
  { code: "timing", label: "Timing", sortOrder: 20 },
  { code: "competitor", label: "Lost to competitor", sortOrder: 30 },
  { code: "no-budget", label: "No budget", sortOrder: 40 },
];

const STAGE_CONFIG = [
  { key: STAGE.QUALIFIED, label: "Qualified", probability: 20, sortOrder: 10, color: "border-t-zinc-500" },
  { key: STAGE.PROPOSAL, label: "Proposal", probability: 40, sortOrder: 20, color: "border-t-blue-500" },
  { key: STAGE.NEGOTIATION, label: "Negotiation", probability: 60, sortOrder: 30, color: "border-t-amber-500" },
  { key: STAGE.WON, label: "Closed won", probability: 100, sortOrder: 40, color: "border-t-emerald-500" },
  { key: STAGE.LIVE, label: "Live", probability: 100, sortOrder: 50, color: "border-t-teal-500" },
  { key: STAGE.LOST, label: "Closed lost", probability: 0, sortOrder: 60, color: "border-t-red-500" },
];

async function ensureCatalogs() {
  for (const u of BUSINESS_UNITS) {
    await prisma.crmBusinessUnit.upsert({
      where: { code: u.code },
      // Never downgrade an admin's edits: only fill a row that is absent.
      update: {},
      // isActive comes from the row, NOT hardcoded true — see the ARIA note in
      // BUSINESS_UNITS. Forcing true here re-activates a deliberately retired unit.
      create: { ...u, isSystem: false, isActive: u.isActive ?? true },
    });
  }
  for (const s of LEAD_SOURCES) {
    await prisma.leadSource.upsert({
      where: { code: s.code },
      update: {},
      create: { ...s, isSystem: true, isActive: true },
    });
  }
  for (const r of LOST_REASONS) {
    await prisma.lostReason.upsert({
      where: { code: r.code },
      update: {},
      create: { ...r, isSystem: true, isActive: true },
    });
  }
  for (const s of STAGE_CONFIG) {
    await prisma.opportunityStageConfig.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(
    `catalogs ready: ${BUSINESS_UNITS.length} business units, ` +
      `${LEAD_SOURCES.length} lead sources, ${LOST_REASONS.length} lost reasons, ` +
      `${STAGE_CONFIG.length} stages`,
  );
}

// ── Owners ─────────────────────────────────────────────────────────

/**
 * Resolve owners by email, falling back to whatever active users exist.
 *
 * Deliberately more forgiving than seed-proposal-testdata.mjs, which throws on
 * a missing email: this script is meant to run on staging, whose user set is
 * not the dev seed's. Only a database with NO usable user is fatal — and
 * `owner_id` is NOT NULL with ON DELETE RESTRICT, so there is no way to seed
 * around that.
 */
async function owners() {
  const preferred = [
    "admin@manut.xyz",
    "bhavin@manut.xyz",
    "priya.sharma@manut.xyz",
  ];
  const wanted = await prisma.user.findMany({
    where: { email: { in: preferred }, deletedAt: null },
    select: { id: true, email: true },
  });

  let pool = wanted;
  if (pool.length === 0) {
    pool = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, email: true },
      orderBy: { createdAt: "asc" },
      take: 3,
    });
    if (pool.length > 0) {
      console.log(
        `none of the preferred users exist; using ${pool.map((u) => u.email).join(", ")}`,
      );
    }
  }
  if (pool.length === 0) {
    throw new Error(
      "No active user to own the records. Seed users first — owner_id is NOT NULL " +
        "with ON DELETE RESTRICT, so records cannot be created without one.",
    );
  }
  // Cycle so a one-user database still works.
  return (i) => pool[i % pool.length].id;
}

// ── Clean ──────────────────────────────────────────────────────────

async function clean() {
  // Order matters only for the rows that do NOT cascade. Activities and tasks
  // hang off leads/opportunities/accounts with onDelete: Cascade, so deleting
  // accounts and leads sweeps almost everything — but an activity or task
  // written against a row somebody has since deleted by hand would survive, so
  // they are removed by prefix first.
  const tasks = await prisma.crmTask.deleteMany({
    where: { subject: { startsWith: PREFIX } },
  });
  const activities = await prisma.crmActivity.deleteMany({
    where: { subject: { startsWith: PREFIX } },
  });
  // Leads before opportunities: Lead.convertedOpportunityId is SetNull, not
  // Cascade, so a surviving lead would simply lose its pointer rather than
  // block the delete — but removing leads first keeps the audit trail honest.
  const leads = await prisma.lead.deleteMany({
    where: { company: { startsWith: PREFIX } },
  });
  const opportunities = await prisma.opportunity.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });
  const accounts = await prisma.account.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });

  console.log(
    `removed ${accounts.count} account(s), ${opportunities.count} opportunity(ies), ` +
      `${leads.count} lead(s), ${activities.count} activity(ies), ${tasks.count} task(s)`,
  );
  console.log(
    "catalog rows (business units, lead sources, lost reasons, stages) are left " +
      "in place — they are shared configuration, not test data.",
  );
}

// ── Seed ───────────────────────────────────────────────────────────

async function seed() {
  await ensureCatalogs();
  const ownerAt = await owners();

  const existing = await prisma.account.count({
    where: { name: { startsWith: PREFIX } },
  });
  if (existing > 0) {
    throw new Error(
      `${existing} test account(s) already present. Run with --clean first, or ` +
        "the second run will duplicate them (names are not unique).",
    );
  }

  // ---- Accounts + contacts ----------------------------------------
  const accountSpecs = [
    {
      key: "northwind",
      name: `${PREFIX}Northwind Telecom`,
      domain: "test-northwind.example",
      industry: "Telecommunications",
      country: "Thailand",
      region: "APAC",
      businessUnits: [BU.ONEWAVE],
      totalUsers: 1_800_000,
      appUsers: 420_000,
      picName: "Test PIC — Northwind",
      engagementType: "revenue",
      contacts: [
        { firstName: "Test", lastName: "Primary-Northwind", email: "primary@test-northwind.example", title: "Head of Digital", isPrimary: true },
        { firstName: "Test", lastName: "Second-Northwind", email: "second@test-northwind.example", title: "Product Manager" },
      ],
    },
    {
      key: "contoso",
      name: `${PREFIX}Contoso Digital`,
      domain: "test-contoso.example",
      industry: "Media",
      country: "Singapore",
      region: "APAC",
      // Multi-tag: appears under two business-unit nav children.
      businessUnits: [BU.REVENUE, BU.ARIA],
      totalUsers: 640_000,
      appUsers: 95_000,
      contacts: [
        { firstName: "Test", lastName: "Primary-Contoso", email: "primary@test-contoso.example", title: "CTO", isPrimary: true },
      ],
    },
    {
      key: "fabrikam",
      name: `${PREFIX}Fabrikam Mobile`,
      domain: "test-fabrikam.example",
      industry: "Retail",
      country: "Vietnam",
      region: "APAC",
      businessUnits: [BU.ARIA],
      contacts: [
        { firstName: "Test", lastName: "Primary-Fabrikam", email: "primary@test-fabrikam.example", isPrimary: true },
      ],
    },
    {
      key: "tailspin",
      name: `${PREFIX}Tailspin Ventures`,
      domain: "test-tailspin.example",
      industry: "Financial services",
      country: "Indonesia",
      region: "APAC",
      // Untagged on purpose — drives the `__none__` "Unassigned" nav child.
      businessUnits: [],
      contacts: [],
    },
    {
      key: "adventure",
      name: `${PREFIX}Adventure Works`,
      domain: "test-adventure.example",
      industry: "Logistics",
      country: "India",
      region: "APAC",
      businessUnits: [BU.ONEWAVE],
      // No opportunities and no contacts — the empty-account render path.
      contacts: [],
    },
  ];

  const accounts = {};
  const contacts = {};
  for (const [i, spec] of accountSpecs.entries()) {
    const { key, contacts: contactSpecs, ...data } = spec;
    const account = await prisma.account.create({
      data: {
        ...data,
        ownerId: ownerAt(i),
        sortOrder: i * 10,
        notes: `${PREFIX}synthetic account — safe to delete`,
      },
    });
    accounts[key] = account;
    contacts[key] = [];
    for (const c of contactSpecs) {
      contacts[key].push(
        await prisma.contact.create({
          data: { ...c, accountId: account.id, notes: `${PREFIX}synthetic contact` },
        }),
      );
    }
  }
  console.log(`seeded ${accountSpecs.length} account(s)`);

  // ---- Opportunities ----------------------------------------------
  // One per stage so every kanban column is populated, plus the per-unit
  // disagreement case and an untagged card.
  const oppSpecs = [
    {
      key: "qualified",
      name: `${PREFIX}Northwind — platform integration`,
      account: "northwind",
      contact: 0,
      stage: STAGE.QUALIFIED,
      value: 120_000,
      probability: 20,
      businessUnits: [BU.ONEWAVE],
      closeDay: 45,
      units: [{ businessUnit: BU.ONEWAVE, stage: STAGE.QUALIFIED, probability: 20, value: 120_000, closeDay: 45 }],
    },
    {
      key: "proposal",
      name: `${PREFIX}Contoso — ARIA rollout`,
      account: "contoso",
      contact: 0,
      stage: STAGE.PROPOSAL,
      value: 260_000,
      probability: 40,
      businessUnits: [BU.ARIA],
      closeDay: 30,
      units: [{ businessUnit: BU.ARIA, stage: STAGE.PROPOSAL, probability: 40, value: 260_000, closeDay: 30 }],
    },
    {
      key: "negotiation",
      name: `${PREFIX}Fabrikam — revenue share`,
      account: "fabrikam",
      contact: 0,
      stage: STAGE.NEGOTIATION,
      value: 90_000,
      probability: 60,
      businessUnits: [BU.ARIA, BU.REVENUE],
      closeDay: 14,
      units: [
        { businessUnit: BU.ARIA, stage: STAGE.NEGOTIATION, probability: 60, value: 60_000, closeDay: 14 },
        { businessUnit: BU.REVENUE, stage: STAGE.PROPOSAL, probability: 40, value: 30_000, closeDay: 40 },
      ],
    },
    {
      key: "won",
      name: `${PREFIX}Northwind — phase 2 expansion`,
      account: "northwind",
      contact: 1,
      stage: STAGE.WON,
      value: 310_000,
      probability: 100,
      businessUnits: [BU.ONEWAVE],
      closeDay: -20,
      launchDay: -5,
      units: [{ businessUnit: BU.ONEWAVE, stage: STAGE.WON, probability: 100, value: 310_000, closeDay: -20 }],
    },
    {
      key: "live",
      // THE case the per-unit board exists for: the deal is Live because one
      // unit shipped, while the other is still being sold.
      name: `${PREFIX}Contoso — dual-track launch`,
      account: "contoso",
      contact: 0,
      stage: STAGE.LIVE,
      value: 450_000,
      probability: 100,
      businessUnits: [BU.ONEWAVE, BU.REVENUE],
      closeDay: -60,
      launchDay: -30,
      revenueLaunchDay: -10,
      units: [
        { businessUnit: BU.ONEWAVE, stage: STAGE.LIVE, probability: 100, value: 300_000, closeDay: -60, launchDay: -30, revenueLaunchDay: -10 },
        { businessUnit: BU.REVENUE, stage: STAGE.PROPOSAL, probability: 40, value: 150_000, closeDay: 25 },
      ],
    },
    {
      key: "lost",
      name: `${PREFIX}Fabrikam — pilot (lapsed)`,
      account: "fabrikam",
      contact: null, // no primary contact — the nullable-contact render path
      stage: STAGE.LOST,
      value: 40_000,
      probability: 0,
      businessUnits: [BU.ARIA],
      closeDay: -35,
      lostReason: "timing",
      units: [{ businessUnit: BU.ARIA, stage: STAGE.LOST, probability: 0, value: 40_000, closeDay: -35, lostReason: "timing" }],
    },
    {
      key: "untagged",
      name: `${PREFIX}Tailspin — scoping`,
      account: "tailspin",
      contact: null,
      stage: STAGE.QUALIFIED,
      value: 75_000,
      probability: 20,
      // Untagged: must appear under "Unassigned", not under any unit view.
      businessUnits: [],
      closeDay: 60,
      units: [],
    },
  ];

  const opps = {};
  for (const [i, spec] of oppSpecs.entries()) {
    const contactList = contacts[spec.account] ?? [];
    const opp = await prisma.opportunity.create({
      data: {
        name: spec.name,
        accountId: accounts[spec.account].id,
        contactId:
          spec.contact === null ? null : (contactList[spec.contact]?.id ?? null),
        stage: spec.stage,
        value: spec.value,
        currency: "USD",
        probability: spec.probability,
        closeDate: spec.closeDay === undefined ? null : dateOnly(spec.closeDay),
        launchDate: spec.launchDay === undefined ? null : dateOnly(spec.launchDay),
        revenueLaunchDate:
          spec.revenueLaunchDay === undefined ? null : dateOnly(spec.revenueLaunchDay),
        lostReason: spec.lostReason ?? null,
        businessUnits: spec.businessUnits,
        ownerId: ownerAt(i),
        sortOrderWithinStage: 0,
        notes: `${PREFIX}synthetic opportunity — safe to delete`,
      },
    });
    opps[spec.key] = opp;

    for (const u of spec.units) {
      await prisma.opportunityBusinessUnit.create({
        data: {
          opportunityId: opp.id,
          businessUnit: u.businessUnit,
          stage: u.stage,
          probability: u.probability,
          value: u.value,
          closeDate: u.closeDay === undefined ? null : dateOnly(u.closeDay),
          launchDate: u.launchDay === undefined ? null : dateOnly(u.launchDay),
          revenueLaunchDate:
            u.revenueLaunchDay === undefined ? null : dateOnly(u.revenueLaunchDay),
          lostReason: u.lostReason ?? null,
        },
      });
    }
  }
  console.log(`seeded ${oppSpecs.length} opportunity(ies) across ${STAGE_CONFIG.length} stages`);

  // ---- Leads ------------------------------------------------------
  const leadSpecs = [
    { company: `${PREFIX}Litware Mobile`, firstName: "Test", lastName: "New-Lead", source: "web", status: "new", businessUnits: [BU.ONEWAVE] },
    { company: `${PREFIX}Proseware Media`, firstName: "Test", lastName: "Contacted-Lead", source: "referral", status: "contacted", businessUnits: [BU.ARIA] },
    { company: `${PREFIX}Wingtip Retail`, firstName: "Test", lastName: "Qualified-Lead", source: "conference", status: "qualified", businessUnits: [BU.REVENUE] },
    // Converted: points at a real opportunity so the audit trail renders.
    { company: `${PREFIX}Northwind Telecom`, firstName: "Test", lastName: "Converted-Lead", source: "partner", status: "converted", convertedKey: "qualified", businessUnits: [BU.ONEWAVE] },
    { company: `${PREFIX}Coho Vineyard`, firstName: "Test", lastName: "Disqualified-Lead", source: "cold", status: "disqualified", disqualifyReason: "Out of market", businessUnits: [] },
  ];

  const leads = {};
  for (const [i, spec] of leadSpecs.entries()) {
    const { convertedKey, ...data } = spec;
    const lead = await prisma.lead.create({
      data: {
        ...data,
        email: `${data.lastName.toLowerCase()}@test-lead.example`,
        phone: "+66000000000",
        ownerId: ownerAt(i),
        notes: `${PREFIX}synthetic lead — safe to delete`,
        convertedOpportunityId: convertedKey ? opps[convertedKey].id : null,
        convertedAt: convertedKey ? day(-7) : null,
      },
    });
    leads[spec.status] = lead;
  }
  console.log(`seeded ${leadSpecs.length} lead(s) across all five statuses`);

  // ---- Activities -------------------------------------------------
  const activitySpecs = [
    { type: "call", subject: `${PREFIX}Discovery call`, occurredDay: -3, durationMins: 30, opportunityKey: "qualified" },
    { type: "email", subject: `${PREFIX}Proposal sent`, occurredDay: -2, opportunityKey: "proposal" },
    { type: "meeting", subject: `${PREFIX}Commercial terms review`, occurredDay: -1, durationMins: 60, opportunityKey: "negotiation" },
    { type: "note", subject: `${PREFIX}Internal note — pricing floor`, occurredDay: -1, opportunityKey: "live" },
    { type: "call", subject: `${PREFIX}Intro call`, occurredDay: -5, durationMins: 15, leadStatus: "contacted" },
    { type: "email", subject: `${PREFIX}Account check-in`, occurredDay: -4, accountKey: "northwind" },
    { type: "note", subject: `${PREFIX}Contact prefers WhatsApp`, occurredDay: -6, contactKey: "northwind" },
  ];

  for (const [i, spec] of activitySpecs.entries()) {
    await prisma.crmActivity.create({
      data: {
        type: spec.type,
        subject: spec.subject,
        body: `${PREFIX}synthetic activity — safe to delete`,
        occurredAt: day(spec.occurredDay),
        durationMins: spec.durationMins ?? null,
        ownerId: ownerAt(i),
        opportunityId: spec.opportunityKey ? opps[spec.opportunityKey].id : null,
        leadId: spec.leadStatus ? leads[spec.leadStatus].id : null,
        accountId: spec.accountKey ? accounts[spec.accountKey].id : null,
        contactId: spec.contactKey ? (contacts[spec.contactKey][0]?.id ?? null) : null,
      },
    });
  }
  console.log(`seeded ${activitySpecs.length} activity(ies) across all four types`);

  // ---- Tasks ------------------------------------------------------
  const taskSpecs = [
    { subject: `${PREFIX}Overdue — chase signed MSA`, status: "open", dueDay: -6, opportunityKey: "negotiation" },
    { subject: `${PREFIX}Due soon — send revised pricing`, status: "open", dueDay: 2, opportunityKey: "proposal" },
    { subject: `${PREFIX}Due later — schedule QBR`, status: "open", dueDay: 21, opportunityKey: "live" },
    { subject: `${PREFIX}Completed — collect tech requirements`, status: "done", dueDay: -10, completedDay: -9, opportunityKey: "qualified" },
    { subject: `${PREFIX}Cancelled — legal review`, status: "cancelled", dueDay: -2, opportunityKey: "lost" },
    { subject: `${PREFIX}Overdue — qualify inbound`, status: "open", dueDay: -1, leadStatus: "new" },
  ];

  for (const [i, spec] of taskSpecs.entries()) {
    await prisma.crmTask.create({
      data: {
        subject: spec.subject,
        status: spec.status,
        dueDate: dateOnly(spec.dueDay),
        completedAt: spec.completedDay === undefined ? null : day(spec.completedDay),
        ownerId: ownerAt(i),
        opportunityId: spec.opportunityKey ? opps[spec.opportunityKey].id : null,
        leadId: spec.leadStatus ? leads[spec.leadStatus].id : null,
      },
    });
  }
  console.log(`seeded ${taskSpecs.length} task(s): overdue, due-soon, done, cancelled`);

  // ---- Summary ----------------------------------------------------
  const [accountCount, oppCount, leadCount, unitCount] = await Promise.all([
    prisma.account.count({ where: { name: { startsWith: PREFIX } } }),
    prisma.opportunity.count({ where: { name: { startsWith: PREFIX } } }),
    prisma.lead.count({ where: { company: { startsWith: PREFIX } } }),
    prisma.opportunityBusinessUnit.count({
      where: { opportunity: { name: { startsWith: PREFIX } } },
    }),
  ]);

  console.log(
    `\ndone — ${accountCount} accounts, ${oppCount} opportunities ` +
      `(${unitCount} per-unit rows), ${leadCount} leads.`,
  );
  console.log(
    "check: every kanban column populated, an Unassigned card present, and " +
      `"${PREFIX}Contoso — dual-track launch" showing Onewave live beside ` +
      "Onewave Revenue at proposal.",
  );
}

/**
 * Populate ONLY the lookup catalogs, writing no records.
 *
 * This is what a db:push-synced environment (staging) actually needs: the
 * catalogs are migration-seeded, so `prisma db push` leaves them EMPTY, and an
 * empty `crm_business_units` means no business-unit nav children, an empty
 * filter and chips that render raw codes. Seeding them does not require the
 * [TEST] records, so this path exists to avoid putting synthetic accounts and
 * deals into an environment where somebody only wanted the pickers to work.
 */
async function catalogsOnly() {
  await ensureCatalogs();
  console.log("catalogs-only: no records written.");
}

const main = process.argv.includes("--clean")
  ? clean
  : process.argv.includes("--catalogs-only")
    ? catalogsOnly
    : seed;
main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
