import {
  ApiError,
  bookOfficeRoom,
  bookOfficeRoomInputSchema,
  cancelOfficeBooking,
  listMyOfficeBookings,
  listOfficeAssets,
  listOfficeRooms,
  listOffices,
  officeAssetsQueryKey,
  officeMyBookingsQueryKey,
  officeRoomsQueryKey,
  officesQueryKey,
  type BookOfficeRoomInput,
  type Office,
  type OfficeAsset,
  type OfficeBooking,
  type OfficeRoom,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  radii,
  spacing,
  StatusMessage,
  TextField,
} from "@manut/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

interface BookingDraft {
  roomId: string;
  date: string;
  timeSlot: string;
  endTime: string;
}

const emptyBookingDraft: BookingDraft = {
  roomId: "",
  date: "",
  timeSlot: "09:00",
  endTime: "10:00",
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadOffice(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("office:read") ||
    hasPermission("office:book") ||
    hasPermission("office:manage")
  );
}

function canBookOffice(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("office:book");
}

function formatBookingWindow(booking: OfficeBooking): string {
  const end = booking.endTime ?? booking.timeSlot;
  return `${booking.room.name} · ${booking.date} · ${booking.timeSlot}–${end}`;
}

function OfficeRow({ office }: { office: Office }) {
  return (
    <View
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {office.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {office.city}, {office.country}
        {office.capacity > 0 ? ` · Capacity ${office.capacity}` : ""}
        {office.isActive ? "" : " · Inactive"}
      </Text>
    </View>
  );
}

function RoomRow({ room }: { room: OfficeRoom }) {
  return (
    <View
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {room.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {room.office.name}
        {room.office.city ? ` · ${room.office.city}` : ""}
        {` · Seats ${room.capacity}`}
        {room.hasImage ? " · Has photo" : ""}
      </Text>
      {room.amenities.length > 0 ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {room.amenities.join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

function AssetRow({ asset }: { asset: OfficeAsset }) {
  return (
    <View
      style={{
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {asset.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {asset.type}
        {asset.serialNo ? ` · ${asset.serialNo}` : ""}
        {` · ${asset.status}`}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {asset.office.name}
        {asset.assignee ? ` · Assigned to ${asset.assignee.name}` : ""}
      </Text>
    </View>
  );
}

function RoomChoice({
  room,
  selected,
  onPress,
}: {
  room: OfficeRoom;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={room.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.borderStrong,
        borderRadius: radii.control,
        backgroundColor: selected
          ? colors.accent
          : pressed
            ? colors.canvas
            : colors.surfaceRaised,
      })}
    >
      <Text
        style={{
          color: selected ? colors.onAccent : colors.text,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {room.name}
      </Text>
    </Pressable>
  );
}

function MyBookingRow({
  booking,
  confirmingCancel,
  cancelling,
  onAskCancel,
  onConfirmCancel,
  onKeepCancel,
}: {
  booking: OfficeBooking;
  confirmingCancel: boolean;
  cancelling: boolean;
  onAskCancel: () => void;
  onConfirmCancel: () => void;
  onKeepCancel: () => void;
}) {
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {formatBookingWindow(booking)}
      </Text>
      {booking.title ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {booking.title}
        </Text>
      ) : null}
      {confirmingCancel ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.textMuted }}>
            Cancel this room booking?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Button
              label="Confirm cancel"
              pendingLabel="Cancelling…"
              accessibilityLabel={`Confirm cancel ${booking.room.name} booking`}
              pending={cancelling}
              onPress={onConfirmCancel}
            />
            <Button
              label="Keep booking"
              variant="secondary"
              disabled={cancelling}
              onPress={onKeepCancel}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Cancel booking"
          variant="secondary"
          accessibilityLabel={`Cancel booking ${booking.room.name}`}
          onPress={onAskCancel}
        />
      )}
    </View>
  );
}

export function OfficeScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const allowed = canReadOffice(hasPermission);
  const canBook = canBookOffice(hasPermission);

  const [draft, setDraft] = useState<BookingDraft>(emptyBookingDraft);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bookingValidation, setBookingValidation] = useState<string | null>(
    null,
  );
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(
    null,
  );

  const officesQuery = useQuery({
    queryKey: officesQueryKey(),
    queryFn: ({ signal }) => listOffices(api, signal),
    enabled: allowed,
  });

  const roomsQuery = useQuery({
    queryKey: officeRoomsQueryKey(),
    queryFn: ({ signal }) => listOfficeRooms(api, signal),
    enabled: allowed,
  });

  const assetsQuery = useQuery({
    queryKey: officeAssetsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listOfficeAssets(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  const myBookingsQuery = useQuery({
    queryKey: officeMyBookingsQueryKey(),
    queryFn: ({ signal }) => listMyOfficeBookings(api, signal),
    enabled: allowed && canBook,
  });

  const rooms = roomsQuery.data?.data ?? [];

  const bookMutation = useMutation({
    mutationFn: (input: BookOfficeRoomInput) => bookOfficeRoom(api, input),
    onSuccess: async () => {
      setSuccessMessage("Room booked.");
      setDraft(emptyBookingDraft);
      setConfirmingCancelId(null);
      await queryClient.invalidateQueries({ queryKey: officeRoomsQueryKey() });
      await queryClient.invalidateQueries({
        queryKey: officeMyBookingsQueryKey(),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => cancelOfficeBooking(api, bookingId),
    onSuccess: async () => {
      setSuccessMessage("Booking cancelled.");
      setConfirmingCancelId(null);
      await queryClient.invalidateQueries({
        queryKey: officeMyBookingsQueryKey(),
      });
      await queryClient.invalidateQueries({ queryKey: officeRoomsQueryKey() });
    },
  });

  const selectedRoomId = useMemo(() => {
    if (draft.roomId) return draft.roomId;
    return rooms[0]?.id ?? "";
  }, [draft.roomId, rooms]);

  function submitBooking() {
    const parsed = bookOfficeRoomInputSchema.safeParse({
      ...draft,
      roomId: selectedRoomId,
    });
    if (!parsed.success) {
      setBookingValidation(
        parsed.error.issues[0]?.message ?? "Check the booking fields.",
      );
      return;
    }
    setBookingValidation(null);
    setSuccessMessage(null);
    bookMutation.reset();
    bookMutation.mutate(parsed.data);
  }

  if (!allowed) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Card title="Office" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view office rooms and assets.
          </StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  const loading =
    officesQuery.isPending ||
    roomsQuery.isPending ||
    assetsQuery.isPending ||
    (canBook && myBookingsQuery.isPending);

  const error = officesQuery.isError
    ? officesQuery.error
    : roomsQuery.isError
      ? roomsQuery.error
      : assetsQuery.isError
        ? assetsQuery.error
        : canBook && myBookingsQuery.isError
          ? myBookingsQuery.error
          : null;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        paddingBottom: spacing.xxl,
      }}
    >
      <Card title="Office" maxWidth={720}>
        <Text selectable style={{ color: colors.textMuted }}>
          Browse offices, meeting rooms, and assets. Book rooms when you have
          office booking permission.
        </Text>
      </Card>

      {successMessage ? (
        <Card title="Success" maxWidth={720}>
          <StatusMessage tone="success">{successMessage}</StatusMessage>
        </Card>
      ) : null}

      {loading ? <LoadingState label="Loading office…" /> : null}

      {error ? (
        <Card title="Unable to load office" maxWidth={720}>
          <StatusMessage tone="error">
            {errorMessage(error, "We could not load office data.")}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            onPress={() => {
              void officesQuery.refetch();
              void roomsQuery.refetch();
              void assetsQuery.refetch();
              if (canBook) void myBookingsQuery.refetch();
            }}
          />
        </Card>
      ) : null}

      {canBook && roomsQuery.isSuccess ? (
        <Card title="Book a room" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Pick a room, date, and time window.
            </Text>
            <View style={{ gap: spacing.sm }}>
              {rooms.length === 0 ? (
                <Text style={{ color: colors.textMuted }}>
                  No active meeting rooms.
                </Text>
              ) : (
                rooms.map((room) => (
                  <RoomChoice
                    key={room.id}
                    room={room}
                    selected={selectedRoomId === room.id}
                    onPress={() =>
                      setDraft((current) => ({ ...current, roomId: room.id }))
                    }
                  />
                ))
              )}
            </View>
            <TextField
              label="Date"
              value={draft.date}
              placeholder="YYYY-MM-DD"
              onChangeText={(date) =>
                setDraft((current) => ({ ...current, date }))
              }
            />
            <TextField
              label="Start time"
              value={draft.timeSlot}
              placeholder="HH:MM"
              onChangeText={(timeSlot) =>
                setDraft((current) => ({ ...current, timeSlot }))
              }
            />
            <TextField
              label="End time"
              value={draft.endTime}
              placeholder="HH:MM"
              onChangeText={(endTime) =>
                setDraft((current) => ({ ...current, endTime }))
              }
            />
            {bookingValidation ? (
              <StatusMessage tone="error">{bookingValidation}</StatusMessage>
            ) : null}
            {bookMutation.isError ? (
              <StatusMessage tone="error">
                {errorMessage(bookMutation.error, "The room could not be booked.")}
              </StatusMessage>
            ) : null}
            <Button
              label="Book room"
              pendingLabel="Booking…"
              pending={bookMutation.isPending}
              disabled={rooms.length === 0}
              onPress={submitBooking}
            />
          </View>
        </Card>
      ) : null}

      {canBook && myBookingsQuery.isSuccess ? (
        <>
          <Card title="My bookings" maxWidth={720}>
            <Text selectable style={{ color: colors.textMuted }}>
              {myBookingsQuery.data.data.length === 0
                ? "No upcoming room bookings."
                : `${myBookingsQuery.data.data.length} upcoming booking(s)`}
            </Text>
          </Card>
          {myBookingsQuery.data.data.map((booking) => (
            <MyBookingRow
              key={booking.id}
              booking={booking}
              confirmingCancel={confirmingCancelId === booking.id}
              cancelling={
                cancelMutation.isPending &&
                cancelMutation.variables === booking.id
              }
              onAskCancel={() => {
                setSuccessMessage(null);
                cancelMutation.reset();
                setConfirmingCancelId(booking.id);
              }}
              onKeepCancel={() => setConfirmingCancelId(null)}
              onConfirmCancel={() => cancelMutation.mutate(booking.id)}
            />
          ))}
          {cancelMutation.isError ? (
            <Card title="Cancel failed" maxWidth={720}>
              <StatusMessage tone="error">
                {errorMessage(
                  cancelMutation.error,
                  "The booking could not be cancelled.",
                )}
              </StatusMessage>
            </Card>
          ) : null}
        </>
      ) : null}

      {officesQuery.isSuccess ? (
        <>
          <Card title="Locations" maxWidth={720}>
            <Text selectable style={{ color: colors.textMuted }}>
              {officesQuery.data.data.length === 0
                ? "No offices configured."
                : `${officesQuery.data.data.length} office location(s)`}
            </Text>
          </Card>
          {officesQuery.data.data.map((office) => (
            <OfficeRow key={office.id} office={office} />
          ))}
        </>
      ) : null}

      {roomsQuery.isSuccess ? (
        <>
          <Card title="Meeting rooms" maxWidth={720}>
            <Text selectable style={{ color: colors.textMuted }}>
              {roomsQuery.data.data.length === 0
                ? "No active meeting rooms."
                : `${roomsQuery.data.data.length} room(s)`}
            </Text>
          </Card>
          {roomsQuery.data.data.map((room) => (
            <RoomRow key={room.id} room={room} />
          ))}
        </>
      ) : null}

      {assetsQuery.isSuccess ? (
        <>
          <Card title="Assets" maxWidth={720}>
            <Text selectable style={{ color: colors.textMuted }}>
              {assetsQuery.data.data.length === 0
                ? "No assets in inventory."
                : `${assetsQuery.data.meta.total} asset(s)`}
            </Text>
          </Card>
          {assetsQuery.data.data.map((asset) => (
            <AssetRow key={asset.id} asset={asset} />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
