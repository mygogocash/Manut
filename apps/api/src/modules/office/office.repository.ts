import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

export class OfficeRepository {
  async findOffices() {
    return prisma.office.findMany({
      orderBy: { name: "asc" },
    });
  }

  async findOfficeById(id: string) {
    return prisma.office.findUnique({ where: { id } });
  }

  async createOffice(data: Prisma.OfficeUncheckedCreateInput) {
    return prisma.office.create({ data });
  }

  async updateOffice(id: string, data: Prisma.OfficeUncheckedUpdateInput) {
    return prisma.office.update({ where: { id }, data });
  }

  async deleteOffice(id: string) {
    return prisma.office.delete({ where: { id } });
  }

  async findDesks(filters: { officeId?: string; floor?: string }) {
    const where: Prisma.OfficeDeskWhereInput = { isActive: true };
    if (filters.officeId) where.officeId = filters.officeId;
    if (filters.floor) where.floor = filters.floor;

    return prisma.officeDesk.findMany({
      where,
      include: {
        office: { select: { id: true, name: true, city: true } },
      },
      orderBy: [{ office: { name: "asc" } }, { name: "asc" }],
    });
  }

  async findAllDesks(filters: { officeId?: string }) {
    const where: Prisma.OfficeDeskWhereInput = {};
    if (filters.officeId) where.officeId = filters.officeId;

    return prisma.officeDesk.findMany({
      where,
      include: {
        office: { select: { id: true, name: true, city: true } },
      },
      orderBy: [{ office: { name: "asc" } }, { name: "asc" }],
    });
  }

  async findDeskBookingsForDate(date: Date) {
    return prisma.deskBooking.findMany({
      where: { date },
      select: {
        id: true,
        deskId: true,
        employeeId: true,
        employee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findDeskById(id: string) {
    return prisma.officeDesk.findUnique({ where: { id } });
  }

  async createDesk(data: Prisma.OfficeDeskUncheckedCreateInput) {
    return prisma.officeDesk.create({
      data,
      include: { office: { select: { id: true, name: true, city: true } } },
    });
  }

  async updateDesk(id: string, data: Prisma.OfficeDeskUncheckedUpdateInput) {
    return prisma.officeDesk.update({
      where: { id },
      data,
      include: { office: { select: { id: true, name: true, city: true } } },
    });
  }

  async deleteDesk(id: string) {
    return prisma.officeDesk.delete({ where: { id } });
  }

  async createDeskBooking(data: {
    deskId: string;
    employeeId: string;
    date: Date;
  }) {
    return prisma.deskBooking.create({
      data,
      include: {
        desk: {
          include: { office: { select: { id: true, name: true } } },
        },
        employee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findDeskBookingById(id: string) {
    return prisma.deskBooking.findUnique({
      where: { id },
      include: {
        desk: { include: { office: { select: { id: true, name: true } } } },
        employee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async deleteDeskBooking(id: string) {
    return prisma.deskBooking.delete({ where: { id } });
  }

  async findRooms(filters: { officeId?: string }) {
    const where: Prisma.MeetingRoomWhereInput = { isActive: true };
    if (filters.officeId) where.officeId = filters.officeId;

    return prisma.meetingRoom.findMany({
      where,
      include: {
        office: { select: { id: true, name: true, city: true } },
      },
      orderBy: [{ office: { name: "asc" } }, { name: "asc" }],
    });
  }

  async findAllRooms(filters: { officeId?: string }) {
    const where: Prisma.MeetingRoomWhereInput = {};
    if (filters.officeId) where.officeId = filters.officeId;

    return prisma.meetingRoom.findMany({
      where,
      include: {
        office: { select: { id: true, name: true, city: true } },
      },
      orderBy: [{ office: { name: "asc" } }, { name: "asc" }],
    });
  }

  async findRoomBookingsForDate(date: Date) {
    return prisma.roomBooking.findMany({
      where: { date },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });
  }

  // Future + still-active-today room bookings owned by `employeeId`.
  // Powers the "My bookings" panel on /office so users can spot and
  // cancel upcoming reservations without having to navigate by date.
  // `endTime` is stored as a zero-padded "HH:MM" string, so lexical
  // `gt` matches chronological order against the caller-supplied
  // current `HH:MM` for the "today" leg. The future-day leg uses
  // `date: { gt: todayStart }` since `@db.Date` compares day-only.
  async findUpcomingRoomBookingsForUser(
    employeeId: string,
    todayStart: Date,
    nowHHMM: string,
  ) {
    return prisma.roomBooking.findMany({
      where: {
        employeeId,
        OR: [
          { date: { gt: todayStart } },
          {
            AND: [{ date: todayStart }, { endTime: { gt: nowHHMM } }],
          },
        ],
      },
      include: {
        room: {
          include: { office: { select: { id: true, name: true, city: true } } },
        },
      },
      orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
      take: 100,
    });
  }

  async findRoomById(id: string) {
    return prisma.meetingRoom.findUnique({ where: { id } });
  }

  async createRoom(data: Prisma.MeetingRoomUncheckedCreateInput) {
    return prisma.meetingRoom.create({
      data,
      include: { office: { select: { id: true, name: true, city: true } } },
    });
  }

  async updateRoom(id: string, data: Prisma.MeetingRoomUncheckedUpdateInput) {
    return prisma.meetingRoom.update({
      where: { id },
      data,
      include: { office: { select: { id: true, name: true, city: true } } },
    });
  }

  async deleteRoom(id: string) {
    return prisma.meetingRoom.delete({ where: { id } });
  }

  async createRoomBooking(data: {
    roomId: string;
    employeeId: string;
    date: Date;
    timeSlot: string;
    endTime: string;
    seriesId?: string | null;
    title?: string;
    description?: string;
    attendeesCount?: number;
  }) {
    return prisma.roomBooking.create({
      data,
      include: {
        room: {
          include: { office: { select: { id: true, name: true } } },
        },
        employee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findRoomBookingById(id: string) {
    return prisma.roomBooking.findUnique({
      where: { id },
      include: {
        room: { include: { office: { select: { id: true, name: true } } } },
        employee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async deleteRoomBooking(id: string) {
    return prisma.roomBooking.delete({ where: { id } });
  }

  async findAssets(
    filters: {
      officeId?: string;
      type?: string;
      status?: string;
      search?: string;
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.AssetWhereInput = {};
    if (filters.officeId) where.officeId = filters.officeId;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { serialNo: { contains: filters.search, mode: "insensitive" } },
        { type: { contains: filters.search, mode: "insensitive" } },
        { manufacturer: { contains: filters.search, mode: "insensitive" } },
        { model: { contains: filters.search, mode: "insensitive" } },
        { assetCode: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          office: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.asset.count({ where }),
    ]);

    return { data, total };
  }

  async findAssetById(id: string) {
    return prisma.asset.findUnique({
      where: { id },
      include: {
        office: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createAsset(data: Prisma.AssetUncheckedCreateInput) {
    return prisma.asset.create({
      data,
      include: {
        office: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateAsset(id: string, data: Prisma.AssetUncheckedUpdateInput) {
    return prisma.asset.update({
      where: { id },
      data,
      include: {
        office: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  }
  async deleteAsset(id: string) {
    return prisma.asset.delete({ where: { id } });
  }
}

export const officeRepository = new OfficeRepository();
