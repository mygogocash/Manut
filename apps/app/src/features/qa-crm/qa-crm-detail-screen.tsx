import {
  ApiError,
  getQaCrmProject,
  qaCrmProjectDetailQueryKey,
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

function canReadQaCrm(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("qa-crm:read") || hasPermission("qa-crm:read-all");
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function QaCrmDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId =
    typeof params.projectId === "string" ? params.projectId : "";
  const allowed = canReadQaCrm(hasPermission);

  const detailQuery = useQuery({
    queryKey: qaCrmProjectDetailQueryKey(projectId),
    queryFn: ({ signal }) => getQaCrmProject(api, projectId, signal),
    enabled: allowed && projectId.length > 0,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="QA project" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view this QA project.
          </StatusMessage>
        </Card>
      </ScrollView>
    );
  }

  if (!projectId) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="QA project" maxWidth={720}>
          <StatusMessage tone="error">Project id is missing.</StatusMessage>
          <Button label="Back to QA CRM" onPress={() => router.push("/qa-crm")} />
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
        <Button
          label="Back to QA CRM"
          accessibilityLabel="Back to QA CRM"
          onPress={() => router.push("/qa-crm")}
        />

        {detailQuery.isPending ? (
          <LoadingState label="Loading QA project…" />
        ) : null}

        {detailQuery.isError ? (
          <Card title="QA project unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                detailQuery.error,
                "We could not load this QA project.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry QA project"
              pending={detailQuery.isFetching}
              onPress={() => {
                void detailQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {detailQuery.data ? (
          <Card title={detailQuery.data.name} maxWidth={720}>
            <View style={{ gap: spacing.md }}>
              <Text selectable style={{ color: colors.textMuted }}>
                {detailQuery.data.status}
                {detailQuery.data.department
                  ? ` · ${detailQuery.data.department}`
                  : ""}
              </Text>
              <Text selectable style={{ color: colors.text }}>
                Owner: {detailQuery.data.owner.name}
              </Text>
              {detailQuery.data.role ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  Role: {detailQuery.data.role}
                </Text>
              ) : null}
              <Text selectable style={{ color: colors.textMuted }}>
                Start: {formatDate(detailQuery.data.startDate)}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                End: {formatDate(detailQuery.data.endDate)}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                Issue board, notes, and writes remain later.
              </Text>
            </View>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
