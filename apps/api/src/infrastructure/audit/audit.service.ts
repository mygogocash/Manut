import type { Request } from "express";

import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";

interface AuditLogInput {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  req?: Request;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? input.req?.user?.id,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        details: (input.details ?? {}) as Record<
          string,
          string | number | boolean | null
        >,
        ipAddress:
          input.req?.ip ??
          (input.req?.headers["x-forwarded-for"] as string) ??
          null,
        userAgent: input.req?.headers["user-agent"] ?? null,
      },
    });
  } catch (err) {
    logger.error("Failed to write audit log", { error: err, input });
  }
}
