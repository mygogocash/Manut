import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import { excludeDeleted } from "@/infrastructure/soft-delete";

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
      isActive: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.UserSelect;

const detailSelect = {
  ...userSelect,
  timezone: true,
  metadata: true,
  createdAt: true,
  directReports: {
    where: { isActive: true, ...excludeDeleted() },
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
    const where: Prisma.UserWhereInput = {
      isActive: true,
      ...excludeDeleted(),
    };

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
    const where: Prisma.UserWhereInput = {
      isActive: true,
      ...excludeDeleted(),
    };

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
    return prisma.user.findFirst({
      where: { id, isActive: true, ...excludeDeleted() },
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
    return prisma.user.findFirst({
      where: { id, isActive: true, ...excludeDeleted() },
      select: detailSelect,
    });
  }

  async getDepartments() {
    const departments = await prisma.user.groupBy({
      by: ["department"],
      where: {
        isActive: true,
        ...excludeDeleted(),
        department: { not: null },
      },
      _count: { id: true },
      orderBy: { department: "asc" },
    });

    // Department names must originate from clean runtime data. A future
    // configurable catalogue can extend this endpoint once it has its own
    // Manut-owned persistence boundary.
    return departments.flatMap(({ department, _count }) =>
      department ? [{ name: department, count: _count.id }] : [],
    );
  }

  async getOrgChart() {
    const users = await prisma.user.findMany({
      where: { isActive: true, ...excludeDeleted() },
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
