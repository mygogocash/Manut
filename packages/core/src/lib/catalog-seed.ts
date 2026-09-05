/** Lazy backfill when a config catalog table is empty (db:push skips seed SQL). */
export async function ensureCatalogSeeded<T>(
  findAll: () => Promise<T[]>,
  seed: () => Promise<void>,
): Promise<T[]> {
  const rows = await findAll();
  if (rows.length > 0) return rows;
  await seed();
  return findAll();
}
