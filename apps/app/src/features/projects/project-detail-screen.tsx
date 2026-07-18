import {
  ApiError,
  getProject,
  projectDetailQueryKey,
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

function canReadProjects(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("projects:read") ||
    hasPermission("projects:read-all") ||
    hasPermission("it-crm:read") ||
    hasPermission("it-crm:read-all") ||
    hasPermission("product-crm:read") ||
    hasPermission("product-crm:read-all") ||
    hasPermission("legal-crm:read") ||
    hasPermission("legal-crm:read-all") ||
    hasPermission("accounting-crm:read") ||
    hasPermission("accounting-crm:read-all") ||
    hasPermission("hr-crm:read") ||
    hasPermission("hr-crm:read-all")
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function ProjectDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId =
    typeof params.projectId === "string" ? params.projectId : "";
  const allowed = canReadProjects(hasPermission);

  const detailQuery = useQuery({
    queryKey: projectDetailQueryKey(projectId),
    queryFn: ({ signal }) => getProject(api, projectId, signal),
    enabled: allowed && projectId.length > 0,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Project" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view this project.
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
        <Card title="Project" maxWidth={720}>
          <StatusMessage tone="error">Project id is missing.</StatusMessage>
          <Button label="Back to projects" onPress={() => router.push("/projects")} />
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
          label="Back to projects"
          accessibilityLabel="Back to projects"
          onPress={() => router.push("/projects")}
        />

        {detailQuery.isPending ? (
          <LoadingState label="Loading project…" />
        ) : null}

        {detailQuery.isError ? (
          <Card title="Project unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                detailQuery.error,
                "We could not load this project.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry project"
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
                {detailQuery.data.status} · {detailQuery.data.team}
                {detailQuery.data.department
                  ? ` · ${detailQuery.data.department}`
                  : ""}
              </Text>
              <Text selectable style={{ color: colors.text }}>
                Owner: {detailQuery.data.owner.name}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                Tasks: {detailQuery.data.taskCount}
              </Text>
              {detailQuery.data.workstream ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  Workstream: {detailQuery.data.workstream}
                </Text>
              ) : null}
              <Text selectable style={{ color: colors.textMuted }}>
                Start: {formatDate(detailQuery.data.startDate)}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                End: {formatDate(detailQuery.data.endDate)}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                Go-live: {formatDate(detailQuery.data.goLiveDate)}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                Board, task writes, and members remain later.
              </Text>
            </View>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
