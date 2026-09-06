import type { Db } from "@nexora/db";
import type {
  AssetImportOffice,
  AssetImportRow,
  AssetQuery,
  BookDeskInput,
  BookRoomInput,
  CreateAssetInput,
  CreateDeskInput,
  CreateOfficeInput,
  CreateRoomInput,
  DeskQuery,
  RoomQuery,
  SearchRoomsInput,
  UpdateAssetInput,
  UpdateDeskInput,
  UpdateOfficeInput,
  UpdateRoomInput,
} from "@nexora/contracts/modules/office/office.validation";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import * as repo from "./office.repository";

const ROOM_DAY_START = "09:00";
const ROOM_DAY_END = "18:00";
const ROOM_SLOT_MINUTES = 30;
const ROOM_MAX_CONSECUTIVE_SLOTS = 4;
const ROOM_MAX_BOOKING_MINUTES = ROOM_MAX_CONSECUTIVE_SLOTS * ROOM_SLOT_MINUTES;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function expandDates(startIso: string, endIso: string): string[] {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const out: string[] = [];
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 24 * 60 * 60 * 1000) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return out;
}

function buildRoomSlots(): Array<{ time: string; endTime: string }> {
  const out: Array<{ time: string; endTime: string }> = [];
  for (
    let t = toMinutes(ROOM_DAY_START);
    t + ROOM_SLOT_MINUTES <= toMinutes(ROOM_DAY_END);
    t += ROOM_SLOT_MINUTES
  ) {
    out.push({ time: fromMinutes(t), endTime: fromMinutes(t + ROOM_SLOT_MINUTES) });
  }
  return out;
}

const ROOM_GRID_SLOTS = buildRoomSlots();

function deriveAssetCode(
  serialNo: string | undefined,
  activeServiceDate: string | undefined,
): string | undefined {
  if (!serialNo && !activeServiceDate) return undefined;
  const datePart = activeServiceDate ? activeServiceDate.replace(/-/g, "") : "";
  if (serialNo && datePart) return `${serialNo}-${datePart}`;
  return serialNo || datePart || undefined;
}

export function naturalAssetKey(
  officeId: string | null | undefined,
  name: string | null | undefined,
  purchaseDate: string | null | undefined,
): string | null {
  if (!officeId || !name || !purchaseDate) return null;
  const day = purchaseDate.slice(0, 10);
  return `${officeId}|${name.trim().toLowerCase().replace(/\s+/g, " ")}|${day}`;
}

export function sparseAssetUpdate(
  data: Record<string, unknown>,
  opts: { statusProvided: boolean },
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "officeId") continue;
    if (key === "status" && !opts.statusProvided) continue;
    if (value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

function splitAmenities(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function joinAmenities(value: string[] | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function normaliseEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/@thebinaryholding\.com$/, "@manut.xyz");
}

function joinName(
  first: string | null | undefined,
  last: string | null | undefined,
): string | null {
  const v = `${first ?? ""} ${last ?? ""}`.replace(/\s+/g, " ").trim();
  return v.length > 0 ? v : null;
}

interface ImportOfficeTarget {
  id: string | null;
  willCreate: boolean;
}

export async function listOffices(db: Db) {
  return repo.findOffices(db);
}

export async function createOffice(db: Db, input: CreateOfficeInput) {
  return repo.createOffice(db, {
    name: input.name,
    address: input.address ?? undefined,
    city: input.city,
    country: input.country,
    timezone: input.timezone ?? undefined,
    capacity: input.capacity,
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function updateOffice(db: Db, id: string, input: UpdateOfficeInput) {
  const existing = await repo.findOfficeById(db, id);
  if (!existing) throw new NotFoundException("Office not found");
  return repo.updateOffice(db, id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.address !== undefined && { address: input.address }),
    ...(input.city !== undefined && { city: input.city }),
    ...(input.country !== undefined && { country: input.country }),
    ...(input.timezone !== undefined && { timezone: input.timezone }),
    ...(input.capacity !== undefined && { capacity: input.capacity }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function deleteOffice(db: Db, id: string) {
  const existing = await repo.findOfficeById(db, id);
  if (!existing) throw new NotFoundException("Office not found");
  await repo.deleteOffice(db, id);
}

export async function listDesks(db: Db, query: DeskQuery) {
  const desks = await repo.findDesks(db, { officeId: query.officeId, floor: query.floor });
  const bookings = query.date ? await repo.findDeskBookingsForDate(db, query.date) : [];
  const bookedMap = new Map(bookings.map((b) => [b.deskId, b]));

  return desks.map((desk) => {
    const booking = bookedMap.get(desk.id);
    return {
      id: desk.id,
      label: desk.name,
      floor: desk.floor,
      zone: desk.zone,
      officeId: desk.officeId,
      office: desk.office,
      isAvailable: !booking,
      bookedBy: booking
        ? { id: booking.employee.id, name: booking.employee.name, email: booking.employee.email }
        : null,
      bookingId: booking?.id ?? null,
    };
  });
}

export async function listAllDesks(db: Db, officeId?: string) {
  const desks = await repo.findAllDesks(db, { officeId });
  return desks.map((d) => ({
    id: d.id,
    name: d.name,
    floor: d.floor,
    zone: d.zone,
    isActive: d.isActive,
    officeId: d.officeId,
    office: d.office,
  }));
}

export async function createDesk(db: Db, input: CreateDeskInput) {
  const office = await repo.findOfficeById(db, input.officeId);
  if (!office) throw new NotFoundException("Office not found");
  return repo.createDesk(db, {
    officeId: input.officeId,
    name: input.name,
    floor: input.floor ?? undefined,
    zone: input.zone ?? undefined,
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function updateDesk(db: Db, id: string, input: UpdateDeskInput) {
  const existing = await repo.findDeskById(db, id);
  if (!existing) throw new NotFoundException("Desk not found");
  if (input.officeId) {
    const office = await repo.findOfficeById(db, input.officeId);
    if (!office) throw new NotFoundException("Office not found");
  }
  return repo.updateDesk(db, id, {
    ...(input.officeId !== undefined && { officeId: input.officeId }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.floor !== undefined && { floor: input.floor }),
    ...(input.zone !== undefined && { zone: input.zone }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function deleteDesk(db: Db, id: string) {
  const existing = await repo.findDeskById(db, id);
  if (!existing) throw new NotFoundException("Desk not found");
  await repo.deleteDesk(db, id);
}

export async function bookDesk(db: Db, userId: string, input: BookDeskInput) {
  const desk = await repo.findDeskById(db, input.deskId);
  if (!desk) throw new NotFoundException("Desk not found");
  if (!desk.isActive) throw new BadRequestException("Desk is not available");

  try {
    return await repo.createDeskBooking(db, {
      deskId: input.deskId,
      employeeId: userId,
      date: input.date,
    });
  } catch (err: unknown) {
    if (repo.isDeskBookingUniqueViolation(err)) {
      throw new ConflictException("This desk is already booked for the selected date");
    }
    throw err;
  }
}

export async function cancelDeskBooking(db: Db, bookingId: string, userId: string) {
  const booking = await repo.findDeskBookingById(db, bookingId);
  if (!booking) throw new NotFoundException("Desk booking not found");
  if (booking.employeeId !== userId) {
    throw new ForbiddenException("You can only cancel your own bookings");
  }
  await repo.deleteDeskBooking(db, bookingId);
}

export async function listRooms(db: Db, query: RoomQuery) {
  const rooms = await repo.findRooms(db, { officeId: query.officeId });
  const bookings = query.date ? await repo.findRoomBookingsForDate(db, query.date) : [];
  const bookingsByRoom = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const arr = bookingsByRoom.get(b.roomId) ?? [];
    arr.push(b);
    bookingsByRoom.set(b.roomId, arr);
  }

  return rooms.map((room) => {
    const roomBookings = bookingsByRoom.get(room.id) ?? [];
    const findBooking = (slotStart: string) => {
      const slotStartMin = toMinutes(slotStart);
      return roomBookings.find((b) => {
        const start = toMinutes(b.timeSlot);
        const end = toMinutes(b.endTime ?? fromMinutes(start + 60));
        return slotStartMin >= start && slotStartMin < end;
      });
    };

    return {
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      floor: null as string | null,
      amenities: splitAmenities(room.amenities),
      imageUrl: room.imageUrl,
      officeId: room.officeId,
      office: room.office,
      slotMinutes: ROOM_SLOT_MINUTES,
      maxConsecutiveSlots: ROOM_MAX_CONSECUTIVE_SLOTS,
      timeSlots: ROOM_GRID_SLOTS.map(({ time, endTime }) => {
        const booking = findBooking(time);
        return {
          time,
          endTime,
          isAvailable: !booking,
          bookedBy: booking ? { id: booking.employee.id, name: booking.employee.name } : null,
          bookingId: booking?.id ?? null,
          title: booking && booking.timeSlot === time ? (booking.title ?? null) : null,
          description: booking && booking.timeSlot === time ? (booking.description ?? null) : null,
          attendeesCount:
            booking && booking.timeSlot === time ? (booking.attendeesCount ?? null) : null,
          bookingStart: booking?.timeSlot ?? null,
          bookingEnd: booking?.endTime ?? null,
        };
      }),
    };
  });
}

export async function listAllRooms(db: Db, officeId?: string) {
  const rooms = await repo.findAllRooms(db, { officeId });
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    amenities: splitAmenities(r.amenities),
    imageUrl: r.imageUrl,
    isActive: r.isActive,
    officeId: r.officeId,
    office: r.office,
  }));
}

export async function createRoom(db: Db, input: CreateRoomInput) {
  const office = await repo.findOfficeById(db, input.officeId);
  if (!office) throw new NotFoundException("Office not found");
  return repo.createRoom(db, {
    officeId: input.officeId,
    name: input.name,
    capacity: input.capacity,
    amenities: joinAmenities(input.amenities),
    imageUrl: input.imageUrl || undefined,
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function updateRoom(db: Db, id: string, input: UpdateRoomInput) {
  const existing = await repo.findRoomById(db, id);
  if (!existing) throw new NotFoundException("Room not found");
  if (input.officeId) {
    const office = await repo.findOfficeById(db, input.officeId);
    if (!office) throw new NotFoundException("Office not found");
  }
  return repo.updateRoom(db, id, {
    ...(input.officeId !== undefined && { officeId: input.officeId }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.capacity !== undefined && { capacity: input.capacity }),
    ...(input.amenities !== undefined && { amenities: joinAmenities(input.amenities) ?? null }),
    ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl || null }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function deleteRoom(db: Db, id: string) {
  const existing = await repo.findRoomById(db, id);
  if (!existing) throw new NotFoundException("Room not found");
  await repo.deleteRoom(db, id);
}

export async function bookRoom(db: Db, userId: string, input: BookRoomInput) {
  const room = await repo.findRoomById(db, input.roomId);
  if (!room) throw new NotFoundException("Meeting room not found");
  if (!room.isActive) throw new BadRequestException("Room is not available");

  const startMin = toMinutes(input.timeSlot);
  const endMin = input.endTime ? toMinutes(input.endTime) : startMin + 60;
  const endTime = fromMinutes(endMin);

  const dayStart = toMinutes(ROOM_DAY_START);
  const dayEnd = toMinutes(ROOM_DAY_END);
  if (startMin < dayStart || endMin > dayEnd) {
    throw new BadRequestException("Time slot is outside the booking window");
  }
  const durationMin = endMin - startMin;
  if (durationMin < 1) throw new BadRequestException("End time must be after start time");
  if (durationMin > ROOM_MAX_BOOKING_MINUTES) {
    throw new BadRequestException(`Booking can be at most ${ROOM_MAX_BOOKING_MINUTES / 60} hours`);
  }

  if (input.attendeesCount && room.capacity > 0 && input.attendeesCount > room.capacity) {
    throw new BadRequestException(
      `Attendee count (${input.attendeesCount}) exceeds room capacity (${room.capacity})`,
    );
  }

  const dates = expandDates(input.date, input.endDate ?? input.date);
  const seriesId = dates.length > 1 ? crypto.randomUUID() : null;

  for (const day of dates) {
    const sameDay = await repo.findRoomBookingsForDate(db, day);
    const overlaps = sameDay.some((b) => {
      if (b.roomId !== input.roomId) return false;
      const bStart = toMinutes(b.timeSlot);
      const bEnd = toMinutes(b.endTime ?? fromMinutes(bStart + 60));
      return startMin < bEnd && endMin > bStart;
    });
    if (overlaps) {
      throw new ConflictException(
        dates.length > 1
          ? `This room is already booked on ${day} for part of the selected window`
          : "This room is already booked for part of the selected window",
      );
    }
  }

  if (dates.length === 1) {
    return repo.createRoomBooking(db, {
      roomId: input.roomId,
      employeeId: userId,
      date: dates[0]!,
      timeSlot: input.timeSlot,
      endTime,
      seriesId,
      title: input.title,
      description: input.description,
      attendeesCount: input.attendeesCount,
    });
  }

  return repo.createRoomBookingsInTransaction(
    db,
    dates.map((day) => ({
      roomId: input.roomId,
      employeeId: userId,
      date: day,
      timeSlot: input.timeSlot,
      endTime,
      seriesId,
      title: input.title,
      description: input.description,
      attendeesCount: input.attendeesCount,
    })),
  );
}

export async function searchRooms(db: Db, input: SearchRoomsInput) {
  const rooms = await repo.findRooms(db, { officeId: input.officeId });
  const dates = expandDates(input.startDate, input.endDate);
  const startMin = toMinutes(input.startTime);
  const endMin = toMinutes(input.endTime);

  const bookingsByDay = await Promise.all(dates.map((d) => repo.findRoomBookingsForDate(db, d)));

  type ConflictEntry = {
    bookingId: string;
    date: string;
    startTime: string;
    endTime: string;
    title: string | null;
    seriesId: string | null;
    bookedBy: { id: string; name: string };
  };

  const conflictsByRoom = new Map<string, ConflictEntry[]>();
  for (let i = 0; i < dates.length; i++) {
    const dayBookings = bookingsByDay[i] ?? [];
    const dayIso = dates[i]!;
    for (const b of dayBookings) {
      const bStart = toMinutes(b.timeSlot);
      const bEnd = toMinutes(b.endTime ?? fromMinutes(bStart + 60));
      if (!(startMin < bEnd && endMin > bStart)) continue;
      const list = conflictsByRoom.get(b.roomId) ?? [];
      list.push({
        bookingId: b.id,
        date: dayIso,
        startTime: b.timeSlot,
        endTime: b.endTime ?? fromMinutes(bStart + 60),
        title: b.title,
        seriesId: b.seriesId,
        bookedBy: { id: b.employee.id, name: b.employee.name },
      });
      conflictsByRoom.set(b.roomId, list);
    }
  }

  const enriched = rooms.map((room) => {
    const raw = conflictsByRoom.get(room.id) ?? [];
    const collapsed = new Map<string, ConflictEntry>();
    for (const c of raw) {
      const key = c.seriesId ?? c.bookingId;
      const prev = collapsed.get(key);
      if (!prev || c.date < prev.date) collapsed.set(key, c);
    }
    const conflicts = [...collapsed.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    );
    return {
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      floor: null as string | null,
      amenities: splitAmenities(room.amenities),
      imageUrl: room.imageUrl,
      officeId: room.officeId,
      office: room.office,
      status: conflicts.length > 0 ? ("occupied" as const) : ("available" as const),
      conflicts,
    };
  });

  if (input.status === "all") return enriched;
  return enriched.filter((r) => r.status === input.status);
}

export async function cancelRoomBooking(db: Db, bookingId: string, userId: string) {
  const booking = await repo.findRoomBookingById(db, bookingId);
  if (!booking) throw new NotFoundException("Room booking not found");
  if (booking.employeeId !== userId) {
    throw new ForbiddenException("You can only cancel your own bookings");
  }
  await repo.deleteRoomBooking(db, bookingId);
}

export async function listMyRoomBookings(db: Db, userId: string) {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return repo.findUpcomingRoomBookingsForUser(db, userId, todayIso, nowHHMM);
}

export async function listAssets(db: Db, query: AssetQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findAssets(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getAssetById(db: Db, id: string) {
  const asset = await repo.findAssetById(db, id);
  if (!asset) throw new NotFoundException("Asset not found");
  return asset;
}

export async function createAsset(db: Db, input: CreateAssetInput) {
  return repo.createAsset(db, {
    officeId: input.officeId,
    name: input.name,
    type: input.type,
    serialNo: input.serialNo ?? null,
    assignedTo: input.assignedTo ?? null,
    purchaseDate: input.purchaseDate ?? null,
    purchaseCost: input.purchaseCost ?? null,
    status: input.status ?? "available",
    notes: input.notes ?? null,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    colour: input.colour ?? null,
    subType: input.subType ?? null,
    operatingSystem: input.operatingSystem ?? null,
    description: input.description ?? null,
    supportLink: input.supportLink || null,
    activeServiceDate: input.activeServiceDate ?? null,
    department: input.department ?? null,
    imageUrl: input.imageUrl || null,
    material: input.material ?? null,
    dimensions: input.dimensions ?? null,
    condition: input.condition || null,
    locationDetail: input.locationDetail ?? null,
    warrantyUntil: input.warrantyUntil ?? null,
    assetCode: input.assetCode ?? deriveAssetCode(input.serialNo, input.activeServiceDate),
    version: input.version ?? null,
    quantity: input.quantity ?? 1,
    usefulLifeMonths: input.usefulLifeMonths ?? null,
    bookValue: input.bookValue ?? null,
    disposalDate: input.disposalDate ?? null,
    sellingPrice: input.sellingPrice ?? null,
  });
}

export async function updateAsset(db: Db, id: string, input: UpdateAssetInput) {
  const existing = await repo.findAssetById(db, id);
  if (!existing) throw new NotFoundException("Asset not found");

  return repo.updateAsset(db, id, {
    ...(input.officeId !== undefined && { officeId: input.officeId }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.type !== undefined && { type: input.type }),
    ...(input.serialNo !== undefined && { serialNo: input.serialNo }),
    ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo ?? null }),
    ...(input.purchaseDate !== undefined && { purchaseDate: input.purchaseDate ?? null }),
    ...(input.purchaseCost !== undefined && { purchaseCost: input.purchaseCost }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.manufacturer !== undefined && { manufacturer: input.manufacturer || null }),
    ...(input.model !== undefined && { model: input.model || null }),
    ...(input.colour !== undefined && { colour: input.colour || null }),
    ...(input.subType !== undefined && { subType: input.subType || null }),
    ...(input.operatingSystem !== undefined && { operatingSystem: input.operatingSystem || null }),
    ...(input.description !== undefined && { description: input.description || null }),
    ...(input.supportLink !== undefined && { supportLink: input.supportLink || null }),
    ...(input.activeServiceDate !== undefined && {
      activeServiceDate: input.activeServiceDate ?? null,
    }),
    ...(input.department !== undefined && { department: input.department || null }),
    ...(input.assetCode !== undefined && { assetCode: input.assetCode || null }),
    ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl || null }),
    ...(input.material !== undefined && { material: input.material || null }),
    ...(input.dimensions !== undefined && { dimensions: input.dimensions || null }),
    ...(input.condition !== undefined && { condition: input.condition || null }),
    ...(input.locationDetail !== undefined && { locationDetail: input.locationDetail || null }),
    ...(input.warrantyUntil !== undefined && { warrantyUntil: input.warrantyUntil ?? null }),
    ...(input.version !== undefined && { version: input.version || null }),
    ...(input.quantity !== undefined && { quantity: input.quantity }),
    ...(input.usefulLifeMonths !== undefined && { usefulLifeMonths: input.usefulLifeMonths }),
    ...(input.bookValue !== undefined && { bookValue: input.bookValue }),
    ...(input.disposalDate !== undefined && { disposalDate: input.disposalDate ?? null }),
    ...(input.sellingPrice !== undefined && { sellingPrice: input.sellingPrice }),
  });
}

export async function deleteAsset(db: Db, id: string) {
  const existing = await repo.findAssetById(db, id);
  if (!existing) throw new NotFoundException("Asset not found");
  await repo.deleteAsset(db, id);
}

export async function previewAssetImport(
  db: Db,
  rows: AssetImportRow[],
  office?: AssetImportOffice,
) {
  const ctx = await loadAssetImportContext(db);
  const target = await resolveImportOffice(db, office, { create: false });
  const resolved = await resolveAssetImportRows(rows, ctx, target);
  const summary = {
    total: resolved.length,
    valid: resolved.filter((r) => r.errors.length === 0).length,
    invalid: resolved.filter((r) => r.errors.length > 0).length,
    inserts: resolved.filter((r) => r.errors.length === 0 && r.action === "insert").length,
    updates: resolved.filter((r) => r.errors.length === 0 && r.action === "update").length,
    unresolvedAssignees: resolved.filter((r) => r.warnings.includes("assignee_not_found")).length,
  };
  return { rows: resolved, summary };
}

export async function commitAssetImport(
  db: Db,
  rows: AssetImportRow[],
  office?: AssetImportOffice,
) {
  const target = await resolveImportOffice(db, office, { create: true });
  const ctx = await loadAssetImportContext(db);
  const resolved = await resolveAssetImportRows(rows, ctx, target);
  let inserts = 0;
  let updates = 0;
  let skipped = 0;
  const errors: Array<{ row: number; errors: string[] }> = [];

  for (const r of resolved) {
    if (r.errors.length > 0) {
      skipped++;
      errors.push({ row: r.row, errors: r.errors });
      continue;
    }

    const data = {
      officeId: r.officeId!,
      name: r.name,
      type: r.type,
      serialNo: r.serialNo ?? null,
      assignedTo: r.assignedTo ?? null,
      status: r.status,
      manufacturer: r.manufacturer ?? null,
      model: r.model ?? null,
      colour: r.colour ?? null,
      subType: r.subType ?? null,
      operatingSystem: r.operatingSystem ?? null,
      description: r.description ?? null,
      supportLink: r.supportLink ?? null,
      activeServiceDate: r.activeServiceDate ?? null,
      department: r.department ?? null,
      assetCode:
        r.assetCode ??
        deriveAssetCode(r.serialNo ?? undefined, r.activeServiceDate ?? undefined) ??
        null,
      version: r.version ?? null,
      notes: r.notes ?? null,
      supplier: r.supplier ?? null,
      purchaseDate: r.purchaseDate ?? null,
      purchaseCost: r.purchaseCost ?? null,
      quantity: r.quantity ?? 1,
      warrantyUntil: r.warrantyUntil ?? null,
      material: r.material ?? null,
      dimensions: r.dimensions ?? null,
      condition: r.condition ?? null,
      locationDetail: r.locationDetail ?? null,
    };

    if (r.action === "update" && r.matchedAssetId) {
      await repo.updateAsset(
        db,
        r.matchedAssetId,
        sparseAssetUpdate(data, { statusProvided: r.statusProvided }),
      );
      updates++;
    } else {
      await repo.createAsset(db, data);
      inserts++;
    }
  }

  return { inserts, updates, skipped, errors };
}

async function loadAssetImportContext(db: Db) {
  const [users, offices, entities, existingAssets] = await Promise.all([
    repo.findUsersForImport(db),
    repo.findActiveOffices(db),
    repo.findEntitiesForImport(db),
    repo.findAllAssetsForImport(db),
  ]);

  const userByEmail = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    if (u.email) userByEmail.set(u.email.toLowerCase(), u);
  }
  const userByName = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    if (u.name) userByName.set(u.name.toLowerCase().replace(/\s+/g, " ").trim(), u);
  }

  const entityById = new Map(entities.map((e) => [e.id, e]));
  const officeByCountry = new Map<string, string>();
  for (const o of offices) {
    if (!officeByCountry.has(o.country)) officeByCountry.set(o.country, o.id);
  }
  const fallbackOfficeId = offices[0]?.id ?? null;

  const existingBySerial = new Map<string, string>();
  const existingByCode = new Map<string, string>();
  const existingByNaturalKey = new Map<string, string>();
  for (const a of existingAssets) {
    const serial = a.serialNo?.trim();
    if (serial) existingBySerial.set(serial, a.id);
    const code = a.assetCode?.trim();
    if (code) existingByCode.set(code, a.id);
    const natural = naturalAssetKey(a.officeId, a.name, a.purchaseDate);
    if (natural && !existingByNaturalKey.has(natural)) existingByNaturalKey.set(natural, a.id);
  }

  const officeById = new Map(offices.map((o) => [o.id, o.name]));

  return {
    userByEmail,
    userByName,
    entityById,
    officeByCountry,
    officeById,
    fallbackOfficeId,
    existingBySerial,
    existingByCode,
    existingByNaturalKey,
  };
}

async function resolveImportOffice(
  db: Db,
  office: AssetImportOffice | undefined,
  opts: { create: boolean },
): Promise<ImportOfficeTarget> {
  if (!office) return { id: null, willCreate: false };
  if (office.officeId) {
    const found = await repo.findOfficeById(db, office.officeId);
    if (!found) throw new NotFoundException("Office not found");
    return { id: found.id, willCreate: false };
  }
  if (!office.name || !office.city || !office.country) {
    return { id: null, willCreate: false };
  }
  const existing = await repo.findOfficeByName(db, office.name);
  if (existing) return { id: existing.id, willCreate: false };
  if (!opts.create) return { id: null, willCreate: true };
  const created = await repo.createOffice(db, {
    name: office.name,
    city: office.city,
    country: office.country,
    timezone: office.timezone ?? null,
  });
  return { id: created!.id, willCreate: false };
}

async function resolveAssetImportRows(
  rows: AssetImportRow[],
  ctx: Awaited<ReturnType<typeof loadAssetImportContext>>,
  target: ImportOfficeTarget = { id: null, willCreate: false },
) {
  if (!ctx.fallbackOfficeId) {
    throw new BadRequestException("No active offices configured — create an office before importing.");
  }

  const seenKeys = new Set<string>();
  const out: Array<{
    row: number;
    sourceSheet: string | null;
    type: string;
    name: string;
    manufacturer: string | null;
    model: string | null;
    colour: string | null;
    subType: string | null;
    serialNo: string | null;
    operatingSystem: string | null;
    status: string;
    description: string | null;
    supportLink: string | null;
    activeServiceDate: string | null;
    department: string | null;
    version: string | null;
    notes: string | null;
    assigneeRaw: string | null;
    assignedTo: string | null;
    assigneeName: string | null;
    officeId: string | null;
    officeName: string | null;
    action: "insert" | "update";
    matchedAssetId: string | null;
    statusProvided: boolean;
    supplier: string | null;
    purchaseDate: string | null;
    purchaseCost: number | null;
    quantity: number;
    warrantyUntil: string | null;
    material: string | null;
    dimensions: string | null;
    condition: string | null;
    locationDetail: string | null;
    assetCode: string | null;
    errors: string[];
    warnings: string[];
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const errors: string[] = [];
    const warnings: string[] = [];

    const assigneeRaw =
      normaliseEmail(r.assigneeEmail ?? null) ?? joinName(r.assigneeFirstName, r.assigneeLastName);

    let assignee: ReturnType<typeof ctx.userByEmail.get> = undefined;
    if (r.assigneeEmail) {
      const email = normaliseEmail(r.assigneeEmail);
      if (email) assignee = ctx.userByEmail.get(email);
    }
    if (!assignee && (r.assigneeFirstName || r.assigneeLastName)) {
      const key = joinName(r.assigneeFirstName, r.assigneeLastName);
      if (key) assignee = ctx.userByName.get(key.toLowerCase());
    }
    if (!assignee && (r.assigneeEmail || r.assigneeFirstName)) {
      warnings.push("assignee_not_found");
    }

    let officeId = target.willCreate ? null : (target.id ?? ctx.fallbackOfficeId);
    if (target.willCreate) warnings.push("office_will_be_created");
    if (!target.id && !target.willCreate && assignee?.entityId) {
      const ent = ctx.entityById.get(assignee.entityId);
      if (ent) {
        const oid = ctx.officeByCountry.get(ent.country);
        if (oid) officeId = oid;
      }
    }
    const officeName = officeId ? (ctx.officeById.get(officeId) ?? null) : null;

    const serialTrimmed = r.serialNo?.trim() || null;
    const codeTrimmed = r.assetCode?.trim() || null;
    const naturalKey = naturalAssetKey(officeId, r.name, r.purchaseDate ?? null);

    let action: "insert" | "update" = "insert";
    let matchedAssetId: string | null = null;
    if (codeTrimmed && !seenKeys.has(`code:${codeTrimmed}`)) {
      matchedAssetId = ctx.existingByCode.get(codeTrimmed) ?? null;
    }
    if (!matchedAssetId && serialTrimmed && !seenKeys.has(`serial:${serialTrimmed}`)) {
      matchedAssetId = ctx.existingBySerial.get(serialTrimmed) ?? null;
    }
    if (!matchedAssetId && naturalKey && !seenKeys.has(`nat:${naturalKey}`)) {
      matchedAssetId = ctx.existingByNaturalKey.get(naturalKey) ?? null;
    }
    if (matchedAssetId) action = "update";

    if (codeTrimmed) seenKeys.add(`code:${codeTrimmed}`);
    if (serialTrimmed) seenKeys.add(`serial:${serialTrimmed}`);
    if (naturalKey) seenKeys.add(`nat:${naturalKey}`);

    const status = (r.status ?? "available").trim() || "available";

    out.push({
      row: i + 1,
      sourceSheet: r.sourceSheet ?? null,
      type: r.type,
      name: r.name.slice(0, 300),
      manufacturer: r.manufacturer ?? null,
      model: r.model ?? null,
      colour: r.colour ?? null,
      subType: r.subType ?? null,
      serialNo: serialTrimmed,
      operatingSystem: r.operatingSystem ?? null,
      status,
      statusProvided: Boolean(r.status?.trim()),
      description: r.description ?? null,
      supportLink: r.supportLink ?? null,
      activeServiceDate: r.activeServiceDate ?? null,
      department: r.department ?? null,
      version: r.version ?? null,
      notes: r.notes ?? null,
      supplier: r.supplier ?? null,
      purchaseDate: r.purchaseDate ?? null,
      purchaseCost: r.purchaseCost ?? null,
      quantity: r.quantity ?? 1,
      warrantyUntil: r.warrantyUntil ?? null,
      material: r.material ?? null,
      dimensions: r.dimensions ?? null,
      condition: r.condition || null,
      locationDetail: r.locationDetail ?? null,
      assetCode: codeTrimmed,
      assigneeRaw,
      assignedTo: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
      officeId,
      officeName,
      action,
      matchedAssetId,
      errors,
      warnings,
    });
  }

  return out;
}
