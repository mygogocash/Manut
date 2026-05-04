import { PrismaClient } from '@prisma/client';

/**
 * Adds the `BudgetSoftCap` value to the existing `NotificationType` Postgres
 * enum so the Analytics platform's per-workspace AI budget service
 * (docs/analytics-platform.md §7) can surface its 80%-spend alert through
 * the regular in-app notification feed instead of just `logger.warn`.
 *
 * Idempotent: `ADD VALUE IF NOT EXISTS` is a no-op when the value is
 * already present, so re-running this migration on an upgraded cluster
 * is safe.
 */
export class AddBudgetSoftCapNotification1746345700000 {
  static async up(db: PrismaClient) {
    await db.$executeRawUnsafe(
      `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BudgetSoftCap';`
    );
  }

  static async down(_db: PrismaClient) {
    // Postgres has no DROP VALUE for an enum; leaving this as a no-op is
    // intentional. Removing the value would require recreating the enum
    // and rewriting every row, which is out of scope for a rollback.
  }
}
