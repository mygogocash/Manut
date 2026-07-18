import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

/**
 * Build a Prisma client for an explicit Postgres connection string.
 * Workers must pass Hyperdrive `connectionString` only — never a client
 * `DATABASE_URL` fallback.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const trimmed = connectionString.trim();
  if (!trimmed) {
    throw new Error("connectionString is required to initialize Prisma");
  }

  const adapter = new PrismaPg({
    connectionString: trimmed,
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}
