import { PERMISSIONS } from "@/common/constants/permissions";
import { ForbiddenException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type { AttendanceExceptionDto } from "@/modules/hrms/attendance.types";
import type {
  CreateExceptionInput,
  ExceptionsQuery,
} from "@/modules/hrms/attendance-phase2.validation";

function serializeException(row: {
  id: string;
  employeeId: string;
  type: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  employee?: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    employeeId: string | null;
  };
}): AttendanceExceptionDto {
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type as AttendanceExceptionDto["type"],
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    reason: row.reason,
    status: row.status,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    employee: row.employee,
  };
}

export const attendanceExceptionService = {
  async list(
    actorId: string,
    actorPermissions: string[],
    query: ExceptionsQuery,
  ) {
    const canManage =
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE) ||
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE);

    const where = {
      ...(canManage && query.employeeId
        ? { employeeId: query.employeeId }
        : canManage
          ? {}
          : { employeeId: actorId }),
    };

    const [data, total] = await Promise.all([
      prisma.attendanceException.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
              employeeId: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.attendanceException.count({ where }),
    ]);

    return {
      data: data.map(serializeException),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  },

  async create(
    actorId: string,
    actorPermissions: string[],
    input: CreateExceptionInput,
  ) {
    const canManage =
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE) ||
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE);

    const targetEmployeeId = input.employeeId ?? actorId;
    if (targetEmployeeId !== actorId && !canManage) {
      throw new ForbiddenException(
        "You cannot create exceptions for other employees",
      );
    }

    const row = await prisma.attendanceException.create({
      data: {
        employeeId: targetEmployeeId,
        type: input.type,
        startDate: new Date(`${input.startDate}T00:00:00.000Z`),
        endDate: new Date(`${input.endDate}T00:00:00.000Z`),
        reason: input.reason,
        status: canManage ? "approved" : "pending",
        approvedBy: canManage ? actorId : null,
        approvedAt: canManage ? new Date() : null,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true,
          },
        },
      },
    });

    return serializeException(row);
  },
};
