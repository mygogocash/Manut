import {
  ApiError,
  legalDocumentsQueryKey,
  listLegalDocuments,
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
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadLegal(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("legal:read") ||
    hasPermission("legal:create") ||
    hasPermission("legal:update") ||
    hasPermission("legal:delete")
  );
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
        {document.reference ? ` · ${document.reference}` : ""}
        {document.entityName ? ` · ${document.entityName}` : ""}
      </Text>
    </View>
  );
}

export function LegalScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canReadLegal(hasPermission);

  const documentsQuery = useQuery({
    queryKey: legalDocumentsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listLegalDocuments(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Legal" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view legal documents.
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
        <Card title="Legal" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only legal document list. Sharing, signatures, and uploads
              remain deferred.
            </Text>
            <Button
              label="Shared with me"
      pendingLabel="Working…"
              onPress={() => router.push("/legal/shared")}
            />
            <Button
              label="Announcements"
      pendingLabel="Working…"
              onPress={() => router.push("/legal/announcements")}
            />
            {documentsQuery.isLoading ? (
              <LoadingState label="Loading legal documents…" />
            ) : null}
            {documentsQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    documentsQuery.error,
                    "Unable to load legal documents.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void documentsQuery.refetch()}
                />
              </View>
            ) : null}
            {documentsQuery.data?.data.length === 0 ? (
              <StatusMessage tone="warning">No legal documents found.</StatusMessage>
            ) : null}
            {documentsQuery.data?.data.map((document) => (
              <DocumentRow key={document.id} document={document} />
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
