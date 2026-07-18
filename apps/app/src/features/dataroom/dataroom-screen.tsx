import {
  ApiError,
  listDataRoomDocuments,
  dataRoomDocumentsQueryKey,
  type DataRoomDocument,
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

function canReadDataroom(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("dataroom:read") ||
    hasPermission("dataroom:upload") ||
    hasPermission("dataroom:manage")
  );
}

function DocumentRow({ document }: { document: DataRoomDocument }) {
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
        {document.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {document.category}
        {document.mimeType ? ` · ${document.mimeType}` : ""} · v
        {document.version}
      </Text>
      {document.description ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {document.description}
        </Text>
      ) : null}
      {document.uploader ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {document.uploader.name}
        </Text>
      ) : null}
    </View>
  );
}

export function DataroomScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadDataroom(hasPermission);

  const documentsQuery = useQuery({
    queryKey: dataRoomDocumentsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listDataRoomDocuments(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Dataroom" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view the dataroom.
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
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            Dataroom
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only document list by category. Download URLs, uploads, and
            folder management remain later. This is not Google Drive.
          </Text>
        </View>

        {documentsQuery.isPending ? (
          <LoadingState label="Loading dataroom…" />
        ) : null}

        {documentsQuery.isError ? (
          <Card title="Dataroom unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                documentsQuery.error,
                "We could not load dataroom documents.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry dataroom"
              pending={documentsQuery.isFetching}
              onPress={() => {
                void documentsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {documentsQuery.data ? (
          documentsQuery.data.data.length === 0 ? (
            <Card title="No documents">
              <Text selectable style={{ color: colors.textMuted }}>
                No dataroom documents are available yet.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Dataroom" style={{ gap: spacing.md }}>
              {documentsQuery.data.data.map((document) => (
                <DocumentRow key={document.id} document={document} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
