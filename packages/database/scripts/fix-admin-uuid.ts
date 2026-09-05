import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

const OLD_ADMIN_ID = "534ad7ab-68d4-483b-9eff-c57e751f66c3";
const NEW_ADMIN_ID = "e5b655d5-0217-4fb6-9eb8-e877bd60c9df";

async function run(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key") || msg.includes("already exists")) {
      console.log(`  ~ ${label} (skipped - already done)`);
    } else {
      console.log(`  ✗ ${label}: ${msg.substring(0, 80)}`);
    }
  }
}

async function main() {
  console.log("Migrating admin user UUID...");
  console.log(`  Old ID: ${OLD_ADMIN_ID}`);
  console.log(`  New ID: ${NEW_ADMIN_ID}\n`);

  // Check if migration already done
  const oldAdmin = await prisma.user.findUnique({
    where: { id: OLD_ADMIN_ID },
  });
  if (!oldAdmin) {
    const newAdmin = await prisma.user.findUnique({
      where: { id: NEW_ADMIN_ID },
    });
    if (newAdmin) {
      console.log("✅ Admin user already has correct UUID: " + newAdmin.email);
      return;
    }
    console.log("❌ No admin user found with either ID");
    return;
  }

  // Update all foreign key references using explicit UUID cast
  console.log("Updating foreign key references...\n");

  await run(
    `UPDATE user_roles SET user_id = '${NEW_ADMIN_ID}'::uuid WHERE user_id = '${OLD_ADMIN_ID}'::uuid`,
    "user_roles.user_id",
  );
  await run(
    `UPDATE user_roles SET assigned_by = '${NEW_ADMIN_ID}'::uuid WHERE assigned_by = '${OLD_ADMIN_ID}'::uuid`,
    "user_roles.assigned_by",
  );

  await run(
    `UPDATE leave_balances SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "leave_balances.employee_id",
  );

  await run(
    `UPDATE leave_requests SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "leave_requests.employee_id",
  );
  await run(
    `UPDATE leave_requests SET approved_by = '${NEW_ADMIN_ID}'::uuid WHERE approved_by = '${OLD_ADMIN_ID}'::uuid`,
    "leave_requests.approved_by",
  );

  await run(
    `UPDATE expenses SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "expenses.employee_id",
  );
  await run(
    `UPDATE expenses SET approved_by = '${NEW_ADMIN_ID}'::uuid WHERE approved_by = '${OLD_ADMIN_ID}'::uuid`,
    "expenses.approved_by",
  );

  await run(
    `UPDATE journal_entries SET created_by = '${NEW_ADMIN_ID}'::uuid WHERE created_by = '${OLD_ADMIN_ID}'::uuid`,
    "journal_entries.created_by",
  );
  await run(
    `UPDATE journal_entries SET approved_by = '${NEW_ADMIN_ID}'::uuid WHERE approved_by = '${OLD_ADMIN_ID}'::uuid`,
    "journal_entries.approved_by",
  );

  await run(
    `UPDATE payroll_runs SET run_by = '${NEW_ADMIN_ID}'::uuid WHERE run_by = '${OLD_ADMIN_ID}'::uuid`,
    "payroll_runs.run_by",
  );
  await run(
    `UPDATE payroll_runs SET approved_by = '${NEW_ADMIN_ID}'::uuid WHERE approved_by = '${OLD_ADMIN_ID}'::uuid`,
    "payroll_runs.approved_by",
  );

  await run(
    `UPDATE payslips SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "payslips.employee_id",
  );

  await run(
    `UPDATE consultant_invoices SET consultant_id = '${NEW_ADMIN_ID}'::uuid WHERE consultant_id = '${OLD_ADMIN_ID}'::uuid`,
    "consultant_invoices.consultant_id",
  );

  await run(
    `UPDATE esop_grants SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "esop_grants.employee_id",
  );

  await run(
    `UPDATE onboarding_runs SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "onboarding_runs.employee_id",
  );

  await run(
    `UPDATE training_completions SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "training_completions.employee_id",
  );

  await run(
    `UPDATE visa_records SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "visa_records.employee_id",
  );

  await run(
    `UPDATE benefit_enrollments SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "benefit_enrollments.employee_id",
  );

  await run(
    `UPDATE deals SET owner_id = '${NEW_ADMIN_ID}'::uuid WHERE owner_id = '${OLD_ADMIN_ID}'::uuid`,
    "deals.owner_id",
  );

  await run(
    `UPDATE projects SET owner_id = '${NEW_ADMIN_ID}'::uuid WHERE owner_id = '${OLD_ADMIN_ID}'::uuid`,
    "projects.owner_id",
  );

  await run(
    `UPDATE project_tasks SET owner_id = '${NEW_ADMIN_ID}'::uuid WHERE owner_id = '${OLD_ADMIN_ID}'::uuid`,
    "project_tasks.owner_id",
  );

  await run(
    `UPDATE desk_bookings SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "desk_bookings.employee_id",
  );

  await run(
    `UPDATE room_bookings SET employee_id = '${NEW_ADMIN_ID}'::uuid WHERE employee_id = '${OLD_ADMIN_ID}'::uuid`,
    "room_bookings.employee_id",
  );

  await run(
    `UPDATE assets SET assigned_to = '${NEW_ADMIN_ID}'::uuid WHERE assigned_to = '${OLD_ADMIN_ID}'::uuid`,
    "assets.assigned_to",
  );

  await run(
    `UPDATE channels SET created_by = '${NEW_ADMIN_ID}'::uuid WHERE created_by = '${OLD_ADMIN_ID}'::uuid`,
    "channels.created_by",
  );

  await run(
    `UPDATE messages SET author_id = '${NEW_ADMIN_ID}'::uuid WHERE author_id = '${OLD_ADMIN_ID}'::uuid`,
    "messages.author_id",
  );

  await run(
    `UPDATE wall_posts SET author_id = '${NEW_ADMIN_ID}'::uuid WHERE author_id = '${OLD_ADMIN_ID}'::uuid`,
    "wall_posts.author_id",
  );

  await run(
    `UPDATE wall_comments SET author_id = '${NEW_ADMIN_ID}'::uuid WHERE author_id = '${OLD_ADMIN_ID}'::uuid`,
    "wall_comments.author_id",
  );

  await run(
    `UPDATE company_news SET author_id = '${NEW_ADMIN_ID}'::uuid WHERE author_id = '${OLD_ADMIN_ID}'::uuid`,
    "company_news.author_id",
  );

  await run(
    `UPDATE company_dates SET added_by = '${NEW_ADMIN_ID}'::uuid WHERE added_by = '${OLD_ADMIN_ID}'::uuid`,
    "company_dates.added_by",
  );

  await run(
    `UPDATE investors SET added_by = '${NEW_ADMIN_ID}'::uuid WHERE added_by = '${OLD_ADMIN_ID}'::uuid`,
    "investors.added_by",
  );

  await run(
    `UPDATE data_room_documents SET uploaded_by = '${NEW_ADMIN_ID}'::uuid WHERE uploaded_by = '${OLD_ADMIN_ID}'::uuid`,
    "data_room_documents.uploaded_by",
  );

  await run(
    `UPDATE investor_updates SET sent_by = '${NEW_ADMIN_ID}'::uuid WHERE sent_by = '${OLD_ADMIN_ID}'::uuid`,
    "investor_updates.sent_by",
  );

  await run(
    `UPDATE aria_conversations SET user_id = '${NEW_ADMIN_ID}'::uuid WHERE user_id = '${OLD_ADMIN_ID}'::uuid`,
    "aria_conversations.user_id",
  );

  await run(
    `UPDATE audit_log SET user_id = '${NEW_ADMIN_ID}'::uuid WHERE user_id = '${OLD_ADMIN_ID}'::uuid`,
    "audit_log.user_id",
  );

  await run(
    `UPDATE user_settings SET user_id = '${NEW_ADMIN_ID}'::uuid WHERE user_id = '${OLD_ADMIN_ID}'::uuid`,
    "user_settings.user_id",
  );

  await run(
    `UPDATE module_access SET user_id = '${NEW_ADMIN_ID}'::uuid WHERE user_id = '${OLD_ADMIN_ID}'::uuid`,
    "module_access.user_id",
  );
  await run(
    `UPDATE module_access SET granted_by = '${NEW_ADMIN_ID}'::uuid WHERE granted_by = '${OLD_ADMIN_ID}'::uuid`,
    "module_access.granted_by",
  );

  await run(
    `UPDATE module_owners SET owner_id = '${NEW_ADMIN_ID}'::uuid WHERE owner_id = '${OLD_ADMIN_ID}'::uuid`,
    "module_owners.owner_id",
  );

  await run(
    `UPDATE users SET reporting_to = '${NEW_ADMIN_ID}'::uuid WHERE reporting_to = '${OLD_ADMIN_ID}'::uuid`,
    "users.reporting_to",
  );

  await run(
    `UPDATE sessions SET user_id = '${NEW_ADMIN_ID}'::uuid WHERE user_id = '${OLD_ADMIN_ID}'::uuid`,
    "sessions.user_id",
  );

  await run(
    `UPDATE file_uploads SET uploaded_by = '${NEW_ADMIN_ID}'::uuid WHERE uploaded_by = '${OLD_ADMIN_ID}'::uuid`,
    "file_uploads.uploaded_by",
  );

  // Finally update the user record itself
  console.log("\nUpdating main users table...");
  await run(
    `UPDATE users SET id = '${NEW_ADMIN_ID}'::uuid WHERE id = '${OLD_ADMIN_ID}'::uuid`,
    "users.id",
  );

  console.log("\n✅ Admin user UUID migration complete!");

  // Verify
  const newAdmin = await prisma.user.findUnique({
    where: { id: NEW_ADMIN_ID },
  });
  if (newAdmin) {
    console.log(`Verified: ${newAdmin.email} now has ID ${newAdmin.id}`);
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
