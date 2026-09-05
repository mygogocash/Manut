import {
  and,
  asc,
  count,
  eq,
  gt,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";
import { createCuid } from "../lib/id";

const assignee = alias(schema.users, "asset_assignee");
const bookingEmployee = alias(schema.users, "booking_employee");

type OfficeRef = { id: string; name: string; city: string };

function mapOfficeRow<T extends Record<string, unknown>>(
  row: { officeId: string; officeName: string; officeCity: string },
  rest: T,
): T & { office: OfficeRef } {
  return {
    ...rest,
    office: { id: row.officeId, name: row.officeName, city: row.officeCity },
  };
}

export async function findOffices(db: Db) {
  return db.select().from(schema.offices).orderBy(asc(schema.offices.name));
}

export async function findOfficeById(db: Db, id: string) {
  const [row] = await db.select().from(schema.offices).where(eq(schema.offices.id, id)).limit(1);
  return row ?? null;
}

export async function findOfficeByName(db: Db, name: string) {
  const [row] = await db
    .select({ id: schema.offices.id })
    .from(schema.offices)
    .where(eq(schema.offices.name, name))
    .limit(1);
  return row ?? null;
}

export async function findActiveOffices(db: Db) {
  return db
    .select({ id: schema.offices.id, name: schema.offices.name, country: schema.offices.country })
    .from(schema.offices)
    .where(eq(schema.offices.isActive, true));
}

export async function createOffice(
  db: Db,
  data: {
    name: string;
    address?: string | null;
    city: string;
    country: string;
    timezone?: string | null;
    capacity?: number;
    isActive?: boolean;
  },
) {
  const id = createCuid();
  await db.insert(schema.offices).values({
    id,
    name: data.name,
    address: data.address ?? null,
    city: data.city,
    country: data.country,
    timezone: data.timezone ?? null,
    capacity: data.capacity ?? 0,
    isActive: data.isActive ?? true,
  });
  return findOfficeById(db, id);
}

export async function updateOffice(
  db: Db,
  id: string,
  data: Partial<{
    name: string;
    address: string | null;
    city: string;
    country: string;
    timezone: string | null;
    capacity: number;
    isActive: boolean;
  }>,
) {
  await db.update(schema.offices).set(data).where(eq(schema.offices.id, id));
  return findOfficeById(db, id);
}

export async function deleteOffice(db: Db, id: string) {
  await db.delete(schema.offices).where(eq(schema.offices.id, id));
}

export async function findDesks(db: Db, filters: { officeId?: string; floor?: string }) {
  const parts: SQL[] = [eq(schema.officeDesks.isActive, true)];
  if (filters.officeId) parts.push(eq(schema.officeDesks.officeId, filters.officeId));
  if (filters.floor) parts.push(eq(schema.officeDesks.floor, filters.floor));

  const rows = await db
    .select({
      id: schema.officeDesks.id,
      officeId: schema.officeDesks.officeId,
      name: schema.officeDesks.name,
      floor: schema.officeDesks.floor,
      zone: schema.officeDesks.zone,
      isActive: schema.officeDesks.isActive,
      officeName: schema.offices.name,
      officeCity: schema.offices.city,
    })
    .from(schema.officeDesks)
    .innerJoin(schema.offices, eq(schema.officeDesks.officeId, schema.offices.id))
    .where(and(...parts))
    .orderBy(asc(schema.offices.name), asc(schema.officeDesks.name));

  return rows.map((r) =>
    mapOfficeRow(r, {
      id: r.id,
      officeId: r.officeId,
      name: r.name,
      floor: r.floor,
      zone: r.zone,
      isActive: r.isActive,
    }),
  );
}

export async function findAllDesks(db: Db, filters: { officeId?: string }) {
  const parts: SQL[] = [];
  if (filters.officeId) parts.push(eq(schema.officeDesks.officeId, filters.officeId));
  const where = parts.length ? and(...parts) : undefined;

  const rows = await db
    .select({
      id: schema.officeDesks.id,
      officeId: schema.officeDesks.officeId,
      name: schema.officeDesks.name,
      floor: schema.officeDesks.floor,
      zone: schema.officeDesks.zone,
      isActive: schema.officeDesks.isActive,
      officeName: schema.offices.name,
      officeCity: schema.offices.city,
    })
    .from(schema.officeDesks)
    .innerJoin(schema.offices, eq(schema.officeDesks.officeId, schema.offices.id))
    .where(where)
    .orderBy(asc(schema.offices.name), asc(schema.officeDesks.name));

  return rows.map((r) =>
    mapOfficeRow(r, {
      id: r.id,
      officeId: r.officeId,
      name: r.name,
      floor: r.floor,
      zone: r.zone,
      isActive: r.isActive,
    }),
  );
}

export async function findDeskBookingsForDate(db: Db, date: string) {
  return db
    .select({
      id: schema.deskBookings.id,
      deskId: schema.deskBookings.deskId,
      employeeId: schema.deskBookings.employeeId,
      employee: {
        id: bookingEmployee.id,
        name: bookingEmployee.name,
        email: bookingEmployee.email,
      },
    })
    .from(schema.deskBookings)
    .innerJoin(bookingEmployee, eq(schema.deskBookings.employeeId, bookingEmployee.id))
    .where(eq(schema.deskBookings.date, date));
}

export async function findDeskById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.officeDesks)
    .where(eq(schema.officeDesks.id, id))
    .limit(1);
  return row ?? null;
}

export async function createDesk(
  db: Db,
  data: {
    officeId: string;
    name: string;
    floor?: string | null;
    zone?: string | null;
    isActive?: boolean;
  },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.officeDesks).values({
    id,
    officeId: data.officeId,
    name: data.name,
    floor: data.floor ?? null,
    zone: data.zone ?? null,
    isActive: data.isActive ?? true,
  });
  const [row] = await db
    .select({
      id: schema.officeDesks.id,
      officeId: schema.officeDesks.officeId,
      name: schema.officeDesks.name,
      floor: schema.officeDesks.floor,
      zone: schema.officeDesks.zone,
      isActive: schema.officeDesks.isActive,
      officeName: schema.offices.name,
      officeCity: schema.offices.city,
    })
    .from(schema.officeDesks)
    .innerJoin(schema.offices, eq(schema.officeDesks.officeId, schema.offices.id))
    .where(eq(schema.officeDesks.id, id))
    .limit(1);
  return row
    ? mapOfficeRow(row, {
        id: row.id,
        officeId: row.officeId,
        name: row.name,
        floor: row.floor,
        zone: row.zone,
        isActive: row.isActive,
      })
    : null;
}

export async function updateDesk(
  db: Db,
  id: string,
  data: Partial<{
    officeId: string;
    name: string;
    floor: string | null;
    zone: string | null;
    isActive: boolean;
  }>,
) {
  await db.update(schema.officeDesks).set(data).where(eq(schema.officeDesks.id, id));
  const [row] = await db
    .select({
      id: schema.officeDesks.id,
      officeId: schema.officeDesks.officeId,
      name: schema.officeDesks.name,
      floor: schema.officeDesks.floor,
      zone: schema.officeDesks.zone,
      isActive: schema.officeDesks.isActive,
      officeName: schema.offices.name,
      officeCity: schema.offices.city,
    })
    .from(schema.officeDesks)
    .innerJoin(schema.offices, eq(schema.officeDesks.officeId, schema.offices.id))
    .where(eq(schema.officeDesks.id, id))
    .limit(1);
  return row
    ? mapOfficeRow(row, {
        id: row.id,
        officeId: row.officeId,
        name: row.name,
        floor: row.floor,
        zone: row.zone,
        isActive: row.isActive,
      })
    : null;
}

export async function deleteDesk(db: Db, id: string) {
  await db.delete(schema.officeDesks).where(eq(schema.officeDesks.id, id));
}

export async function createDeskBooking(db: Db, data: { deskId: string; employeeId: string; date: string }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.deskBookings).values({
    id,
    deskId: data.deskId,
    employeeId: data.employeeId,
    date: data.date,
    createdAt: now,
  });
  const [row] = await db
    .select({
      booking: schema.deskBookings,
      deskId: schema.officeDesks.id,
      deskName: schema.officeDesks.name,
      officeId: schema.offices.id,
      officeName: schema.offices.name,
      employeeId: bookingEmployee.id,
      employeeName: bookingEmployee.name,
      employeeEmail: bookingEmployee.email,
    })
    .from(schema.deskBookings)
    .innerJoin(schema.officeDesks, eq(schema.deskBookings.deskId, schema.officeDesks.id))
    .innerJoin(schema.offices, eq(schema.officeDesks.officeId, schema.offices.id))
    .innerJoin(bookingEmployee, eq(schema.deskBookings.employeeId, bookingEmployee.id))
    .where(eq(schema.deskBookings.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.booking,
    desk: { id: row.deskId, name: row.deskName, office: { id: row.officeId, name: row.officeName } },
    employee: { id: row.employeeId, name: row.employeeName, email: row.employeeEmail },
  };
}

export async function findDeskBookingById(db: Db, id: string) {
  const [row] = await db
    .select({
      booking: schema.deskBookings,
      deskId: schema.officeDesks.id,
      deskName: schema.officeDesks.name,
      officeId: schema.offices.id,
      officeName: schema.offices.name,
      employeeId: bookingEmployee.id,
      employeeName: bookingEmployee.name,
      employeeEmail: bookingEmployee.email,
    })
    .from(schema.deskBookings)
    .innerJoin(schema.officeDesks, eq(schema.deskBookings.deskId, schema.officeDesks.id))
    .innerJoin(schema.offices, eq(schema.officeDesks.officeId, schema.offices.id))
    .innerJoin(bookingEmployee, eq(schema.deskBookings.employeeId, bookingEmployee.id))
    .where(eq(schema.deskBookings.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.booking,
    desk: { id: row.deskId, name: row.deskName, office: { id: row.officeId, name: row.officeName } },
    employee: { id: row.employeeId, name: row.employeeName, email: row.employeeEmail },
  };
}

export async function deleteDeskBooking(db: Db, id: string) {
  await db.delete(schema.deskBookings).where(eq(schema.deskBookings.id, id));
}

export async function findRooms(db: Db, filters: { officeId?: string }) {
  const parts: SQL[] = [eq(schema.meetingRooms.isActive, true)];
  if (filters.officeId) parts.push(eq(schema.meetingRooms.officeId, filters.officeId));

  const rows = await db
    .select({
      id: schema.meetingRooms.id,
      officeId: schema.meetingRooms.officeId,
      name: schema.meetingRooms.name,
      capacity: schema.meetingRooms.capacity,
      amenities: schema.meetingRooms.amenities,
      imageUrl: schema.meetingRooms.imageUrl,
      isActive: schema.meetingRooms.isActive,
      officeName: schema.offices.name,
      officeCity: schema.offices.city,
    })
    .from(schema.meetingRooms)
    .innerJoin(schema.offices, eq(schema.meetingRooms.officeId, schema.offices.id))
    .where(and(...parts))
    .orderBy(asc(schema.offices.name), asc(schema.meetingRooms.name));

  return rows.map((r) =>
    mapOfficeRow(r, {
      id: r.id,
      officeId: r.officeId,
      name: r.name,
      capacity: r.capacity,
      amenities: r.amenities,
      imageUrl: r.imageUrl,
      isActive: r.isActive,
    }),
  );
}

export async function findAllRooms(db: Db, filters: { officeId?: string }) {
  const parts: SQL[] = [];
  if (filters.officeId) parts.push(eq(schema.meetingRooms.officeId, filters.officeId));
  const where = parts.length ? and(...parts) : undefined;

  const rows = await db
    .select({
      id: schema.meetingRooms.id,
      officeId: schema.meetingRooms.officeId,
      name: schema.meetingRooms.name,
      capacity: schema.meetingRooms.capacity,
      amenities: schema.meetingRooms.amenities,
      imageUrl: schema.meetingRooms.imageUrl,
      isActive: schema.meetingRooms.isActive,
      officeName: schema.offices.name,
      officeCity: schema.offices.city,
    })
    .from(schema.meetingRooms)
    .innerJoin(schema.offices, eq(schema.meetingRooms.officeId, schema.offices.id))
    .where(where)
    .orderBy(asc(schema.offices.name), asc(schema.meetingRooms.name));

  return rows.map((r) =>
    mapOfficeRow(r, {
      id: r.id,
      officeId: r.officeId,
      name: r.name,
      capacity: r.capacity,
      amenities: r.amenities,
      imageUrl: r.imageUrl,
      isActive: r.isActive,
    }),
  );
}

export async function findRoomBookingsForDate(db: Db, date: string) {
  return db
    .select({
      id: schema.roomBookings.id,
      roomId: schema.roomBookings.roomId,
      employeeId: schema.roomBookings.employeeId,
      date: schema.roomBookings.date,
      timeSlot: schema.roomBookings.timeSlot,
      endTime: schema.roomBookings.endTime,
      title: schema.roomBookings.title,
      description: schema.roomBookings.description,
      attendeesCount: schema.roomBookings.attendeesCount,
      seriesId: schema.roomBookings.seriesId,
      employee: { id: bookingEmployee.id, name: bookingEmployee.name },
    })
    .from(schema.roomBookings)
    .innerJoin(bookingEmployee, eq(schema.roomBookings.employeeId, bookingEmployee.id))
    .where(eq(schema.roomBookings.date, date));
}

export async function findUpcomingRoomBookingsForUser(
  db: Db,
  employeeId: string,
  todayIso: string,
  nowHHMM: string,
) {
  const rows = await db
    .select({
      booking: schema.roomBookings,
      roomId: schema.meetingRooms.id,
      roomName: schema.meetingRooms.name,
      roomCapacity: schema.meetingRooms.capacity,
      officeId: schema.offices.id,
      officeName: schema.offices.name,
      officeCity: schema.offices.city,
    })
    .from(schema.roomBookings)
    .innerJoin(schema.meetingRooms, eq(schema.roomBookings.roomId, schema.meetingRooms.id))
    .innerJoin(schema.offices, eq(schema.meetingRooms.officeId, schema.offices.id))
    .where(
      and(
        eq(schema.roomBookings.employeeId, employeeId),
        or(
          gt(schema.roomBookings.date, todayIso),
          and(eq(schema.roomBookings.date, todayIso), gt(schema.roomBookings.endTime, nowHHMM)),
        ),
      ),
    )
    .orderBy(asc(schema.roomBookings.date), asc(schema.roomBookings.timeSlot))
    .limit(100);

  return rows.map((r) => ({
    ...r.booking,
    room: {
      id: r.roomId,
      name: r.roomName,
      capacity: r.roomCapacity,
      office: { id: r.officeId, name: r.officeName, city: r.officeCity },
    },
  }));
}

export async function findRoomById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.meetingRooms)
    .where(eq(schema.meetingRooms.id, id))
    .limit(1);
  return row ?? null;
}

export async function createRoom(
  db: Db,
  data: {
    officeId: string;
    name: string;
    capacity: number;
    amenities?: string | null;
    imageUrl?: string | null;
    isActive?: boolean;
  },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.meetingRooms).values({
    id,
    officeId: data.officeId,
    name: data.name,
    capacity: data.capacity,
    amenities: data.amenities ?? null,
    imageUrl: data.imageUrl ?? null,
    isActive: data.isActive ?? true,
  });
  const [row] = await db
    .select({
      id: schema.meetingRooms.id,
      officeId: schema.meetingRooms.officeId,
      name: schema.meetingRooms.name,
      capacity: schema.meetingRooms.capacity,
      amenities: schema.meetingRooms.amenities,
      imageUrl: schema.meetingRooms.imageUrl,
      isActive: schema.meetingRooms.isActive,
      officeName: schema.offices.name,
      officeCity: schema.offices.city,
    })
    .from(schema.meetingRooms)
    .innerJoin(schema.offices, eq(schema.meetingRooms.officeId, schema.offices.id))
    .where(eq(schema.meetingRooms.id, id))
    .limit(1);
  return row
    ? mapOfficeRow(row, {
        id: row.id,
        officeId: row.officeId,
        name: row.name,
        capacity: row.capacity,
        amenities: row.amenities,
        imageUrl: row.imageUrl,
        isActive: row.isActive,
      })
    : null;
}

export async function updateRoom(
  db: Db,
  id: string,
  data: Partial<{
    officeId: string;
    name: string;
    capacity: number;
    amenities: string | null;
    imageUrl: string | null;
    isActive: boolean;
  }>,
) {
  await db.update(schema.meetingRooms).set(data).where(eq(schema.meetingRooms.id, id));
  const [row] = await db
    .select({
      id: schema.meetingRooms.id,
      officeId: schema.meetingRooms.officeId,
      name: schema.meetingRooms.name,
      capacity: schema.meetingRooms.capacity,
      amenities: schema.meetingRooms.amenities,
      imageUrl: schema.meetingRooms.imageUrl,
      isActive: schema.meetingRooms.isActive,
      officeName: schema.offices.name,
      officeCity: schema.offices.city,
    })
    .from(schema.meetingRooms)
    .innerJoin(schema.offices, eq(schema.meetingRooms.officeId, schema.offices.id))
    .where(eq(schema.meetingRooms.id, id))
    .limit(1);
  return row
    ? mapOfficeRow(row, {
        id: row.id,
        officeId: row.officeId,
        name: row.name,
        capacity: row.capacity,
        amenities: row.amenities,
        imageUrl: row.imageUrl,
        isActive: row.isActive,
      })
    : null;
}

export async function deleteRoom(db: Db, id: string) {
  await db.delete(schema.meetingRooms).where(eq(schema.meetingRooms.id, id));
}

async function loadRoomBooking(db: Db | DbTransaction, id: string) {
  const [row] = await db
    .select({
      booking: schema.roomBookings,
      roomId: schema.meetingRooms.id,
      roomName: schema.meetingRooms.name,
      officeId: schema.offices.id,
      officeName: schema.offices.name,
      employeeId: bookingEmployee.id,
      employeeName: bookingEmployee.name,
      employeeEmail: bookingEmployee.email,
    })
    .from(schema.roomBookings)
    .innerJoin(schema.meetingRooms, eq(schema.roomBookings.roomId, schema.meetingRooms.id))
    .innerJoin(schema.offices, eq(schema.meetingRooms.officeId, schema.offices.id))
    .innerJoin(bookingEmployee, eq(schema.roomBookings.employeeId, bookingEmployee.id))
    .where(eq(schema.roomBookings.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.booking,
    room: { id: row.roomId, name: row.roomName, office: { id: row.officeId, name: row.officeName } },
    employee: { id: row.employeeId, name: row.employeeName, email: row.employeeEmail },
  };
}

export async function createRoomBooking(
  db: Db,
  data: {
    roomId: string;
    employeeId: string;
    date: string;
    timeSlot: string;
    endTime: string;
    seriesId?: string | null;
    title?: string;
    description?: string;
    attendeesCount?: number;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.roomBookings).values({
    id,
    roomId: data.roomId,
    employeeId: data.employeeId,
    date: data.date,
    timeSlot: data.timeSlot,
    endTime: data.endTime,
    seriesId: data.seriesId ?? null,
    title: data.title ?? null,
    description: data.description ?? null,
    attendeesCount: data.attendeesCount ?? null,
    createdAt: now,
  });
  return loadRoomBooking(db, id);
}

export async function createRoomBookingsInTransaction(
  db: Db,
  rows: Array<{
    roomId: string;
    employeeId: string;
    date: string;
    timeSlot: string;
    endTime: string;
    seriesId?: string | null;
    title?: string;
    description?: string;
    attendeesCount?: number;
  }>,
) {
  return db.transaction(async (tx: DbTransaction) => {
    const created: string[] = [];
    const now = new Date().toISOString();
    for (const data of rows) {
      const id = crypto.randomUUID();
      await tx.insert(schema.roomBookings).values({
        id,
        roomId: data.roomId,
        employeeId: data.employeeId,
        date: data.date,
        timeSlot: data.timeSlot,
        endTime: data.endTime,
        seriesId: data.seriesId ?? null,
        title: data.title ?? null,
        description: data.description ?? null,
        attendeesCount: data.attendeesCount ?? null,
        createdAt: now,
      });
      created.push(id);
    }
    const first = created[0];
    return first ? loadRoomBooking(tx, first) : null;
  });
}

export async function findRoomBookingById(db: Db, id: string) {
  return loadRoomBooking(db, id);
}

export async function deleteRoomBooking(db: Db, id: string) {
  await db.delete(schema.roomBookings).where(eq(schema.roomBookings.id, id));
}

function mapAssetRow(row: {
  asset: typeof schema.assets.$inferSelect;
  officeId: string;
  officeName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
}) {
  return {
    ...row.asset,
    office: { id: row.officeId, name: row.officeName },
    assignee: row.assigneeId
      ? { id: row.assigneeId, name: row.assigneeName, email: row.assigneeEmail }
      : null,
  };
}

export async function findAssets(
  db: Db,
  filters: { officeId?: string; type?: string; status?: string; search?: string },
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const parts: SQL[] = [];
  if (filters.officeId) parts.push(eq(schema.assets.officeId, filters.officeId));
  if (filters.type) parts.push(eq(schema.assets.type, filters.type));
  if (filters.status) parts.push(eq(schema.assets.status, filters.status));
  if (filters.search) {
    const q = `%${filters.search}%`;
    parts.push(
      or(
        ilike(schema.assets.name, q),
        ilike(schema.assets.serialNo, q),
        ilike(schema.assets.type, q),
        ilike(schema.assets.manufacturer, q),
        ilike(schema.assets.model, q),
        ilike(schema.assets.assetCode, q),
      )!,
    );
  }
  const where = parts.length ? and(...parts) : undefined;

  const [totalRow] = await db.select({ n: count() }).from(schema.assets).where(where);
  const rows = await db
    .select({
      asset: schema.assets,
      officeId: schema.offices.id,
      officeName: schema.offices.name,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      assigneeEmail: assignee.email,
    })
    .from(schema.assets)
    .innerJoin(schema.offices, eq(schema.assets.officeId, schema.offices.id))
    .leftJoin(assignee, eq(schema.assets.assignedTo, assignee.id))
    .where(where)
    .orderBy(asc(schema.assets.name))
    .limit(limit)
    .offset(offset);

  return { data: rows.map(mapAssetRow), total: Number(totalRow?.n ?? 0) };
}

export async function findAssetById(db: Db, id: string) {
  const [row] = await db
    .select({
      asset: schema.assets,
      officeId: schema.offices.id,
      officeName: schema.offices.name,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      assigneeEmail: assignee.email,
    })
    .from(schema.assets)
    .innerJoin(schema.offices, eq(schema.assets.officeId, schema.offices.id))
    .leftJoin(assignee, eq(schema.assets.assignedTo, assignee.id))
    .where(eq(schema.assets.id, id))
    .limit(1);
  return row ? mapAssetRow(row) : null;
}

export async function findAllAssetsForImport(db: Db) {
  return db
    .select({
      id: schema.assets.id,
      serialNo: schema.assets.serialNo,
      assetCode: schema.assets.assetCode,
      officeId: schema.assets.officeId,
      name: schema.assets.name,
      purchaseDate: schema.assets.purchaseDate,
    })
    .from(schema.assets);
}

export async function createAsset(db: Db, data: Record<string, unknown>) {
  const id = crypto.randomUUID();
  await db.insert(schema.assets).values({ id, ...data } as typeof schema.assets.$inferInsert);
  return findAssetById(db, id);
}

export async function updateAsset(db: Db, id: string, data: Record<string, unknown>) {
  await db.update(schema.assets).set(data).where(eq(schema.assets.id, id));
  return findAssetById(db, id);
}

export async function deleteAsset(db: Db, id: string) {
  await db.delete(schema.assets).where(eq(schema.assets.id, id));
}

export async function findUsersForImport(db: Db) {
  return db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, entityId: schema.users.entityId })
    .from(schema.users);
}

export async function findEntitiesForImport(db: Db) {
  return db
    .select({ id: schema.entities.id, code: schema.entities.code, country: schema.entities.country })
    .from(schema.entities);
}

export function isDeskBookingUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; message?: string };
  return e.code === "23505" || Boolean(e.message?.includes("desk_bookings_desk_id_date_key"));
}
