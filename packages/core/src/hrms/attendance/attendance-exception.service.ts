import type { Db } from "@nexora/db";
import { PERMISSIONS } from "@nexora/contracts";
import { ForbiddenException } from "../../http-exception.js";
import * as metaRepo from "./attendance-meta.repository.js";
import type { AttendanceExceptionDto } from "@nexora/contracts/modules/hrms/attendance.types";
import type {
  CreateExceptionInput,
  ExceptionsQuery,
} from "@nexora/contracts/modules/hrms/attendance-phase2.validation";

function serializeException(row: {
  id: string;
  employeeId: string;
  type: string;
  startDate: string | Date;
  endDate: string | Date;
  reason: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | Date | null;
  createdAt: string | Date;
  employee?: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    employeeId: string | null;
  } | null;
}): AttendanceExceptionDto {
  const iso = (v: string | Date | null | undefined) =>
    v == null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString();
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type as AttendanceExceptionDto["type"],
    startDate: String(row.startDate).slice(0, 10),
    endDate: String(row.endDate).slice(0, 10),
    reason: row.reason,
    status: row.status,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt ? iso(row.approvedAt) : null,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    employee: row.employee ?? undefined,
  };
}

export async function listExceptions(
  db: Db,
  actorId: string,
  actorPermissions: string[],
  query: ExceptionsQuery,
) {
  const canManage =
    actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE) ||
    actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE);

  const where = {
    employeeId:
      canManage && query.employeeId
        ? query.employeeId
        : canManage
          ? undefined
          : actorId,
  };

  const { data, total } = await metaRepo.listExceptions(db, where, query.page, query.limit);

  return {
    data: data.map(serializeException),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  };
}

export async function createException(
  db: Db,
  actorId: string,
  actorPermissions: string[],
  input: CreateExceptionInput,
) {
  const canManage =
    actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE) ||
    actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE);

  const targetEmployeeId = input.employeeId ?? actorId;
  if (targetEmployeeId !== actorId && !canManage) {
    throw new ForbiddenException("You cannot create exceptions for other employees");
  }

  const now = new Date().toISOString();
  const row = await metaRepo.createException(db, {
    employeeId: targetEmployeeId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason,
    status: canManage ? "approved" : "pending",
    approvedBy: canManage ? actorId : null,
    approvedAt: canManage ? now : null,
  });
  if (!row) throw new ForbiddenException("Failed to create exception");
  return serializeException(row);
}
