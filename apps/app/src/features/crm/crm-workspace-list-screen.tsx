import {
  ApiError,
  type ApiClient,
  type CrmWorkspaceProject,
  type RequestAbortSignal,
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

function ProjectRow({ project }: { project: CrmWorkspaceProject }) {
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

export function CrmWorkspaceListScreen({
  title,
  subtitle,
  permissionCodes,
  queryKey,
  list,
}: {
  title: string;
  subtitle: string;
  permissionCodes: readonly string[];
  queryKey: readonly unknown[];
  list: (
    client: ApiClient,
    params: { page: number; limit: number },
    signal?: RequestAbortSignal,
  ) => Promise<{ data: CrmWorkspaceProject[] }>;
}) {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = permissionCodes.some((code) => hasPermission(code));

  const listQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => list(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title={title} maxWidth={720}>
          <StatusMessage tone="error">
            {`You do not have permission to view ${title.toLowerCase()}.`}
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
            {title}
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {subtitle}
          </Text>
        </View>

        {listQuery.isPending ? (
          <LoadingState label={`Loading ${title.toLowerCase()}…`} />
        ) : null}

        {listQuery.isError ? (
          <Card title={`${title} unavailable`}>
            <View style={{ gap: spacing.md }}>
              <StatusMessage tone="error">
                {errorMessage(
                  listQuery.error,
                  `Unable to load ${title.toLowerCase()}.`,
                )}
              </StatusMessage>
              <Button
                label="Retry"
                pendingLabel="Retrying…"
                accessibilityLabel={`Retry ${title}`}
                pending={listQuery.isFetching}
                onPress={() => {
                  void listQuery.refetch();
                }}
              />
            </View>
          </Card>
        ) : null}

        {listQuery.data ? (
          listQuery.data.data.length === 0 ? (
            <Card title={title}>
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
