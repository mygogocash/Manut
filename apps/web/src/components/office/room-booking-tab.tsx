"use client";

import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  Clock,
  ImageIcon,
  Loader2,
  MapPin,
  Search,
  Settings2,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ManageRoomsDialog } from "@/components/office/manage-rooms-dialog";
import { Badge } from "@/components/shared/badge";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  bookRoom,
  cancelRoomBooking,
  listMyRoomBookings,
  type MyRoomBooking,
  type SearchedRoom,
  type SearchedRoomConflict,
  searchRooms,
} from "@/services/office.service";

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Guard date-fns against Invalid Date — a single bad row in the search
// response used to crash the whole /office page via global-error.tsx
// because `format()` throws "Invalid time value" synchronously during
// render. Return the raw date string (or a dash) instead of unwinding
// the React tree.
function safeFormatDate(
  iso: string | null | undefined,
  pattern: string,
  treatAsUtc = false,
): string {
  if (!iso) return "—";
  const suffix = treatAsUtc ? "T00:00:00Z" : "T00:00:00";
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}${suffix}` : iso;
  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) {
    // eslint-disable-next-line no-console
    console.warn("[office] safeFormatDate: invalid date input", { iso });
    return String(iso);
  }
  try {
    return format(d, pattern);
  } catch {
    return String(iso);
  }
}

type StatusFilter = "available" | "occupied" | "all";

interface PendingBooking {
  roomId: string;
  roomName: string;
  roomCapacity: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  spansDays: number;
}

// `<input type="time">` returns "" until the user has actually picked
// a value — guard before we ship it to zod. Free-form HH:MM on the
// 24-hour clock; operators can pick any minute.
function isHHMM(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function RoomBookingTab({
  canBook = true,
  canManage = false,
}: {
  canBook?: boolean;
  canManage?: boolean;
}) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [manageOpen, setManageOpen] = useState(false);

  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [rooms, setRooms] = useState<SearchedRoom[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [myBookings, setMyBookings] = useState<MyRoomBooking[]>([]);
  const [myBookingsLoading, setMyBookingsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchMyBookings = useCallback(async () => {
    if (!canBook) return;
    setMyBookingsLoading(true);
    try {
      const res = await listMyRoomBookings();
      setMyBookings(res.data);
    } catch (err) {
      // non-critical — silent fail keeps the booking tab usable.
      if (err instanceof ApiError && err.status !== 403) {
        toast.error(err.message);
      }
    } finally {
      setMyBookingsLoading(false);
    }
  }, [canBook]);

  useEffect(() => {
    void fetchMyBookings();
  }, [fetchMyBookings]);

  const cancelBookingById = useCallback(
    async (bookingId: string, label: string): Promise<boolean> => {
      if (!confirm(`Cancel ${label}? Cannot be undone.`)) return false;
      setCancellingId(bookingId);
      try {
        await cancelRoomBooking(bookingId);
        toast.success("Booking cancelled");
        setMyBookings((prev) => prev.filter((b) => b.id !== bookingId));
        return true;
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to cancel booking";
        toast.error(msg);
        return false;
      } finally {
        setCancellingId(null);
      }
    },
    [],
  );

  const handleCancelBooking = useCallback(
    (booking: MyRoomBooking) => {
      void cancelBookingById(
        booking.id,
        `${booking.room.name} on ${booking.date} ${booking.timeSlot}`,
      );
    },
    [cancelBookingById],
  );

  const [pending, setPending] = useState<PendingBooking | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState("");

  const [imagePreview, setImagePreview] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const runSearch = useCallback(async () => {
    if (!isHHMM(startTime) || !isHHMM(endTime)) {
      toast.error("Use HH:MM (24-hour)");
      return;
    }
    if (endTime <= startTime) {
      toast.error("End time must be after start time");
      return;
    }
    if (toDateString(endDate) < toDateString(startDate)) {
      toast.error("End date must be on or after the start date");
      return;
    }
    try {
      setSearching(true);
      const res = await searchRooms({
        startDate: toDateString(startDate),
        endDate: toDateString(endDate),
        startTime,
        endTime,
        status,
      });
      setRooms(res.data);
      setHasSearched(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to search rooms";
      toast.error(message);
    } finally {
      setSearching(false);
    }
  }, [startDate, endDate, startTime, endTime, status]);

  useEffect(() => {
    void runSearch();
    // Initial auto-search on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelConflict = useCallback(
    async (conflict: SearchedRoomConflict, roomName: string) => {
      const label = `${roomName} on ${conflict.date} ${conflict.startTime}–${conflict.endTime}`;
      const ok = await cancelBookingById(conflict.bookingId, label);
      // Refresh the room search so the freed slot flips back to Available.
      if (ok) void runSearch();
    },
    [cancelBookingById, runSearch],
  );

  function openBookingDialog(room: SearchedRoom) {
    const sStr = toDateString(startDate);
    const eStr = toDateString(endDate);
    const days =
      Math.round(
        (new Date(`${eStr}T00:00:00Z`).getTime() -
          new Date(`${sStr}T00:00:00Z`).getTime()) /
          (24 * 60 * 60 * 1000),
      ) + 1;
    setPending({
      roomId: room.id,
      roomName: room.name,
      roomCapacity: room.capacity,
      startDate: sStr,
      endDate: eStr,
      startTime,
      endTime,
      spansDays: days,
    });
    setTitle("");
    setDescription("");
    setAttendees("");
  }

  async function confirmBooking() {
    if (!pending) return;
    const attendeesNum = attendees ? Number(attendees) : undefined;
    if (
      attendeesNum !== undefined &&
      (!Number.isFinite(attendeesNum) || attendeesNum <= 0)
    ) {
      toast.error("Attendees must be a positive number");
      return;
    }
    if (
      attendeesNum !== undefined &&
      pending.roomCapacity > 0 &&
      attendeesNum > pending.roomCapacity
    ) {
      toast.error(
        `Attendees (${attendeesNum}) exceed room capacity (${pending.roomCapacity})`,
      );
      return;
    }
    try {
      setSubmitting(true);
      await bookRoom(pending.roomId, pending.startDate, pending.startTime, {
        endTime: pending.endTime,
        endDate:
          pending.endDate !== pending.startDate ? pending.endDate : undefined,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        attendeesCount: attendeesNum,
      });
      toast.success(
        pending.spansDays > 1
          ? `Room booked across ${pending.spansDays} days`
          : "Room booked",
      );
      setPending(null);
      void runSearch();
      void fetchMyBookings();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to book room";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`
        flex flex-col gap-4
        lg:flex-row
      `}
    >
      <aside
        className={`
          border-border bg-surface flex flex-col gap-3 rounded-lg border p-4
          lg:w-72 lg:shrink-0
        `}
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="text-muted-foreground size-4" />
          <h3 className="text-foreground text-sm font-semibold">
            Find a meeting room
          </h3>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px]">Start date</Label>
          <DatePicker
            value={startDate}
            onChange={(d) => {
              if (!d) return;
              setStartDate(d);
              if (toDateString(endDate) < toDateString(d)) setEndDate(d);
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px]">End date</Label>
          <DatePicker value={endDate} onChange={(d) => d && setEndDate(d)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rb-start-time" className="text-[11px]">
              Start time
            </Label>
            <Input
              id="rb-start-time"
              type="time"
              step={60}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rb-end-time" className="text-[11px]">
              End time
            </Label>
            <Input
              id="rb-end-time"
              type="time"
              step={60}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px]">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusFilter)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => void runSearch()}
          disabled={searching}
          className="mt-1"
        >
          {searching ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Search className="mr-1.5 size-3.5" />
          )}
          Find available rooms
        </Button>

        {canManage ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setManageOpen(true)}
          >
            <Settings2 className="mr-1.5 size-3.5" />
            Manage rooms
          </Button>
        ) : null}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-3">
        {canBook && (myBookingsLoading || myBookings.length > 0) ? (
          <div
            className={`
              border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
              shadow-sm
            `}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-foreground text-sm font-semibold">
                My upcoming bookings
                {myBookings.length > 0 ? ` (${myBookings.length})` : null}
              </h3>
              {myBookingsLoading ? (
                <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
              ) : null}
            </div>
            {myBookings.length > 0 ? (
              <ul className="divide-border flex flex-col divide-y">
                {myBookings.map((b) => (
                  <li
                    key={b.id}
                    className={`
                      flex flex-wrap items-center justify-between gap-2 py-1.5
                      text-xs
                    `}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">
                        {b.title ? `${b.title} — ` : null}
                        {b.room.name}
                      </p>
                      <p
                        className={`
                          text-muted-foreground mt-0.5 flex flex-wrap
                          items-center gap-x-2 gap-y-0.5 text-[11px]
                        `}
                      >
                        <span
                          className={`
                            inline-flex items-center gap-1 tabular-nums
                          `}
                        >
                          <CalendarDays className="size-3" />
                          {safeFormatDate(b.date, "EEE, MMM d")}
                        </span>
                        <span
                          className={`
                            inline-flex items-center gap-1 tabular-nums
                          `}
                        >
                          <Clock className="size-3" />
                          {b.timeSlot}
                          {b.endTime ? `–${b.endTime}` : null}
                        </span>
                        {b.room.office ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" />
                            {b.room.office.name}
                            {b.room.office.city
                              ? ` · ${b.room.office.city}`
                              : ""}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancellingId === b.id}
                      onClick={() => void handleCancelBooking(b)}
                    >
                      {cancellingId === b.id ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 size-3.5" />
                      )}
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">
                No upcoming reservations.
              </p>
            )}
          </div>
        ) : null}

        {searching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            {hasSearched
              ? "No rooms match the selected window. Try widening the time range or switching status to All."
              : "Pick a date and time, then click Find available rooms."}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                canBook={canBook}
                currentUserId={currentUserId}
                cancellingId={cancellingId}
                onCancelConflict={(c) =>
                  void handleCancelConflict(c, room.name)
                }
                onSelect={() => openBookingDialog(room)}
                onPreviewImage={() =>
                  room.imageUrl &&
                  setImagePreview({ url: room.imageUrl, name: room.name })
                }
              />
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={!!pending}
        onOpenChange={(next) => {
          if (!next && !submitting) setPending(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book {pending?.roomName}</DialogTitle>
            <DialogDescription>
              {pending
                ? `${safeFormatDate(pending.startDate, "EEE, MMM d, yyyy", true)}${
                    pending.spansDays > 1
                      ? ` → ${safeFormatDate(pending.endDate, "EEE, MMM d, yyyy", true)} (${pending.spansDays} days)`
                      : ""
                  } · ${pending.startTime}–${pending.endTime} — capacity ${pending.roomCapacity}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rb-title">Title</Label>
              <Input
                id="rb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly sync"
                maxLength={300}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rb-attendees">Attendees</Label>
              <Input
                id="rb-attendees"
                type="number"
                min={1}
                max={pending?.roomCapacity || undefined}
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder={
                  pending?.roomCapacity
                    ? `up to ${pending.roomCapacity}`
                    : "Number of people"
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rb-desc">Brief description</Label>
              <Textarea
                id="rb-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Purpose of the meeting"
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPending(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmBooking}
              disabled={submitting}
              className="min-w-28"
            >
              {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Confirm booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManageRoomsDialog open={manageOpen} onOpenChange={setManageOpen} />

      <Dialog
        open={!!imagePreview}
        onOpenChange={(next) => {
          if (!next) setImagePreview(null);
        }}
      >
        <DialogContent
          className={`
            flex max-h-[92vh] flex-col gap-2 p-3
            sm:max-w-4xl
          `}
        >
          <DialogHeader className="px-2">
            <DialogTitle className="text-base">
              {imagePreview?.name}
            </DialogTitle>
          </DialogHeader>
          {imagePreview ? (
            <div className="flex items-center justify-center bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview.url}
                alt={imagePreview.name}
                className="max-h-[78vh] max-w-full object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoomCard({
  room,
  canBook,
  currentUserId,
  cancellingId,
  onCancelConflict,
  onSelect,
  onPreviewImage,
}: {
  room: SearchedRoom;
  canBook: boolean;
  currentUserId: string | null;
  cancellingId: string | null;
  onCancelConflict: (conflict: SearchedRoomConflict) => void;
  onSelect: () => void;
  onPreviewImage: () => void;
}) {
  const available = room.status === "available";
  const officeLabel = room.office
    ? `${room.office.name}${room.office.city ? ` · ${room.office.city}` : ""}`
    : "—";
  return (
    <div
      className={`
        border-border bg-surface flex flex-col gap-3 overflow-hidden rounded-lg
        border p-3 shadow-sm
      `}
    >
      <div
        className={`
          flex flex-col gap-3
          sm:flex-row sm:items-center
        `}
      >
        {room.imageUrl ? (
          <button
            type="button"
            aria-label={`Preview ${room.name} photo`}
            onClick={onPreviewImage}
            className={`
              border-border size-20 shrink-0 overflow-hidden rounded-lg border
              hover:ring-primary/40 hover:ring-2
              sm:size-24
            `}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={room.imageUrl}
              alt={room.name}
              className="size-full object-cover"
            />
          </button>
        ) : (
          <div
            className={`
              border-border bg-muted/30 text-muted-foreground flex size-20
              shrink-0 items-center justify-center rounded-lg border
              border-dashed
              sm:size-24
            `}
          >
            <ImageIcon className="size-6" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold">
            {room.name}
          </p>
          <div
            className={`
              text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3
              gap-y-1 text-[11px]
            `}
          >
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              Capacity {room.capacity}
            </span>
            <span>{officeLabel}</span>
            {room.amenities.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {room.amenities.map((a) => (
                  <Badge key={a} variant="grey" className="text-[10px]">
                    {a}
                  </Badge>
                ))}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Badge variant={available ? "green" : "red"}>
            {available ? "Available" : "Busy"}
          </Badge>
          <Button
            size="sm"
            onClick={onSelect}
            disabled={!available || !canBook}
          >
            <Check className="mr-1 size-3.5" />
            Select
          </Button>
        </div>
      </div>

      {!available && room.conflicts.length > 0 ? (
        <ConflictList
          conflicts={room.conflicts}
          currentUserId={currentUserId}
          cancellingId={cancellingId}
          onCancel={onCancelConflict}
        />
      ) : null}
    </div>
  );
}

function ConflictList({
  conflicts,
  currentUserId,
  cancellingId,
  onCancel,
}: {
  conflicts: SearchedRoom["conflicts"];
  currentUserId: string | null;
  cancellingId: string | null;
  onCancel: (conflict: SearchedRoomConflict) => void;
}) {
  // Cap the visible rows so a heavily-booked room doesn't blow out the
  // card. Anything past the threshold collapses into a "+N more" hint.
  const VISIBLE = 3;
  const shown = conflicts.slice(0, VISIBLE);
  const hidden = conflicts.length - shown.length;
  return (
    <div
      className={`
        border-border/60 bg-muted/20 flex flex-col gap-1.5 rounded-md border
        border-dashed px-3 py-2
      `}
    >
      <p
        className={`
          text-muted-foreground text-[10px] font-semibold tracking-wide
          uppercase
        `}
      >
        Currently booked by
      </p>
      <ul className="flex flex-col gap-1">
        {shown.map((c) => {
          const isMine =
            currentUserId !== null && c.bookedBy.id === currentUserId;
          const isCancelling = cancellingId === c.bookingId;
          return (
            <li
              key={c.bookingId}
              className={`
                text-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5
                text-[11px]
              `}
            >
              <span className="inline-flex items-center gap-1 font-medium">
                <User className="text-muted-foreground size-3" />
                {c.bookedBy.name}
              </span>
              <span
                className={`
                  text-muted-foreground inline-flex items-center gap-1
                  tabular-nums
                `}
              >
                <Clock className="size-3" />
                {safeFormatDate(c.date, "MMM d")} · {c.startTime}–{c.endTime}
              </span>
              {c.title ? (
                <span className="text-muted-foreground truncate">
                  — {c.title}
                </span>
              ) : null}
              {isMine ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-6 px-2 text-[11px]"
                  disabled={isCancelling}
                  onClick={() => onCancel(c)}
                >
                  {isCancelling ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 size-3" />
                  )}
                  Cancel
                </Button>
              ) : null}
            </li>
          );
        })}
        {hidden > 0 ? (
          <li className="text-muted-foreground text-[11px]">
            +{hidden} more booking{hidden === 1 ? "" : "s"} in this window
          </li>
        ) : null}
      </ul>
    </div>
  );
}
