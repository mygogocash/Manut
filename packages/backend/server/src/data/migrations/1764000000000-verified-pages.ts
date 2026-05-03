import { PrismaClient } from '@prisma/client';

export class VerifiedPages1764000000000 {
  // do the migration
  static async up(db: PrismaClient) {
    await db.$executeRawUnsafe(`
      ALTER TABLE workspace_pages
        ADD COLUMN IF NOT EXISTS verified_at            TIMESTAMPTZ(3),
        ADD COLUMN IF NOT EXISTS verified_by            VARCHAR,
        ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ(3)
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS workspace_pages_workspace_id_verified_at_idx
        ON workspace_pages (workspace_id, verified_at)
    `);
  }

  // revert the migration
  static async down(db: PrismaClient) {
    await db.$executeRawUnsafe(`
      DROP INDEX IF EXISTS workspace_pages_workspace_id_verified_at_idx
    `);

    await db.$executeRawUnsafe(`
      ALTER TABLE workspace_pages
        DROP COLUMN IF EXISTS verified_at,
        DROP COLUMN IF EXISTS verified_by,
        DROP COLUMN IF EXISTS verification_expires_at
    `);
  }
}
