import { prisma } from "../src/index";

function quoteTableName(tableName: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(tableName)) {
    throw new Error(`Unsafe public table name: ${tableName}`);
  }
  return `"${tableName}"`;
}

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
  const rows = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  const tables = rows.map(({ tableName }) => quoteTableName(tableName));

  console.log("=== Step 1: Enable RLS on all tables ===\n");
  for (const table of tables) {
    await run(
      `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
      `RLS enabled: ${table}`,
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

  for (const table of tables) {
    await run(
      `CREATE POLICY "service_role_full_access" ON public.${table}
       FOR ALL
       USING (public.is_service_role())
       WITH CHECK (public.is_service_role())`,
      `Policy: ${table}`,
    );
  }

  console.log("\n=== Done ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
