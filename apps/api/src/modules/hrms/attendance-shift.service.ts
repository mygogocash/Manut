import { NotFoundException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type { AttendanceShiftDto } from "@/modules/hrms/attendance.types";
import type {
  AssignShiftInput,
  CreateShiftInput,
  UpdateShiftInput,
} from "@/modules/hrms/attendance-phase2.validation";
import type { BulkAssignShiftInput } from "@/modules/hrms/attendance-phase3.validation";

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

export const attendanceShiftService = {
  async list(entityId?: string | null) {
    const rows = await prisma.attendanceShift.findMany({
      where: {
        active: true,
        ...(entityId !== undefined
          ? { OR: [{ entityId }, { entityId: null }] }
          : {}),
      },
      orderBy: { shiftName: "asc" },
    });
    return rows.map(serializeShift);
  },

  async create(input: CreateShiftInput) {
    const row = await prisma.attendanceShift.create({
      data: {
        entityId: input.entityId ?? null,
        shiftName: input.shiftName,
        startTime: input.startTime,
        endTime: input.endTime,
        graceMinutes: input.graceMinutes,
        active: input.active,
      },
    });
    return serializeShift(row);
  },

  async update(id: string, input: UpdateShiftInput) {
    const existing = await prisma.attendanceShift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Shift not found");
    const row = await prisma.attendanceShift.update({
      where: { id },
      data: input,
    });
    return serializeShift(row);
  },

  async assign(input: AssignShiftInput) {
    const shift = await prisma.attendanceShift.findUnique({
      where: { id: input.shiftId },
    });
    if (!shift) throw new NotFoundException("Shift not found");

    return prisma.attendanceEmployeeShift.create({
      data: {
        employeeId: input.employeeId,
        shiftId: input.shiftId,
        effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
        effectiveTo: input.effectiveTo
          ? new Date(`${input.effectiveTo}T00:00:00.000Z`)
          : null,
      },
    });
  },

  async getEmployeeShift(employeeId: string, date: Date) {
    return prisma.attendanceEmployeeShift.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      include: { shift: true },
      // createdAt as a deterministic tiebreaker so two assignments sharing the
      // same effectiveFrom resolve to the most recently created one, not an
      // arbitrary row.
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
  },

  async listAssignments(entityId?: string | null) {
    const rows = await prisma.attendanceEmployeeShift.findMany({
      where: entityId ? { employee: { entityId } } : undefined,
      include: {
        shift: true,
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
      orderBy: [{ effectiveFrom: "desc" }, { employee: { name: "asc" } }],
    });
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      shiftId: r.shiftId,
      shiftName: r.shift.shiftName,
      startTime: r.shift.startTime,
      endTime: r.shift.endTime,
      effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: r.effectiveTo?.toISOString().slice(0, 10) ?? null,
      employee: r.employee,
    }));
  },

  async bulkAssign(input: BulkAssignShiftInput) {
    const shift = await prisma.attendanceShift.findUnique({
      where: { id: input.shiftId },
    });
    if (!shift) throw new NotFoundException("Shift not found");

    const created = await prisma.$transaction(
      input.employeeIds.map((employeeId) =>
        prisma.attendanceEmployeeShift.create({
          data: {
            employeeId,
            shiftId: input.shiftId,
            effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
            effectiveTo: input.effectiveTo
              ? new Date(`${input.effectiveTo}T00:00:00.000Z`)
              : null,
          },
        }),
      ),
    );
    return { count: created.length };
  },

  async changeAssignment(
    id: string,
    input: {
      shiftId?: string;
      effectiveFrom?: string;
      effectiveTo?: string | null;
    },
  ) {
    const existing = await prisma.attendanceEmployeeShift.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Shift assignment not found");

    if (input.shiftId) {
      const shift = await prisma.attendanceShift.findUnique({
        where: { id: input.shiftId },
      });
      if (!shift) throw new NotFoundException("Shift not found");
    }

    return prisma.attendanceEmployeeShift.update({
      where: { id },
      data: {
        ...(input.shiftId ? { shiftId: input.shiftId } : {}),
        ...(input.effectiveFrom
          ? {
              effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
            }
          : {}),
        ...(input.effectiveTo !== undefined
          ? {
              effectiveTo: input.effectiveTo
                ? new Date(`${input.effectiveTo}T00:00:00.000Z`)
                : null,
            }
          : {}),
      },
      include: { shift: true },
    });
  },
};
