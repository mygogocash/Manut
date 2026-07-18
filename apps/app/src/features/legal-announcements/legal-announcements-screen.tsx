import {
  ApiError,
  legalAnnouncementsQueryKey,
  listLegalAnnouncements,
  type LegalAnnouncement,
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

function canReadAnnouncements(
  hasPermission: (code: string) => boolean,
): boolean {
  return (
    hasPermission("legal:announcement-read") ||
    hasPermission("legal:announcement-manage")
  );
}

function kindLabel(kind: LegalAnnouncement["kind"]): string {
  switch (kind) {
    case "policy":
      return "Policy";
    case "authorized-persons":
      return "Authorized persons";
    case "handbook":
      return "Handbook";
    case "compliance":
      return "Compliance";
    case "other":
      return "Other";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function AnnouncementRow({
  announcement,
}: {
  announcement: LegalAnnouncement;
}) {
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
        {announcement.title}
        {announcement.pinned ? " · Pinned" : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {kindLabel(announcement.kind)} · {announcement.status}
        {announcement.requiresAck ? " · Ack required" : ""}
      </Text>
    </View>
  );
}

export function LegalAnnouncementsScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadAnnouncements(hasPermission);

  const announcementsQuery = useQuery({
    queryKey: legalAnnouncementsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listLegalAnnouncements(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Announcements" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view announcements.
          </StatusMessage>
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
        <Card title="Announcements" maxWidth={720}>
          <Text style={{ color: colors.textMuted }}>
            Read-only list. Bodies, acknowledgements, and attachments stay
            deferred.
          </Text>
        </Card>

        {announcementsQuery.isLoading ? (
          <LoadingState label="Loading announcements…" />
        ) : null}

        {announcementsQuery.isError ? (
          <StatusMessage tone="error">
            {errorMessage(
              announcementsQuery.error,
              "Unable to load announcements.",
            )}
          </StatusMessage>
        ) : null}

        {announcementsQuery.data ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>
              Items ({announcementsQuery.data.meta.total})
            </Text>
            {announcementsQuery.data.data.length === 0 ? (
              <StatusMessage tone="neutral">
                No announcements found.
              </StatusMessage>
            ) : (
              announcementsQuery.data.data.map((announcement) => (
                <AnnouncementRow
                  key={announcement.id}
                  announcement={announcement}
                />
              ))
            )}
            {announcementsQuery.isFetching ? (
              <Button
                label="Refresh"
                onPress={() => {
                  void announcementsQuery.refetch();
                }}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
