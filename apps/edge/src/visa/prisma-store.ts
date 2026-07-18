import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import type { VisaListRecord, VisaStore } from "./store";

function asDate(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

const ADMIN_EXTRAS = ["visa:read", "visa:hr-read", "visa:manage"] as const;

function parseDocuments(value: unknown): Array<{ name: string; category: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "document",
      category: typeof item.category === "string" ? item.category : "other",
    }));
}

export function createPrismaVisaStore(client: PrismaClient): VisaStore {
  return {
    async loadPermissions(userId) {
      return loadUserPermissions(client, userId, ADMIN_EXTRAS);
    },

    async findMany(filters, page, limit) {
      const where: {
        deletedAt: null;
        employeeId: string;
        status?: string;
        OR?: Array<Record<string, unknown>>;
      } = {
        deletedAt: null,
        employeeId: filters.employeeId,
      };
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        const search = filters.search;
        where.OR = [
          { visaType: { contains: search, mode: "insensitive" } },
          { country: { contains: search, mode: "insensitive" } },
          { holderName: { contains: search, mode: "insensitive" } },
          { nationality: { contains: search, mode: "insensitive" } },
        ];
      }

      const [rows, total] = await Promise.all([
        client.visaRecord.findMany({
          where,
          include: {
            employee: { select: { id: true, name: true, email: true } },
            entity: { select: { id: true, name: true } },
          },
          orderBy: { expiryDate: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.visaRecord.count({ where }),
      ]);

      const data: VisaListRecord[] = rows.map((row) => ({
        id: row.id,
        holderType: row.holderType,
        holderName: row.holderName,
        holderRelationship: row.holderRelationship,
        visaType: row.visaType,
        country: row.country,
        nationality: row.nationality,
        issueDate: asDate(row.issueDate),
        expiryDate: asDate(row.expiryDate) ?? "",
        workPermitExpiryDate: asDate(row.workPermitExpiryDate),
        status: row.status,
        documentUrl: row.documentUrl,
        documents: parseDocuments(row.documents),
        employeeId: row.employee.id,
        employeeName: row.employee.name ?? "User",
        employeeEmail: row.employee.email,
        entityId: row.entity?.id ?? null,
        entityName: row.entity?.name ?? null,
      }));

      return { data, total };
    },
  };
}

export function createHyperdriveVisaStore(env: RuntimeBindings): VisaStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaVisaStore(client);
}
