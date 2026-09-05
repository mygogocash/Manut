/**
 * Seed test data for Proposals.
 *
 *   node packages/database/scripts/seed-proposal-testdata.mjs
 *   node packages/database/scripts/seed-proposal-testdata.mjs --clean
 *
 * One proposal per status, each with a decision history and, where it makes
 * sense, open and answered questions, so every queue tab and both panels on the
 * detail page have something to show.
 *
 * Every title carries the "[TEST] " prefix so cleanup is exact. --clean removes
 * those rows and nothing else.
 *
 * Writes rows DIRECTLY rather than calling the service, deliberately: the
 * service sends notifications, and seeding must not mail real people.
 *
 * NOTE: this writes to whatever DATABASE_URL resolves to, which for
 * .env.development is the SHARED Supabase instance, not a local database. That
 * instance is db:push-synced, so the proposal tables can be dropped by a deploy
 * or by a colleague pushing a schema without them. If this script fails with
 * P2021, recreate them first:
 *
 *   cd packages/database
 *   npx dotenv -e ../../.env.development -- npx prisma db execute \
 *     --schema prisma/schema \
 *     --file prisma/migrations/20261212000000_proposals/migration.sql
 */
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();
const PREFIX = "[TEST] ";

const S = {
  PM: "pending_pm_review",
  CEO: "pending_ceo_approval",
  APPROVED: "approved",
  DECLINED: "declined",
};

/** Resolve people by email so the script survives a reseeded database. */
async function people() {
  const wanted = [
    "admin@thebinaryholdings.com",
    "bhavin@thebinaryholdings.com",
    "priya.sharma@thebinaryholdings.com",
    "ava.davis@thebinaryholdings.com",
  ];
  const rows = await prisma.user.findMany({
    where: { email: { in: wanted } },
    select: { id: true, email: true },
  });
  const byEmail = new Map(rows.map((r) => [r.email, r.id]));
  const missing = wanted.filter((e) => !byEmail.has(e));
  if (missing.length) {
    throw new Error(`Missing users, seed the database first: ${missing.join(", ")}`);
  }
  return {
    admin: byEmail.get(wanted[0]),
    bhavin: byEmail.get(wanted[1]),
    priya: byEmail.get(wanted[2]),
    ava: byEmail.get(wanted[3]),
  };
}

async function clean() {
  // Children cascade from the proposal, so one delete is enough.
  const { count } = await prisma.proposal.deleteMany({
    where: { title: { startsWith: PREFIX } },
  });
  console.log(`removed ${count} test proposal(s)`);
}

/** Minutes ago, as a Date, so the timeline reads in a sensible order. */
function ago(minutes) {
  return new Date(Date.now() - minutes * 60_000);
}

async function seed() {
  const U = await people();
  await clean();

  const fixtures = [
    {
      title: "Single sign-on for the partner portal",
      description:
        "Partners keep a second password for the portal. Moving them onto the same identity provider we use internally would remove a support burden and a security gap. Roughly 40 partner users are affected.",
      type: "idea",
      priority: "high",
      raisedById: U.priya,
      status: S.CEO,
      minutesAgo: 240,
      // Cleared the first tier, so it sits with the final approver: this is the
      // row the admin login sees under "Awaiting My Decision".
      history: [
        { to: S.PM, actorId: U.priya },
        { from: S.PM, to: S.CEO, actorId: U.bhavin, choice: "pass", comment: "Worth doing. The licensing answer settles the main risk." },
      ],
      questions: [
        {
          askedById: U.bhavin,
          assignedToId: U.ava,
          question: "Which identity provider do the partners already use, and does licensing cover external users?",
          response: "They are on Azure AD already. Our licence covers guest accounts, so no extra cost.",
          raisedAtStatus: S.PM,
        },
      ],
    },
    {
      title: "Change request: partner payouts weekly instead of monthly",
      description:
        "Partners are asking for weekly payouts. Finance has flagged the reconciliation cost, so this needs a decision on whether the retention gain is worth it.",
      type: "change_request",
      priority: "urgent",
      raisedById: U.priya,
      status: S.PM,
      minutesAgo: 90,
      history: [{ to: S.PM, actorId: U.priya }],
      // Two open questions, one of them for the admin login, so both the
      // "Waiting on N answers" hint and the "Questions For Me" tab populate.
      questions: [
        {
          askedById: U.bhavin,
          assignedToId: U.admin,
          question: "What does the reconciliation actually cost per week, in hours?",
          raisedAtStatus: S.PM,
        },
        {
          askedById: U.bhavin,
          assignedToId: U.ava,
          question: "Have any partners said they would leave over this, or is it a preference?",
          raisedAtStatus: S.PM,
        },
      ],
    },
    {
      title: "In-app changelog so users see what shipped",
      description:
        "A short changelog surface inside the app. Cheap to build, and it stops support answering the same what-is-new question every release.",
      type: "idea",
      priority: "normal",
      raisedById: U.ava,
      status: S.APPROVED,
      minutesAgo: 1440,
      history: [
        { to: S.PM, actorId: U.ava },
        { from: S.PM, to: S.CEO, actorId: U.bhavin, choice: "pass", comment: "Sensible. Over to you." },
        { from: S.CEO, to: S.APPROVED, actorId: U.admin, choice: "pass", comment: "Approved. Schedule it with the next release." },
      ],
      questions: [],
    },
    {
      title: "Move the whole team onto a four-day week",
      description:
        "A trial of a four-day week for the product team, to see whether output holds. Would need HR and finance input before anything is committed.",
      type: "other",
      priority: "low",
      raisedById: U.ava,
      status: S.DECLINED,
      minutesAgo: 2880,
      history: [
        { to: S.PM, actorId: U.ava },
        {
          from: S.PM,
          to: S.DECLINED,
          actorId: U.bhavin,
          choice: "decline",
          comment: "Not a product decision, and not something this flow should carry. Raise it with HR directly.",
        },
      ],
      questions: [],
    },
  ];

  for (const f of fixtures) {
    const createdAt = ago(f.minutesAgo);
    const proposal = await prisma.proposal.create({
      data: {
        title: `${PREFIX}${f.title}`,
        description: f.description,
        type: f.type,
        priority: f.priority,
        raisedById: f.raisedById,
        status: f.status,
        statusChangedAt: createdAt,
        createdAt,
      },
      select: { id: true },
    });

    // Spread the history across the row's life so the panel reads in order.
    let offset = f.minutesAgo;
    for (const h of f.history) {
      offset = Math.max(1, offset - 20);
      await prisma.proposalTransition.create({
        data: {
          proposalId: proposal.id,
          fromStatus: h.from ?? null,
          toStatus: h.to,
          actorId: h.actorId,
          choice: h.choice ?? null,
          comment: h.comment ?? null,
          createdAt: ago(offset),
        },
      });
    }

    for (const q of f.questions) {
      await prisma.proposalInformationRequest.create({
        data: {
          proposalId: proposal.id,
          askedById: q.askedById,
          assignedToId: q.assignedToId,
          question: q.question,
          response: q.response ?? null,
          respondedAt: q.response ? ago(Math.max(1, f.minutesAgo - 45)) : null,
          raisedAtStatus: q.raisedAtStatus,
          createdAt: ago(Math.max(1, f.minutesAgo - 30)),
        },
      });
    }

    console.log(`  ${f.status.padEnd(22)} ${f.title}`);
  }

  const total = await prisma.proposal.count({ where: { title: { startsWith: PREFIX } } });
  const open = await prisma.proposalInformationRequest.count({ where: { respondedAt: null } });
  console.log(`\nseeded ${total} proposal(s), ${open} open question(s)`);
}

const main = process.argv.includes("--clean") ? clean : seed;
main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
