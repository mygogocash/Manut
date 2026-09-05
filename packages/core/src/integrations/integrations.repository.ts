import { eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function findGoogleConnectionByUserId(db: Db, userId: string) {
  const [row] = await db
    .select({
      accountEmail: schema.userGoogleConnections.accountEmail,
      scope: schema.userGoogleConnections.scope,
      expiresAt: schema.userGoogleConnections.expiresAt,
    })
    .from(schema.userGoogleConnections)
    .where(eq(schema.userGoogleConnections.userId, userId))
    .limit(1);
  return row ?? null;
}
