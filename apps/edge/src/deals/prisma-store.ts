import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import type { RuntimeBindings } from "../runtime";
import type { DealRecord, DealsStore } from "./store";

function asIsoDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapDeal(raw: {
  id: string;
  company: string;
  contact: string | null;
  value: { toNumber?: () => number } | number | string;
  stage: string;
  probability: number;
  type: string | null;
  country: string | null;
  closeDate: Date | null;
  notes: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: string; name: string | null };
}): DealRecord {
  const value =
    typeof raw.value === "number"
      ? raw.value
      : typeof raw.value === "string"
        ? Number(raw.value)
        : typeof raw.value.toNumber === "function"
          ? raw.value.toNumber()
          : Number(raw.value);

  return {
    id: raw.id,
    company: raw.company,
    contact: raw.contact,
    value,
    stage: raw.stage,
    probability: raw.probability,
    type: raw.type,
    country: raw.country,
    closeDate: asIsoDate(raw.closeDate),
    notes: raw.notes,
    ownerId: raw.ownerId,
    ownerName: raw.owner.name ?? "User",
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
  };
}

export function createPrismaDealsStore(client: PrismaClient): DealsStore {
  return {
    async loadPermissions(userId) {
      const permissions = new Set<string>();
      const userWithRoles = await client.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            include: {
              role: {
                include: { rolePermissions: true },
              },
            },
          },
          moduleAccessGrants: true,
        },
      });
      if (!userWithRoles) return permissions;

      const isSuperAdmin = userWithRoles.userRoles.some(
        (userRole) => userRole.role.isSystem && userRole.role.name === "Admin",
      );
      if (isSuperAdmin) {
        permissions.add("deals:read");
        permissions.add("deals:create");
        permissions.add("deals:update");
        permissions.add("deals:delete");
        permissions.add("deals:manage");
        permissions.add("crm:team-read");
      } else {
        for (const userRole of userWithRoles.userRoles) {
          for (const rolePerm of userRole.role.rolePermissions) {
            permissions.add(rolePerm.permissionCode);
          }
        }
      }

      for (const access of userWithRoles.moduleAccessGrants) {
        if (!access.granted) {
          for (const perm of [...permissions]) {
            if (perm.startsWith(`${access.moduleId}:`)) {
              permissions.delete(perm);
            }
          }
        }
      }

      return permissions;
    },

    async findMany(filters, page, limit) {
      const where: {
        company?: { contains: string; mode: "insensitive" };
        stage?: string;
        type?: string;
        ownerId?: { in: string[] };
      } = {};

      if (filters.search) {
        where.company = { contains: filters.search, mode: "insensitive" };
      }
      if (filters.stage) where.stage = filters.stage;
      if (filters.type) where.type = filters.type;
      if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };

      const [data, total] = await Promise.all([
        client.deal.findMany({
          where,
          include: {
            owner: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.deal.count({ where }),
      ]);

      return { data: data.map(mapDeal), total };
    },

    async create(input) {
      const row = await client.deal.create({
        data: {
          company: input.company,
          contact: input.contact,
          value: input.value,
          stage: input.stage,
          probability: input.probability,
          type: input.type,
          country: input.country,
          notes: input.notes,
          closeDate: input.closeDate ? new Date(input.closeDate) : undefined,
          owner: { connect: { id: input.ownerId } },
          partner: input.partnerId
            ? { connect: { id: input.partnerId } }
            : undefined,
        },
        include: {
          owner: { select: { id: true, name: true } },
        },
      });
      return mapDeal(row);
    },
  };
}

export function createHyperdriveDealsStore(env: RuntimeBindings): DealsStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaDealsStore(client);
}
