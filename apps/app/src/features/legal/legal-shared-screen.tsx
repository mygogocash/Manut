import {
  ApiError,
  legalSharedQueryKey,
  listSharedLegalDocuments,
  type LegalDocument,
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

function canViewShared(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("legal:view-shared");
}

function DocumentRow({ document }: { document: LegalDocument }) {
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
        {document.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {document.kind} · {document.status}
        {document.folder ? ` · ${document.folder}` : ""}
      </Text>
    </View>
  );
}

export function LegalSharedScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canViewShared(hasPermission);

  const sharedQuery = useQuery({
    queryKey: legalSharedQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listSharedLegalDocuments(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Shared legal" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view shared legal documents.
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
        <Card title="Shared legal" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Documents shared with you. Downloads remain deferred.
            </Text>
            {sharedQuery.isLoading ? (
              <LoadingState label="Loading shared documents…" />
            ) : null}
            {sharedQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    sharedQuery.error,
                    "Unable to load shared documents.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void sharedQuery.refetch()}
                />
              </View>
            ) : null}
            {sharedQuery.data?.data.length === 0 ? (
              <StatusMessage tone="warning">
                No shared documents found.
              </StatusMessage>
            ) : null}
            {sharedQuery.data?.data.map((document) => (
              <DocumentRow key={document.id} document={document} />
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
