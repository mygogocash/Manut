import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** Tight pool for Vercel Fluid — avoids exhausting Supabase pooler connections. */
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !process.env.VERCEL) return url;

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "10");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const databaseUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(
    databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : undefined,
  );

globalForPrisma.prisma = prisma;

export { PrismaClient };
export * from "./generated/prisma";

// Re-export common Prisma types that may not be auto-exported
export type { JsonValue, InputJsonValue } from "./generated/prisma/runtime/library";
