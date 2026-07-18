import {
  ApiError,
  itCrmProjectsQueryKey,
  listItCrmProjects,
  type ItCrmProject,
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

function canReadItCrm(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("it-crm:read") ||
    hasPermission("it-crm:read-all") ||
    hasPermission("projects:read") ||
    hasPermission("projects:read-all")
  );
}

function ProjectRow({ project }: { project: ItCrmProject }) {
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
        {project.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {project.status}
        {project.department ? ` · ${project.department}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {project.owner.name}
      </Text>
    </View>
  );
}

export function ItCrmScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canReadItCrm(hasPermission);

  const listQuery = useQuery({
    queryKey: itCrmProjectsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listItCrmProjects(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="IT CRM" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view IT CRM.
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
            IT CRM
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only IT workspace list. Board, tasks, archive, and writes
            remain later.
          </Text>
        </View>

        <Button
          label="Open dashboard"
          accessibilityLabel="Open IT CRM dashboard"
          onPress={() => router.push("/it-crm/dashboard")}
        />

        {listQuery.isPending ? (
          <LoadingState label="Loading IT CRM…" />
        ) : null}

        {listQuery.isError ? (
          <Card title="IT CRM unavailable">
            <StatusMessage tone="error">
              {errorMessage(listQuery.error, "Unable to load IT CRM.")}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry IT CRM"
              pending={listQuery.isFetching}
              onPress={() => {
                void listQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {listQuery.data ? (
          listQuery.data.data.length === 0 ? (
            <Card title="IT CRM">
              <Text selectable style={{ color: colors.textMuted }}>
                No projects yet.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {listQuery.data.data.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
