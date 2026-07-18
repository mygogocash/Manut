import {
  ApiError,
  listProjects,
  projectsQueryKey,
  type Project,
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

function canReadHrCrm(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("hr-crm:read") ||
    hasPermission("hr-crm:read-all") ||
    hasPermission("projects:read") ||
    hasPermission("projects:read-all")
  );
}

function ProjectRow({ project }: { project: Project }) {
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
        {project.status} · {project.team}
        {project.department ? ` · ${project.department}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {project.owner.name} · {project.taskCount} task
        {project.taskCount === 1 ? "" : "s"}
      </Text>
    </View>
  );
}

export function HrCrmScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadHrCrm(hasPermission);

  const projectsQuery = useQuery({
    queryKey: projectsQueryKey({ page: 1, limit: 20, team: "hr" }),
    queryFn: ({ signal }) =>
      listProjects(api, { page: 1, limit: 20, team: "hr" }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="HR CRM" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view HR CRM projects.
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
            HR CRM
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only HR team projects via GET /projects?team=hr. Board,
            budget, and writes remain later.
          </Text>
        </View>

        {projectsQuery.isPending ? (
          <LoadingState label="Loading HR projects…" />
        ) : null}

        {projectsQuery.isError ? (
          <Card title="HR projects unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                projectsQuery.error,
                "We could not load HR CRM projects.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry HR CRM projects"
              pending={projectsQuery.isFetching}
              onPress={() => {
                void projectsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {projectsQuery.data ? (
          projectsQuery.data.data.length === 0 ? (
            <Card title="No HR projects">
              <Text selectable style={{ color: colors.textMuted }}>
                No HR team projects are available yet.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="HR projects" style={{ gap: spacing.md }}>
              {projectsQuery.data.data.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
