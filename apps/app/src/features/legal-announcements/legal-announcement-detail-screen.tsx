import {
  ApiError,
  getLegalAnnouncement,
  legalAnnouncementDetailQueryKey,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
} from "@manut/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadAnnouncements(
  hasPermission: (code: string) => boolean,
): boolean {
  return (
    hasPermission("legal:announcement-read") ||
    hasPermission("legal:announcement-manage")
  );
}

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
    return value[0];
  }
  return null;
}

export function LegalAnnouncementDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);
  const allowed = canReadAnnouncements(hasPermission);

  const detailQuery = useQuery({
    queryKey: legalAnnouncementDetailQueryKey(id ?? ""),
    queryFn: ({ signal }) => getLegalAnnouncement(api, id!, signal),
    enabled: allowed && id !== null,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Announcement" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view announcements.
          </StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  if (!id) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Announcement" maxWidth={720}>
          <StatusMessage tone="error">Missing announcement id.</StatusMessage>
          <Button
            label="Back to announcements"
      pendingLabel="Working…"
            onPress={() => router.push("/legal/announcements")}
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        gap: spacing.lg,
        padding: spacing.xxl,
        backgroundColor: colors.canvas,
      }}
    >
      <View style={{ width: "100%", maxWidth: 720, gap: spacing.lg }}>
        <Card title="Announcement" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            {detailQuery.isLoading ? (
              <LoadingState label="Loading announcement…" />
            ) : null}
            {detailQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    detailQuery.error,
                    "Unable to load announcement.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void detailQuery.refetch()}
                />
              </View>
            ) : null}
            {detailQuery.data ? (
              <View style={{ gap: spacing.sm }}>
                <Text
                  selectable
                  style={{ fontWeight: "600", color: colors.text }}
                >
                  {detailQuery.data.title}
                  {detailQuery.data.pinned ? " · Pinned" : ""}
                </Text>
                <Text selectable style={{ color: colors.textMuted }}>
                  {detailQuery.data.kind} · {detailQuery.data.status}
                  {detailQuery.data.requiresAck ? " · Ack required" : ""}
                  {detailQuery.data.myAckedAt ? " · Acknowledged" : ""}
                </Text>
                <Text selectable style={{ color: colors.text }}>
                  {detailQuery.data.body}
                </Text>
                {detailQuery.data.attachmentNames.length > 0 ? (
                  <Text selectable style={{ color: colors.textMuted }}>
                    Attachments: {detailQuery.data.attachmentNames.join(", ")}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Button
              label="Back to announcements"
      pendingLabel="Working…"
              onPress={() => router.push("/legal/announcements")}
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
