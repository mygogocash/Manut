/**
 * Seed test data for the Project Request workflow.
 *
 *   node packages/database/scripts/seed-workflow-testdata.mjs
 *   node packages/database/scripts/seed-workflow-testdata.mjs --clean
 *
 * Creates one project per workflow status, each with a realistic approval
 * history so the timeline and Approval History panels have something to show.
 *
 * Every row is named "[TEST] …" and slugged "wf-test-…" so cleanup is exact.
 * --clean removes them and nothing else.
 *
 * NOTE: this writes to whatever DATABASE_URL resolves to, which for
 * .env.development is the SHARED Supabase instance — not a local database.
 */
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();
const PREFIX = "[TEST] ";
const SLUG = "wf-test-";

const S = {
  DRAFT: "draft",
  PM: "pending_pm_approval",
  ESC: "pending_escalation",
  DEV: "pending_development",
  DONE: "completed",
  REJECTED: "rejected",
};

// Backdated so "time in stage" reads sensibly instead of everything being now.
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

const FIXTURES = [
  {
    slug: "draft-returned",
    name: "Wallet reconciliation automation",
    priority: "high",
    department: "Finance",
    status: S.DRAFT,
    goLive: 45,
    history: [
      [null, S.PM, 5, "Raised for the Q4 close."],
      [S.PM, S.DRAFT, 4, "Returned: needs the expected saving quantified."],
    ],
    note: "Returned to the requester. Editable, then Submit again.",
  },
  {
    slug: "pm-approve-me",
    name: "Partner self-service portal",
    priority: "medium",
    department: "Product",
    status: S.PM,
    goLive: 60,
    history: [[null, S.PM, 3, "Scope agreed with Finance."]],
    note: "With the PM. Approve to send it straight to development.",
  },
  {
    slug: "pm-escalate-me",
    name: "Billing engine v2",
    priority: "high",
    department: "Product",
    departments: ["Product", "Finance", "IT"],
    status: S.PM,
    goLive: 90,
    history: [[null, S.PM, 6, "Needs budget sign-off before we start."]],
    note: "With the PM. Use Escalate to refer it to someone by name.",
  },
  {
    slug: "escalated-to-me",
    name: "KYC refresh workflow",
    priority: "urgent",
    department: "Legal",
    status: S.ESC,
    escalateToSelf: true,
    goLive: 30,
    history: [
      [null, S.PM, 9, "Regulatory deadline in Q4."],
      [S.PM, S.ESC, 6, "Escalating: needs Legal to confirm the scope."],
    ],
    note: "Escalated TO YOU. Approve or Reject should both work.",
  },
  {
    slug: "escalated-to-other",
    name: "Crypto desk integration",
    priority: "low",
    department: "Business Team",
    status: S.ESC,
    escalateToOther: true,
    goLive: 75,
    history: [
      [null, S.PM, 12, "Requested by the trading team."],
      [S.PM, S.ESC, 10, "Escalating for a commercial decision."],
    ],
    note: "Escalated to SOMEONE ELSE. You should see no approve action.",
  },
  {
    slug: "dev-in-progress",
    name: "SSO rollout phase 2",
    priority: "medium",
    department: "IT",
    status: S.DEV,
    goLive: 21,
    history: [
      [null, S.PM, 35, "Extending SSO to contractors."],
      [S.PM, S.DEV, 30, "Approved, straightforward extension."],
    ],
    note: "Approved. Board is unlocked; Mark Complete when done.",
  },
  {
    slug: "done-invoice-ocr",
    name: "Invoice OCR pipeline",
    priority: "medium",
    department: "Finance",
    status: S.DONE,
    goLive: -14,
    history: [
      [null, S.PM, 120, "Manual entry costs ~15 hours a week."],
      [S.PM, S.DEV, 116, "Clear payback, approved."],
      [S.DEV, S.DONE, 14, "Delivered and handed over."],
    ],
    note: "Terminal. No actions should appear.",
  },
  {
    slug: "rejected-vendor-portal",
    name: "Vendor portal rebuild",
    priority: "low",
    department: "Operations",
    status: S.REJECTED,
    goLive: 75,
    history: [
      [null, S.PM, 40, "Requested by Operations."],
      [S.PM, S.REJECTED, 37, "Rejected: no budget line this year."],
    ],
    note: "Rejected. Only the PM can Reopen it. Board is read-only.",
  },
];

async function clean() {
  const doomed = await prisma.project.findMany({
    where: { slug: { startsWith: SLUG } },
    select: { id: true, name: true },
  });
  if (!doomed.length) return console.log("Nothing to clean.");
  const ids = doomed.map((p) => p.id);
  await prisma.projectWorkflowEmail.deleteMany({
    where: { projectId: { in: ids } },
  });
  await prisma.projectWorkflowTransition.deleteMany({
    where: { projectId: { in: ids } },
  });
  await prisma.project.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${doomed.length} test projects:`);
  doomed.forEach((p) => console.log("  - " + p.name));
}

async function seed() {
  const admin = await prisma.user.findFirst({
    where: {
      isActive: true,
      userRoles: { some: { role: { isSystem: true, name: "Admin" } } },
    },
    select: { id: true, name: true, email: true },
  });
  if (!admin) throw new Error("No active Admin user to own the test projects.");
  const other = await prisma.user.findFirst({
    where: { isActive: true, id: { not: admin.id } },
    select: { id: true, name: true },
  });
  console.log(`Owner: ${admin.name} <${admin.email}>\n`);

  await clean(); // re-runnable
  console.log("");

  for (const f of FIXTURES) {
    const project = await prisma.project.create({
      data: {
        name: PREFIX + f.name,
        slug: SLUG + f.slug,
        description: `Test fixture for the ${f.status} state. ${f.note}`,
        ownerId: admin.id,
        department: f.department,
        departments: f.departments ?? [f.department],
        priority: f.priority,
        team: "general",
        status: f.status === S.DONE ? "completed" : "in_progress",
        progress: f.status === S.DONE ? 100 : f.status === S.DEV ? 45 : 0,
        goLiveDate: new Date(Date.now() + f.goLive * 86_400_000),
        workflowStatus: f.status,
        workflowUpdatedAt: f.history.length
          ? daysAgo(f.history[f.history.length - 1][2])
          : null,
        escalatedToId: f.escalateToSelf
          ? admin.id
          : f.escalateToOther
            ? (other?.id ?? null)
            : null,
      },
      select: { id: true },
    });

    for (const [from, to, ago, comment] of f.history) {
      await prisma.projectWorkflowTransition.create({
        data: {
          projectId: project.id,
          fromStatus: from,
          toStatus: to,
          actorId: admin.id,
          comment,
          createdAt: daysAgo(ago),
        },
      });
    }

    console.log(
      `  ${(f.status === S.DRAFT ? "draft (null)" : f.status).padEnd(34)} ${f.name}`,
    );
  }

  console.log(`\n${FIXTURES.length} test projects created.`);
  console.log("Remove them with: node <this file> --clean");
}

const run = process.argv.includes("--clean") ? clean : seed;
run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
