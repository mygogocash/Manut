import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { officeRepository } from "@/modules/office/office.repository";
import type {
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
} from "@/modules/office/office.validation";

// Room-booking grid: 30-min slots from 09:00 to 18:00 (last bookable
// slot is 17:30-18:00). Users pick one or more consecutive slots and
// the service stores a single booking spanning [timeSlot, endTime).
const ROOM_DAY_START = "09:00";
const ROOM_DAY_END = "18:00";
const ROOM_SLOT_MINUTES = 30;
// Cap a single booking session to 2 hours so a few people can't claim
// the whole afternoon. Mirrors the mobile facility-booking mockup HR
// approved by the booking workflow.
const ROOM_MAX_CONSECUTIVE_SLOTS = 4;
// Max booking length in minutes. Bookings are
// no longer locked to the 30-min grid — any minute boundaries are
// allowed — so the duration cap is expressed in minutes rather than
// slot count. Derived from the slot constants to keep the 2-hour cap.
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

// Inclusive list of `Date` objects between two ISO date strings, used
// to spread a multi-day room booking across one row per day. Both
// inputs are YYYY-MM-DD; we anchor everything to UTC midnight so the
// loop never drifts across a daylight-saving boundary.
function expandDates(startIso: string, endIso: string): Date[] {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const out: Date[] = [];
  for (
    let cursor = start.getTime();
    cursor <= end.getTime();
    cursor += 24 * 60 * 60 * 1000
  ) {
    out.push(new Date(cursor));
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
    out.push({
      time: fromMinutes(t),
      endTime: fromMinutes(t + ROOM_SLOT_MINUTES),
    });
  }
  return out;
}

const ROOM_GRID_SLOTS = buildRoomSlots();

/**
 * Builds the printable sticker code shown on the asset's QR label.
 * Mirrors the spreadsheet's `SerialNumber+ActiveServiceDate` pattern but
 * uses a hyphen + ISO-compact date so it survives a CSV round-trip.
 * Returns undefined when neither input is present — callers leave the
 * column null in that case.
 */
function deriveAssetCode(
  serialNo: string | undefined,
  activeServiceDate: string | undefined,
): string | undefined {
  if (!serialNo && !activeServiceDate) return undefined;
  const datePart = activeServiceDate ? activeServiceDate.replace(/-/g, "") : "";
  if (serialNo && datePart) return `${serialNo}-${datePart}`;
  return serialNo || datePart || undefined;
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

// Imports may contain mixed-case or padded addresses. Normalize formatting,
// but never translate an inherited provider/company domain into a Manut one.
function normaliseEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

function joinName(
  first: string | null | undefined,
  last: string | null | undefined,
): string | null {
  const v = `${first ?? ""} ${last ?? ""}`.replace(/\s+/g, " ").trim();
  return v.length > 0 ? v : null;
}

export class OfficeService {
  async listOffices() {
    return officeRepository.findOffices();
  }

  async createOffice(input: CreateOfficeInput) {
    return officeRepository.createOffice({
      name: input.name,
      address: input.address ?? undefined,
      city: input.city,
      country: input.country,
      timezone: input.timezone ?? undefined,
      capacity: input.capacity,
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }

  async updateOffice(id: string, input: UpdateOfficeInput) {
    const existing = await officeRepository.findOfficeById(id);
    if (!existing) throw new NotFoundException("Office not found");
    return officeRepository.updateOffice(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.capacity !== undefined && { capacity: input.capacity }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }

  async deleteOffice(id: string) {
    const existing = await officeRepository.findOfficeById(id);
    if (!existing) throw new NotFoundException("Office not found");
    return officeRepository.deleteOffice(id);
  }

  async listDesks(query: DeskQuery) {
    const desks = await officeRepository.findDesks({
      officeId: query.officeId,
      floor: query.floor,
    });

    const bookings = query.date
      ? await officeRepository.findDeskBookingsForDate(new Date(query.date))
      : [];
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
          ? {
              id: booking.employee.id,
              name: booking.employee.name,
              email: booking.employee.email,
            }
          : null,
        bookingId: booking?.id ?? null,
      };
    });
  }

  async listAllDesks(officeId?: string) {
    const desks = await officeRepository.findAllDesks({ officeId });
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

  async createDesk(input: CreateDeskInput) {
    const office = await officeRepository.findOfficeById(input.officeId);
    if (!office) throw new NotFoundException("Office not found");
    return officeRepository.createDesk({
      officeId: input.officeId,
      name: input.name,
      floor: input.floor ?? undefined,
      zone: input.zone ?? undefined,
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }

  async updateDesk(id: string, input: UpdateDeskInput) {
    const existing = await officeRepository.findDeskById(id);
    if (!existing) throw new NotFoundException("Desk not found");
    if (input.officeId) {
      const office = await officeRepository.findOfficeById(input.officeId);
      if (!office) throw new NotFoundException("Office not found");
    }
    return officeRepository.updateDesk(id, {
      ...(input.officeId !== undefined && { officeId: input.officeId }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.floor !== undefined && { floor: input.floor }),
      ...(input.zone !== undefined && { zone: input.zone }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }

  async deleteDesk(id: string) {
    const existing = await officeRepository.findDeskById(id);
    if (!existing) throw new NotFoundException("Desk not found");
    return officeRepository.deleteDesk(id);
  }

  async bookDesk(userId: string, input: BookDeskInput) {
    const desk = await officeRepository.findDeskById(input.deskId);
    if (!desk) throw new NotFoundException("Desk not found");
    if (!desk.isActive) throw new BadRequestException("Desk is not available");

    try {
      return await officeRepository.createDeskBooking({
        deskId: input.deskId,
        employeeId: userId,
        date: new Date(input.date),
      });
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new ConflictException(
          "This desk is already booked for the selected date",
        );
      }
      throw err;
    }
  }

  async cancelDeskBooking(bookingId: string, userId: string) {
    const booking = await officeRepository.findDeskBookingById(bookingId);
    if (!booking) throw new NotFoundException("Desk booking not found");
    if (booking.employeeId !== userId) {
      throw new ForbiddenException("You can only cancel your own bookings");
    }
    return officeRepository.deleteDeskBooking(bookingId);
  }

  async listRooms(query: RoomQuery) {
    const rooms = await officeRepository.findRooms({
      officeId: query.officeId,
    });

    const bookings = query.date
      ? await officeRepository.findRoomBookingsForDate(new Date(query.date))
      : [];

    const bookingsByRoom = new Map<string, typeof bookings>();
    for (const b of bookings) {
      const arr = bookingsByRoom.get(b.roomId) ?? [];
      arr.push(b);
      bookingsByRoom.set(b.roomId, arr);
    }

    return rooms.map((room) => {
      const roomBookings = bookingsByRoom.get(room.id) ?? [];
      // Variable-duration bookings can cover several grid slots. For
      // each 30-min slot, find any booking whose [start, end) range
      // contains the slot's start.
      const findBooking = (slotStart: string) => {
        const slotStartMin = toMinutes(slotStart);
        return roomBookings.find((b) => {
          const start = toMinutes(b.timeSlot);
          const end = toMinutes(
            b.endTime ?? fromMinutes(start + 60), // legacy hourly row
          );
          return slotStartMin >= start && slotStartMin < end;
        });
      };

      return {
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        // MeetingRoom has no `floor` column today; the frontend type is
        // already nullable so the UI handles this. Add a column if floor
        // search becomes a real ask.
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
            bookedBy: booking
              ? { id: booking.employee.id, name: booking.employee.name }
              : null,
            bookingId: booking?.id ?? null,
            // Only attach booking detail to the slot the booking
            // *starts* on so the UI doesn't repeat the same metadata
            // across every covered slot.
            title:
              booking && booking.timeSlot === time
                ? (booking.title ?? null)
                : null,
            description:
              booking && booking.timeSlot === time
                ? (booking.description ?? null)
                : null,
            attendeesCount:
              booking && booking.timeSlot === time
                ? (booking.attendeesCount ?? null)
                : null,
            bookingStart: booking?.timeSlot ?? null,
            bookingEnd: booking?.endTime ?? null,
          };
        }),
      };
    });
  }

  async listAllRooms(officeId?: string) {
    const rooms = await officeRepository.findAllRooms({ officeId });
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

  async createRoom(input: CreateRoomInput) {
    const office = await officeRepository.findOfficeById(input.officeId);
    if (!office) throw new NotFoundException("Office not found");
    return officeRepository.createRoom({
      officeId: input.officeId,
      name: input.name,
      capacity: input.capacity,
      amenities: joinAmenities(input.amenities),
      imageUrl: input.imageUrl || undefined,
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }

  async updateRoom(id: string, input: UpdateRoomInput) {
    const existing = await officeRepository.findRoomById(id);
    if (!existing) throw new NotFoundException("Room not found");
    if (input.officeId) {
      const office = await officeRepository.findOfficeById(input.officeId);
      if (!office) throw new NotFoundException("Office not found");
    }
    return officeRepository.updateRoom(id, {
      ...(input.officeId !== undefined && { officeId: input.officeId }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.capacity !== undefined && { capacity: input.capacity }),
      ...(input.amenities !== undefined && {
        amenities: joinAmenities(input.amenities) ?? null,
      }),
      ...(input.imageUrl !== undefined && {
        imageUrl: input.imageUrl || null,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }

  async deleteRoom(id: string) {
    const existing = await officeRepository.findRoomById(id);
    if (!existing) throw new NotFoundException("Room not found");
    return officeRepository.deleteRoom(id);
  }

  async bookRoom(userId: string, input: BookRoomInput) {
    const room = await officeRepository.findRoomById(input.roomId);
    if (!room) throw new NotFoundException("Meeting room not found");
    if (!room.isActive) throw new BadRequestException("Room is not available");

    const startMin = toMinutes(input.timeSlot);
    const endMin = input.endTime ? toMinutes(input.endTime) : startMin + 60; // legacy clients send no endTime → hourly default
    const endTime = fromMinutes(endMin);

    // The booking must sit inside the bookable window. Start / end can be
    // any minute; the old 30-minute grid lock was dropped;
    // the availability grid is still drawn in 30-min cells, but bookings
    // and the overlap check below are minute-accurate.
    const dayStart = toMinutes(ROOM_DAY_START);
    const dayEnd = toMinutes(ROOM_DAY_END);
    if (startMin < dayStart || endMin > dayEnd) {
      throw new BadRequestException("Time slot is outside the booking window");
    }
    const durationMin = endMin - startMin;
    if (durationMin < 1) {
      throw new BadRequestException("End time must be after start time");
    }
    if (durationMin > ROOM_MAX_BOOKING_MINUTES) {
      throw new BadRequestException(
        `Booking can be at most ${ROOM_MAX_BOOKING_MINUTES / 60} hours`,
      );
    }

    if (
      input.attendeesCount &&
      room.capacity > 0 &&
      input.attendeesCount > room.capacity
    ) {
      throw new BadRequestException(
        `Attendee count (${input.attendeesCount}) exceeds room capacity (${room.capacity})`,
      );
    }

    // Build the (inclusive) list of dates the request spans. Single-day
    // callers omit `endDate` and get a one-element list.
    const dates = expandDates(input.date, input.endDate ?? input.date);
    const seriesId = dates.length > 1 ? randomUUID() : null;

    // Overlap check per day. Any existing booking on the same room +
    // date whose [start, end) range crosses the requested window blocks
    // the entire series.
    for (const day of dates) {
      const sameDay = await officeRepository.findRoomBookingsForDate(day);
      const overlaps = sameDay.some((b) => {
        if (b.roomId !== input.roomId) return false;
        const bStart = toMinutes(b.timeSlot);
        const bEnd = toMinutes(b.endTime ?? fromMinutes(bStart + 60));
        return startMin < bEnd && endMin > bStart;
      });
      if (overlaps) {
        throw new ConflictException(
          dates.length > 1
            ? `This room is already booked on ${day.toISOString().slice(0, 10)} for part of the selected window`
            : "This room is already booked for part of the selected window",
        );
      }
    }

    // Single-day → single row. Multi-day → one row per day, sharing
    // `seriesId`, wrapped in a transaction so a late conflict rolls
    // every preceding row back.
    if (dates.length === 1) {
      return officeRepository.createRoomBooking({
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

    const created = await prisma.$transaction(
      dates.map((day) =>
        prisma.roomBooking.create({
          data: {
            roomId: input.roomId,
            employeeId: userId,
            date: day,
            timeSlot: input.timeSlot,
            endTime,
            seriesId,
            title: input.title,
            description: input.description,
            attendeesCount: input.attendeesCount,
          },
          include: {
            room: {
              include: { office: { select: { id: true, name: true } } },
            },
            employee: { select: { id: true, name: true, email: true } },
          },
        }),
      ),
    );
    // Return the first day so the caller still gets a single record.
    return created[0]!;
  }

  // Search across an arbitrary date range + time window. A room is
  // "available" when no existing booking on any day in [startDate,
  // endDate] overlaps [startTime, endTime). Used by the new
  // search-driven booking UI.
  //
  // Each occupied room ships the offending bookings back to the client
  // so the room card can render *who* has it and *when* — without that,
  // the "Busy" pill is a dead end (the user has to leave the page to
  // find out whether they should ask the current owner to release the
  // slot or just pick a different time).
  async searchRooms(input: SearchRoomsInput) {
    const rooms = await officeRepository.findRooms({
      officeId: input.officeId,
    });

    const dates = expandDates(input.startDate, input.endDate);
    const startMin = toMinutes(input.startTime);
    const endMin = toMinutes(input.endTime);

    // Pull every booking for each day in the window once, then
    // intersect per room.
    const bookingsByDay = await Promise.all(
      dates.map((d) => officeRepository.findRoomBookingsForDate(d)),
    );

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
      const dayIso = dates[i]!.toISOString().slice(0, 10);
      for (const b of dayBookings) {
        const bStart = toMinutes(b.timeSlot);
        const bEnd = toMinutes(b.endTime ?? fromMinutes(bStart + 60));
        const overlaps = startMin < bEnd && endMin > bStart;
        if (!overlaps) continue;
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
      // Multi-day series produce one row per day with the same
      // seriesId — collapse to a single entry (earliest day wins) so
      // the card doesn't repeat "Anna · 09:00–10:00" five times for a
      // week-long booking.
      const collapsed = new Map<string, ConflictEntry>();
      for (const c of raw) {
        const key = c.seriesId ?? c.bookingId;
        const prev = collapsed.get(key);
        if (!prev || c.date < prev.date) collapsed.set(key, c);
      }
      const conflicts = [...collapsed.values()].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime),
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
        status:
          conflicts.length > 0 ? ("occupied" as const) : ("available" as const),
        conflicts,
      };
    });

    if (input.status === "all") return enriched;
    return enriched.filter((r) => r.status === input.status);
  }

  async cancelRoomBooking(bookingId: string, userId: string) {
    const booking = await officeRepository.findRoomBookingById(bookingId);
    if (!booking) throw new NotFoundException("Room booking not found");
    if (booking.employeeId !== userId) {
      throw new ForbiddenException("You can only cancel your own bookings");
    }
    return officeRepository.deleteRoomBooking(bookingId);
  }

  async listMyRoomBookings(userId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    // Compare against the wall-clock HH:MM so a meeting that already
    // ended earlier today drops off the "upcoming" list. `endTime`
    // is persisted zero-padded ("09:00", "16:30"), which sorts
    // chronologically under a string `gt`.
    const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
    return officeRepository.findUpcomingRoomBookingsForUser(
      userId,
      todayStart,
      nowHHMM,
    );
  }

  async listAssets(query: AssetQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await officeRepository.findAssets(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAssetById(id: string) {
    const asset = await officeRepository.findAssetById(id);
    if (!asset) throw new NotFoundException("Asset not found");
    return asset;
  }

  async createAsset(input: CreateAssetInput) {
    return officeRepository.createAsset({
      officeId: input.officeId,
      name: input.name,
      type: input.type,
      serialNo: input.serialNo,
      assignedTo: input.assignedTo,
      purchaseDate: input.purchaseDate
        ? new Date(input.purchaseDate)
        : undefined,
      purchaseCost: input.purchaseCost,
      status: input.status,
      notes: input.notes,
      manufacturer: input.manufacturer,
      model: input.model,
      colour: input.colour,
      subType: input.subType,
      operatingSystem: input.operatingSystem,
      description: input.description,
      supportLink: input.supportLink || undefined,
      activeServiceDate: input.activeServiceDate
        ? new Date(input.activeServiceDate)
        : undefined,
      department: input.department,
      assetCode:
        input.assetCode ??
        deriveAssetCode(input.serialNo, input.activeServiceDate),
      version: input.version,
      quantity: input.quantity,
      usefulLifeMonths: input.usefulLifeMonths,
      bookValue: input.bookValue,
      disposalDate: input.disposalDate
        ? new Date(input.disposalDate)
        : undefined,
      sellingPrice: input.sellingPrice,
    });
  }

  async updateAsset(id: string, input: UpdateAssetInput) {
    const existing = await officeRepository.findAssetById(id);
    if (!existing) throw new NotFoundException("Asset not found");

    return officeRepository.updateAsset(id, {
      ...(input.officeId !== undefined && { officeId: input.officeId }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.serialNo !== undefined && { serialNo: input.serialNo }),
      ...(input.assignedTo !== undefined && {
        assignedTo: input.assignedTo ?? null,
      }),
      ...(input.purchaseDate !== undefined && {
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
      }),
      ...(input.purchaseCost !== undefined && {
        purchaseCost: input.purchaseCost,
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.manufacturer !== undefined && {
        manufacturer: input.manufacturer || null,
      }),
      ...(input.model !== undefined && { model: input.model || null }),
      ...(input.colour !== undefined && { colour: input.colour || null }),
      ...(input.subType !== undefined && { subType: input.subType || null }),
      ...(input.operatingSystem !== undefined && {
        operatingSystem: input.operatingSystem || null,
      }),
      ...(input.description !== undefined && {
        description: input.description || null,
      }),
      ...(input.supportLink !== undefined && {
        supportLink: input.supportLink || null,
      }),
      ...(input.activeServiceDate !== undefined && {
        activeServiceDate: input.activeServiceDate
          ? new Date(input.activeServiceDate)
          : null,
      }),
      ...(input.department !== undefined && {
        department: input.department || null,
      }),
      ...(input.assetCode !== undefined && {
        assetCode: input.assetCode || null,
      }),
      ...(input.version !== undefined && { version: input.version || null }),
      ...(input.quantity !== undefined && { quantity: input.quantity }),
      ...(input.usefulLifeMonths !== undefined && {
        usefulLifeMonths: input.usefulLifeMonths,
      }),
      ...(input.bookValue !== undefined && { bookValue: input.bookValue }),
      ...(input.disposalDate !== undefined && {
        disposalDate: input.disposalDate ? new Date(input.disposalDate) : null,
      }),
      ...(input.sellingPrice !== undefined && {
        sellingPrice: input.sellingPrice,
      }),
    });
  }

  async deleteAsset(id: string) {
    const existing = await officeRepository.findAssetById(id);
    if (!existing) throw new NotFoundException("Asset not found");
    return officeRepository.deleteAsset(id);
  }

  // ─── Bulk asset import ──────────────────────────────────
  //
  // Workflow mirrors `payroll.service.previewPayslipImport` /
  // `commitPayslipImport`: the FE parses the multi-sheet xlsx into
  // canonical rows, the BE resolves users + offices and writes.
  //
  // The first xlsx row whose serialNo matches an existing prod asset
  // updates that row in place; later rows with the same serial insert
  // as historical entries. Unresolved assignees (missing or typo email,
  // missing user) keep `assignedTo = null` and surface as warnings —
  // HR can wire them up from the UI later.

  async previewAssetImport(rows: AssetImportRow[]) {
    const ctx = await this.loadAssetImportContext();
    const resolved = await this.resolveAssetImportRows(rows, ctx);
    const summary = {
      total: resolved.length,
      valid: resolved.filter((r) => r.errors.length === 0).length,
      invalid: resolved.filter((r) => r.errors.length > 0).length,
      inserts: resolved.filter(
        (r) => r.errors.length === 0 && r.action === "insert",
      ).length,
      updates: resolved.filter(
        (r) => r.errors.length === 0 && r.action === "update",
      ).length,
      unresolvedAssignees: resolved.filter((r) =>
        r.warnings.includes("assignee_not_found"),
      ).length,
    };
    return { rows: resolved, summary };
  }

  async commitAssetImport(rows: AssetImportRow[]) {
    const ctx = await this.loadAssetImportContext();
    const resolved = await this.resolveAssetImportRows(rows, ctx);
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
        activeServiceDate: r.activeServiceDate
          ? new Date(r.activeServiceDate)
          : null,
        department: r.department ?? null,
        assetCode:
          deriveAssetCode(
            r.serialNo ?? undefined,
            r.activeServiceDate ?? undefined,
          ) ?? null,
        version: r.version ?? null,
        notes: r.notes ?? null,
      };

      if (r.action === "update" && r.matchedAssetId) {
        await officeRepository.updateAsset(r.matchedAssetId, data);
        updates++;
      } else {
        await officeRepository.createAsset(data);
        inserts++;
      }
    }

    return { inserts, updates, skipped, errors };
  }

  /**
   * One-shot fetch of the lookup tables the import flow needs. Hitting
   * the DB once and re-using the maps keeps preview / commit O(rows)
   * instead of O(rows × tables).
   */
  private async loadAssetImportContext() {
    const [users, offices, entities, existingAssets] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, email: true, name: true, entityId: true },
      }),
      prisma.office.findMany({
        where: { isActive: true },
        select: { id: true, name: true, country: true },
      }),
      prisma.entity.findMany({
        select: { id: true, code: true, country: true },
      }),
      prisma.asset.findMany({
        where: { serialNo: { not: null } },
        select: { id: true, serialNo: true },
      }),
    ]);

    const userByEmail = new Map<string, (typeof users)[number]>();
    for (const u of users) {
      if (u.email) userByEmail.set(u.email.toLowerCase(), u);
    }
    const userByName = new Map<string, (typeof users)[number]>();
    for (const u of users) {
      if (u.name) {
        userByName.set(u.name.toLowerCase().replace(/\s+/g, " ").trim(), u);
      }
    }

    const entityById = new Map(entities.map((e) => [e.id, e]));
    const officeByCountry = new Map<string, string>();
    for (const o of offices) {
      if (!officeByCountry.has(o.country)) officeByCountry.set(o.country, o.id);
    }
    const fallbackOfficeId = offices[0]?.id ?? null;

    const existingBySerial = new Map<string, string>();
    for (const a of existingAssets) {
      const s = a.serialNo?.trim();
      if (s) existingBySerial.set(s, a.id);
    }

    return {
      userByEmail,
      userByName,
      entityById,
      officeByCountry,
      fallbackOfficeId,
      existingBySerial,
    };
  }

  private async resolveAssetImportRows(
    rows: AssetImportRow[],
    ctx: Awaited<ReturnType<OfficeService["loadAssetImportContext"]>>,
  ) {
    if (!ctx.fallbackOfficeId) {
      throw new BadRequestException(
        "No active offices configured — create an office before importing.",
      );
    }

    const seenSerials = new Set<string>();
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
      errors: string[];
      warnings: string[];
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const errors: string[] = [];
      const warnings: string[] = [];

      const assigneeRaw =
        normaliseEmail(r.assigneeEmail ?? null) ??
        joinName(r.assigneeFirstName, r.assigneeLastName);

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

      let officeId = ctx.fallbackOfficeId;
      let officeName: string | null = null;
      if (assignee?.entityId) {
        const ent = ctx.entityById.get(assignee.entityId);
        if (ent) {
          const oid = ctx.officeByCountry.get(ent.country);
          if (oid) officeId = oid;
        }
      }
      if (officeId) {
        // Looking up the name is cheap and useful for the preview UI.
        // We don't bother caching: officeByCountry is small.
        for (const [country, id] of ctx.officeByCountry.entries()) {
          if (id === officeId) {
            officeName = country;
            break;
          }
        }
      }

      const serialTrimmed = r.serialNo?.trim() || null;
      let action: "insert" | "update" = "insert";
      let matchedAssetId: string | null = null;
      if (serialTrimmed && !seenSerials.has(serialTrimmed)) {
        const existingId = ctx.existingBySerial.get(serialTrimmed);
        if (existingId) {
          action = "update";
          matchedAssetId = existingId;
        }
      }
      if (serialTrimmed) seenSerials.add(serialTrimmed);

      // Status pass-through: already mapped client-side. We accept any
      // string since `Asset.status` is a free-form column; the UI
      // surfaces unknown values as the raw value.
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
        description: r.description ?? null,
        supportLink: r.supportLink ?? null,
        activeServiceDate: r.activeServiceDate ?? null,
        department: r.department ?? null,
        version: r.version ?? null,
        notes: r.notes ?? null,
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
}

export const officeService = new OfficeService();
