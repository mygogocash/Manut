import {
  ApiError,
  listOfficeAssets,
  listOfficeRooms,
  listOffices,
  officeAssetsQueryKey,
  officeRoomsQueryKey,
  officesQueryKey,
  type Office,
  type OfficeAsset,
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
} from "@manut/ui";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

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

export function OfficeScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadOffice(hasPermission);

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
    officesQuery.isPending || roomsQuery.isPending || assetsQuery.isPending;
  const error = officesQuery.isError
    ? officesQuery.error
    : roomsQuery.isError
      ? roomsQuery.error
      : assetsQuery.isError
        ? assetsQuery.error
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
          Read-only offices, meeting rooms, and assets. Booking self-serve and
          manage CRUD stay deferred for a later slice.
        </Text>
      </Card>

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
            }}
          />
        </Card>
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
