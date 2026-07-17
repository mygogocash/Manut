import { randomUUID } from "node:crypto";

import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import { buildPartnerSlug } from "@/modules/partners/partner-slug";

const ownerSelect = { id: true, name: true, email: true } as const;

const partnerListIncludes = {
  owner: { select: ownerSelect },
  _count: { select: { projects: true, deals: true } },
} satisfies Prisma.PartnerInclude;

const partnerIncludes = {
  contacts: true,
  owner: { select: ownerSelect },
  _count: { select: { projects: true, deals: true } },
} satisfies Prisma.PartnerInclude;

export class PartnerRepository {
  async findMany(
    filters: {
      type?: string;
      status?: string;
      department?: string;
      search?: string;
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.PartnerWhereInput = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.department) where.department = filters.department;
    if (filters.search) {
      where.company = { contains: filters.search, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        include: partnerListIncludes,
        // Mirror the Projects dashboard: user-driven manual order is
        // primary; createdAt is the deterministic tie-breaker so two
        // partners with the same sort_order (e.g. fresh inserts at 0)
        // stay stable across re-renders.
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.partner.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.partner.findUnique({
      where: { id },
      include: partnerIncludes,
    });
  }

  async findByIdOrSlug(idOrSlug: string) {
    return prisma.partner.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: partnerIncludes,
    });
  }

  // Flat task list across many partners for the Tasks export. Top-level
  // rows precede their subtasks (parentTaskId asc nulls-first).
  async findTasksByPartnerIds(partnerIds: string[]) {
    if (partnerIds.length === 0) return [];
    return prisma.partnerTask.findMany({
      where: { partnerId: { in: partnerIds } },
      include: {
        partner: { select: { company: true } },
        owner: { select: { id: true, name: true } },
        parent: { select: { title: true } },
      },
      orderBy: [
        { partnerId: "asc" },
        { parentTaskId: { sort: "asc", nulls: "first" } },
        { sortOrder: "asc" },
      ],
    });
  }

  async createTaskRaw(data: Prisma.PartnerTaskUncheckedCreateInput) {
    return prisma.partnerTask.create({ data });
  }

  /**
   * Bulk-set `sortOrder` from the supplied id sequence. Ids absent
   * from the table are silently dropped (matches how the Projects
   * reorder behaves so a stale client list doesn't corrupt the
   * server-side order). Returns the persisted (id, sortOrder) pairs
   * for the caller to mirror into its local state.
   */
  async reorder(ids: string[]) {
    const known = await prisma.partner.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const knownSet = new Set(known.map((p) => p.id));
    const filtered = ids.filter((id) => knownSet.has(id));

    await prisma.$transaction(
      filtered.map((id, idx) =>
        prisma.partner.update({
          where: { id },
          data: { sortOrder: idx },
        }),
      ),
    );

    return filtered.map((id, idx) => ({ id, sortOrder: idx }));
  }

  async create(
    data: Omit<Prisma.PartnerCreateInput, "contacts" | "slug"> & {
      contacts?: Array<{
        name: string;
        title?: string;
        email?: string;
        phone?: string;
        isPrimary: boolean;
      }>;
    },
  ) {
    const { contacts, ...partnerData } = data;
    return prisma.$transaction(async (tx) => {
      const created = await tx.partner.create({
        data: {
          ...partnerData,
          slug: `__pending_${randomUUID()}`,
          contacts: contacts?.length
            ? { createMany: { data: contacts } }
            : undefined,
        },
        include: partnerIncludes,
      });
      return tx.partner.update({
        where: { id: created.id },
        data: { slug: buildPartnerSlug(created.company, created.id) },
        include: partnerIncludes,
      });
    });
  }

  async update(
    id: string,
    data: Omit<Prisma.PartnerUpdateInput, "contacts"> & {
      contacts?: Array<{
        name: string;
        title?: string;
        email?: string;
        phone?: string;
        isPrimary: boolean;
      }>;
    },
  ) {
    const { contacts, ...partnerData } = data;
    return prisma.$transaction(async (tx) => {
      if (contacts !== undefined) {
        await tx.partnerContact.deleteMany({ where: { partnerId: id } });
        if (contacts.length) {
          await tx.partnerContact.createMany({
            data: contacts.map((c) => ({ ...c, partnerId: id })),
          });
        }
      }
      return tx.partner.update({
        where: { id },
        data: partnerData,
        include: partnerIncludes,
      });
    });
  }

  async delete(id: string) {
    return prisma.partner.delete({ where: { id } });
  }

  async findContacts(partnerId: string) {
    return prisma.partnerContact.findMany({
      where: { partnerId },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });
  }

  async findContactById(contactId: string) {
    return prisma.partnerContact.findUnique({ where: { id: contactId } });
  }

  async createContact(
    partnerId: string,
    data: {
      name: string;
      email?: string;
      phone?: string;
      role?: string;
      isPrimary: boolean;
    },
  ) {
    return prisma.partnerContact.create({
      data: { ...data, partnerId },
    });
  }

  async updateContact(
    contactId: string,
    data: Prisma.PartnerContactUncheckedUpdateInput,
  ) {
    return prisma.partnerContact.update({
      where: { id: contactId },
      data,
    });
  }

  async deleteContact(contactId: string) {
    return prisma.partnerContact.delete({ where: { id: contactId } });
  }
}

export const partnerRepository = new PartnerRepository();
