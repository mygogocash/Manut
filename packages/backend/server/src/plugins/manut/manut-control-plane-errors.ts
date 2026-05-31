import { InternalServerError } from '../../base';

/**
 * Prisma error codes that mean the Manut control-plane schema is not
 * provisioned in the connected database:
 *  - P2021: the table does not exist in the current database.
 *  - P2022: the column does not exist in the current database.
 *
 * These surface when the gated mn_* / social_analytics migrations have not
 * been applied to the deployed DB (production migration drift). A raw
 * Prisma error escapes as the generic "Unhandled error raised"; mapping it
 * to a typed UserFriendlyError gives the operator an actionable message.
 *
 * See docs/manut-bughunt/HANDOFF.md Bug #1 and CLAUDE.md §6 (NestJS DI /
 * migration-drift traps).
 */
const MISSING_SCHEMA_PRISMA_CODES = new Set(['P2021', 'P2022']);

const CONTROL_PLANE_NOT_PROVISIONED_MESSAGE =
  'Manut control plane is not provisioned for this server. The required ' +
  'database tables are missing — apply the pending Prisma migrations ' +
  '(prisma migrate deploy) and ensure ENABLE_MANUT_MODULE=true.';

function isMissingSchemaPrismaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && MISSING_SCHEMA_PRISMA_CODES.has(code);
}

/**
 * Runs a control-plane Prisma read/write and remaps "missing table/column"
 * Prisma errors (P2021/P2022) to a friendly typed error. All other errors
 * propagate unchanged so genuine bugs are not masked.
 */
export async function withControlPlaneErrorMapping<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isMissingSchemaPrismaError(error)) {
      throw new InternalServerError(CONTROL_PLANE_NOT_PROVISIONED_MESSAGE);
    }
    throw error;
  }
}
