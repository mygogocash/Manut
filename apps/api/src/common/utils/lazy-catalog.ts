/**
 * Lazy backfill for a config catalog whose rows ship as an INSERT inside a
 * migration.
 *
 * Those INSERTs only ever execute where `prisma migrate deploy` runs — i.e.
 * production. Staging syncs with `pnpm db:push:staging` (deploy-staging.yml),
 * which reconciles the SCHEMA and never executes migration SQL, so the table is
 * created EMPTY there and nothing fills it. Local databases built with
 * `db:push` have the same hole. The symptom is a feature that looks absent
 * rather than broken: an empty pipeline board renders zero columns, and an
 * empty entity catalog makes the switcher return null.
 *
 * `seed` runs only when the table is COMPLETELY empty, so a catalog an admin
 * deliberately pruned is never repopulated.
 *
 * Both reads are null-guarded so a repository yielding nothing degrades to
 * "empty catalog" instead of throwing out of a read path.
 */
export async function ensureCatalogSeeded<T>(opts: {
  findAll: () => Promise<T[] | null | undefined>;
  seed: () => Promise<unknown>;
}): Promise<T[]> {
  const existing = (await opts.findAll()) ?? [];
  if (existing.length > 0) return existing;
  await opts.seed();
  return (await opts.findAll()) ?? [];
}
