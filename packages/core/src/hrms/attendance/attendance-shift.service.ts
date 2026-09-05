import type { Db } from "@nexora/db";
import { NotFoundException } from "../../http-exception.js";
import * as metaRepo from "./attendance-meta.repository.js";
import type { AttendanceShiftDto } from "@nexora/contracts/modules/hrms/attendance.types";
import type {
  AssignShiftInput,
  CreateShiftInput,
  UpdateShiftInput,
} from "@nexora/contracts/modules/hrms/attendance-phase2.validation";
import type { BulkAssignShiftInput } from "@nexora/contracts/modules/hrms/attendance-phase3.validation";

function serializeShift(row: {
  id: string;
  entityId: string | null;
  shiftName: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  active: boolean;
}): AttendanceShiftDto {
  return {
    id: row.id,
    entityId: row.entityId,
    shiftName: row.shiftName,
    startTime: row.startTime,
    endTime: row.endTime,
    graceMinutes: row.graceMinutes,
    active: row.active,
  };
}

export async function listShifts(db: Db, entityId?: string | null) {
  const rows = await metaRepo.listShifts(db, entityId);
  return rows.map(serializeShift);
}

export async function createShift(db: Db, input: CreateShiftInput) {
  const row = await metaRepo.createShift(db, {
    entityId: input.entityId ?? null,
    shiftName: input.shiftName,
    startTime: input.startTime,
    endTime: input.endTime,
    graceMinutes: input.graceMinutes,
    active: input.active,
  });
  if (!row) throw new NotFoundException("Failed to create shift");
  return serializeShift(row);
}

export async function updateShift(db: Db, id: string, input: UpdateShiftInput) {
  const existing = await metaRepo.findShiftById(db, id);
  if (!existing) throw new NotFoundException("Shift not found");
  const row = await metaRepo.updateShift(db, id, input);
  if (!row) throw new NotFoundException("Shift not found");
  return serializeShift(row);
}

export async function assignShift(db: Db, input: AssignShiftInput) {
  const shift = await metaRepo.findShiftById(db, input.shiftId);
  if (!shift) throw new NotFoundException("Shift not found");
  return metaRepo.createEmployeeShift(db, {
    employeeId: input.employeeId,
    shiftId: input.shiftId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
  });
}

export async function getEmployeeShift(db: Db, employeeId: string, date: Date) {
  const ymd = date.toISOString().slice(0, 10);
  return metaRepo.findEmployeeShiftOnDate(db, employeeId, ymd);
}

export async function listAssignments(db: Db, entityId?: string | null) {
  const rows = await metaRepo.listShiftAssignments(db, entityId);
  return rows.map((r) => ({
    id: r.assignment.id,
    employeeId: r.assignment.employeeId,
    shiftId: r.assignment.shiftId,
    shiftName: r.shift.shiftName,
    startTime: r.shift.startTime,
    endTime: r.shift.endTime,
    effectiveFrom: String(r.assignment.effectiveFrom).slice(0, 10),
    effectiveTo: r.assignment.effectiveTo ? String(r.assignment.effectiveTo).slice(0, 10) : null,
    employee: r.employee,
  }));
}

export async function bulkAssign(db: Db, input: BulkAssignShiftInput) {
  const shift = await metaRepo.findShiftById(db, input.shiftId);
  if (!shift) throw new NotFoundException("Shift not found");
  let count = 0;
  for (const employeeId of input.employeeIds) {
    await metaRepo.createEmployeeShift(db, {
      employeeId,
      shiftId: input.shiftId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
    });
    count += 1;
  }
  return { count };
}

export async function changeAssignment(
  db: Db,
  id: string,
  input: { shiftId?: string; effectiveFrom?: string; effectiveTo?: string | null },
) {
  const existing = await metaRepo.findEmployeeShiftById(db, id);
  if (!existing) throw new NotFoundException("Shift assignment not found");
  if (input.shiftId) {
    const shift = await metaRepo.findShiftById(db, input.shiftId);
    if (!shift) throw new NotFoundException("Shift not found");
  }
  return metaRepo.updateEmployeeShift(db, id, {
    ...(input.shiftId ? { shiftId: input.shiftId } : {}),
    ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}),
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
  });
}
