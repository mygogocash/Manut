import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const includes = {
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      employeeId: true,
    },
  },
} satisfies Prisma.AttendanceCorrectionInclude;

export const attendanceCorrectionRepository = {
  async create(data: Prisma.AttendanceCorrectionUncheckedCreateInput) {
    return prisma.attendanceCorrection.create({ data, include: includes });
  },

  async findById(id: string) {
    return prisma.attendanceCorrection.findUnique({
      where: { id },
      include: includes,
    });
  },

  async findMany(
    where: Prisma.AttendanceCorrectionWhereInput,
    page: number,
    limit: number,
  ) {
    const [data, total] = await Promise.all([
      prisma.attendanceCorrection.findMany({
        where,
        include: includes,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendanceCorrection.count({ where }),
    ]);
    return { data, total };
  },

  async update(
    id: string,
    data: Prisma.AttendanceCorrectionUncheckedUpdateInput,
  ) {
    return prisma.attendanceCorrection.update({
      where: { id },
      data,
      include: includes,
    });
  },

  async countPendingForEmployeeIds(employeeIds: string[]) {
    if (!employeeIds.length) return 0;
    return prisma.attendanceCorrection.count({
      where: { employeeId: { in: employeeIds }, status: "pending" },
    });
  },
};
