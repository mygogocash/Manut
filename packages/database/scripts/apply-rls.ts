import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL,
});

const TABLES = [
  "entities",
  "users",
  "sessions",
  "roles",
  "user_roles",
  "role_permissions",
  "module_access",
  "module_owners",
  "leave_types",
  "leave_balances",
  "leave_requests",
  "payroll_runs",
  "payslips",
  "consultant_invoices",
  "esop_grants",
  "onboarding_runs",
  "training_modules",
  "training_completions",
  "visa_records",
  "benefits",
  "benefit_enrollments",
  "chart_of_accounts",
  "journal_entries",
  "journal_entry_lines",
  "invoices",
  "bank_transactions",
  "bnry_transactions",
  "expense_categories",
  "expenses",
  "partners",
  "partner_contacts",
  "deals",
  "projects",
  "project_tasks",
  "offices",
  "office_desks",
  "desk_bookings",
  "meeting_rooms",
  "room_bookings",
  "assets",
  "channels",
  "messages",
  "wall_posts",
  "wall_comments",
  "company_news",
  "company_dates",
  "aria_conversations",
  "aria_messages",
  "investors",
  "investments",
  "data_room_documents",
  "investor_updates",
  "audit_log",
  "user_settings",
  "system_settings",
  "file_uploads",
];

async function run(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`✓ ${label}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists")) {
      console.log(`⊘ ${label} (already exists)`);
    } else {
      console.error(`✗ ${label}: ${msg}`);
    }
  }
}

async function main() {
  console.log("=== Step 1: Enable RLS on all tables ===\n");
  for (const t of TABLES) {
    await run(
      `ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY`,
      `RLS enabled: ${t}`,
    );
  }

  console.log("\n=== Step 2: Revoke anon/authenticated access ===\n");
  await run(
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon`,
    "Revoke anon on all tables",
  );
  await run(
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated`,
    "Revoke authenticated on all tables",
  );
  await run(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon`,
    "Revoke anon on future tables",
  );
  await run(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated`,
    "Revoke authenticated on future tables",
  );

  console.log("\n=== Step 3: Create service_role policies ===\n");

  await run(
    `CREATE OR REPLACE FUNCTION public.is_service_role()
     RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
     SET search_path = ''
     AS $fn$
       SELECT current_setting('role', true) IN ('service_role', 'supabase_admin')
           OR current_user = 'postgres';
     $fn$`,
    "Create is_service_role() function",
  );

  for (const t of TABLES) {
    await run(
      `CREATE POLICY "service_role_full_access" ON public."${t}"
       FOR ALL
       USING (public.is_service_role())
       WITH CHECK (public.is_service_role())`,
      `Policy: ${t}`,
    );
  }

  console.log("\n=== Done ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
