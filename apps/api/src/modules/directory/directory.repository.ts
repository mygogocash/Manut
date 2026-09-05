import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  phone: true,
  phonePublic: true,
  department: true,
  jobTitle: true,
  employeeId: true,
  employmentType: true,
  location: true,
  country: true,
  isActive: true,
  startDate: true,
  salary: true,
  currency: true,
  entity: { select: { id: true, name: true, code: true } },
  manager: {
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.UserSelect;

const detailSelect = {
  ...userSelect,
  timezone: true,
  metadata: true,
  createdAt: true,
  directReports: {
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      jobTitle: true,
      avatarUrl: true,
      department: true,
    },
  },
  userRoles: {
    select: { role: { select: { id: true, name: true } } },
  },
} satisfies Prisma.UserSelect;

export class DirectoryRepository {
  async findAllEmployees(
    filters: {
      search?: string;
      entityId?: string;
      department?: string;
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.UserWhereInput = { isActive: true };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { department: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.department) where.department = filters.department;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total };
  }

  // Minimal projection for assignee pickers (Owner / Approver /
  // Reporter combos). Excludes every HR-sensitive field so the
  // endpoint can be called without `directory:read`.
  async findAssignable(
    filters: { search?: string; entityId?: string; department?: string },
    page: number,
    limit: number,
  ) {
    const where: Prisma.UserWhereInput = { isActive: true };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.department) where.department = filters.department;

    const select = {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      jobTitle: true,
    } satisfies Prisma.UserSelect;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total };
  }

  async findAssignableById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        jobTitle: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: detailSelect,
    });
  }

  async getDepartments() {
    const departments = await prisma.user.groupBy({
      by: ["department"],
      where: { isActive: true, department: { not: null } },
      _count: { id: true },
      orderBy: { department: "asc" },
    });

    // Canonical list — keep this in sync with the employee form
    // dropdown so HR can filter by an empty department before any
    // users are assigned to it. Otherwise the dropdown collapses to
    // whatever names happen to be present (e.g. "Operations" only on
    // a freshly-seeded prod DB).
    const CANONICAL = [
      "Management",
      "Legal",
      "Marketing",
      "HR",
      "Accounting",
      "Finance",
      "Product",
      "Project Management",
      "Digital Social",
      "Business Team",
      "IT",
    ];

    const counts = new Map<string, number>();
    for (const d of departments) {
      if (d.department) counts.set(d.department, d._count.id);
    }

    const result: Array<{ name: string; count: number }> = [];
    const seen = new Set<string>();
    for (const name of CANONICAL) {
      result.push({ name, count: counts.get(name) ?? 0 });
      seen.add(name);
    }
    // Surface any free-text department that admins typed but isn't in
    // the canonical list (e.g. "Operations" from older seeds).
    for (const [name, count] of counts) {
      if (!seen.has(name)) result.push({ name, count });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getOrgChart() {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        department: true,
        avatarUrl: true,
        reportingTo: true,
        entity: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: "asc" },
    });

    return users;
  }
}

export const directoryRepository = new DirectoryRepository();
