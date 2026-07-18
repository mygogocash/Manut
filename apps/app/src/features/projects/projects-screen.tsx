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
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

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

function ProjectRow({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open project ${project.name}`}
      onPress={onOpen}
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
    </Pressable>
  );
}

export function ProjectsScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canReadProjects(hasPermission);

  const projectsQuery = useQuery({
    queryKey: projectsQueryKey({ page: 1, limit: 20, team: "general" }),
    queryFn: ({ signal }) =>
      listProjects(api, { page: 1, limit: 20, team: "general" }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Projects" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view projects.
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
            Projects
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only general team project list. Boards, task writes, members,
            and team CRM workspaces remain later.
          </Text>
        </View>

        <Button
          label="Open dashboard"
          accessibilityLabel="Open projects dashboard"
          onPress={() => router.push("/projects/dashboard")}
        />

        {projectsQuery.isPending ? (
          <LoadingState label="Loading projects…" />
        ) : null}

        {projectsQuery.isError ? (
          <Card title="Projects unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                projectsQuery.error,
                "We could not load projects.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry projects"
              pending={projectsQuery.isFetching}
              onPress={() => {
                void projectsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {projectsQuery.data ? (
          projectsQuery.data.data.length === 0 ? (
            <Card title="No projects">
              <Text selectable style={{ color: colors.textMuted }}>
                No general projects are available yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Projects"
              style={{ gap: spacing.md }}
            >
              {projectsQuery.data.data.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onOpen={() => router.push(`/projects/${project.id}`)}
                />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
