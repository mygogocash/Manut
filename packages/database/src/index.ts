import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ??
    (process.env.NODE_ENV === "test"
      ? "postgresql://manut:manut@127.0.0.1:5432/manut_test"
      : undefined);

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export * from "./generated/prisma/client";

// Keep the package-level aliases used by API modules while Prisma 7 exposes
// these through its generated namespace.
export type JsonValue = Prisma.JsonValue;
export type InputJsonValue = Prisma.InputJsonValue;
