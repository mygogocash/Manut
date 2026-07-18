import {
  ApiError,
  createProjectTask,
  createProjectTaskInputSchema,
  getProject,
  projectDetailQueryKey,
  type ProjectColumn,
  type ProjectDetail,
  type ProjectTask,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
  TextField,
} from "@manut/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
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

function canWriteProjectTasks(
  hasPermission: (code: string) => boolean,
): boolean {
  return (
    hasPermission("projects:update") ||
    hasPermission("projects:manage") ||
    hasPermission("it-crm:update") ||
    hasPermission("it-crm:manage") ||
    hasPermission("product-crm:update") ||
    hasPermission("product-crm:manage") ||
    hasPermission("legal-crm:update") ||
    hasPermission("legal-crm:manage") ||
    hasPermission("accounting-crm:update") ||
    hasPermission("accounting-crm:manage") ||
    hasPermission("hr-crm:update") ||
    hasPermission("hr-crm:manage")
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString().slice(0, 10);
}

function tasksForColumn(
  column: ProjectColumn,
  tasks: ProjectTask[],
): ProjectTask[] {
  return tasks.filter((task) => task.status === column.key);
}

function BoardColumnCard({
  column,
  tasks,
}: {
  column: ProjectColumn;
  tasks: ProjectTask[];
}) {
  const columnTasks = tasksForColumn(column, tasks);
  return (
    <Card title={column.label} maxWidth={720}>
      <View style={{ gap: spacing.sm }}>
        {columnTasks.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No tasks</Text>
        ) : (
          columnTasks.map((task) => (
            <View key={task.id} style={{ gap: spacing.xs }}>
              <Text selectable style={{ color: colors.text }}>
                {task.title}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {task.priority}
                {task.owner ? ` · ${task.owner.name}` : ""}
              </Text>
            </View>
          ))
        )}
      </View>
    </Card>
  );
}

function CreateTaskForm({
  project,
  onCreated,
}: {
  project: ProjectDetail;
  onCreated: (task: ProjectTask) => void;
}) {
  const api = useApiClient();
  const [title, setTitle] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const defaultStatus = project.columns[0]?.key ?? "todo";

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createProjectTask>[2]) =>
      createProjectTask(api, project.id, input),
    onSuccess: (task) => {
      setTitle("");
      setValidationError(null);
      setSuccessMessage(`Created "${task.title}".`);
      onCreated(task);
    },
  });

  function submit() {
    const parsed = createProjectTaskInputSchema.safeParse({
      title,
      status: defaultStatus,
    });
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? "Check the task title.",
      );
      return;
    }
    setValidationError(null);
    setSuccessMessage(null);
    createMutation.mutate(parsed.data);
  }

  return (
    <Card title="Create task" maxWidth={720}>
      <View style={{ gap: spacing.md }}>
        <Text style={{ color: colors.textMuted }}>
          Adds a task to the first board column ({defaultStatus}).
        </Text>
        <TextField
          label="Task title"
          value={title}
          onChangeText={setTitle}
          placeholder="Task title"
          editable={!createMutation.isPending}
        />
        {validationError ? (
          <StatusMessage tone="error">{validationError}</StatusMessage>
        ) : null}
        {createMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(createMutation.error, "We could not create the task.")}
          </StatusMessage>
        ) : null}
        {successMessage ? (
          <StatusMessage tone="success">{successMessage}</StatusMessage>
        ) : null}
        <Button
          label="Create task"
          pendingLabel="Creating…"
          accessibilityLabel="Create task"
          pending={createMutation.isPending}
          onPress={submit}
        />
      </View>
    </Card>
  );
}

export function ProjectDetailScreen() {
  const api = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId =
    typeof params.projectId === "string" ? params.projectId : "";
  const allowed = canReadProjects(hasPermission);
  const canWrite = canWriteProjectTasks(hasPermission);

  const detailQuery = useQuery({
    queryKey: projectDetailQueryKey(projectId),
    queryFn: ({ signal }) => getProject(api, projectId, signal),
    enabled: allowed && projectId.length > 0,
  });

  const boardColumns = useMemo(
    () => detailQuery.data?.columns ?? [],
    [detailQuery.data?.columns],
  );
  const boardTasks = useMemo(
    () => detailQuery.data?.tasks ?? [],
    [detailQuery.data?.tasks],
  );

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
          <>
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
              </View>
            </Card>

            {boardColumns.length > 0 ? (
              boardColumns.map((column) => (
                <BoardColumnCard
                  key={column.id}
                  column={column}
                  tasks={boardTasks}
                />
              ))
            ) : (
              <Card title="Board" maxWidth={720}>
                <Text style={{ color: colors.textMuted }}>
                  This project has no board columns yet.
                </Text>
              </Card>
            )}

            {canWrite ? (
              <CreateTaskForm
                project={detailQuery.data}
                onCreated={(task) => {
                  queryClient.setQueryData<ProjectDetail>(
                    projectDetailQueryKey(projectId),
                    (current) => {
                      if (!current) return current;
                      if (current.tasks.some((row) => row.id === task.id)) {
                        return current;
                      }
                      return {
                        ...current,
                        taskCount: current.taskCount + 1,
                        tasks: [...current.tasks, task],
                      };
                    },
                  );
                  void queryClient.invalidateQueries({
                    queryKey: projectDetailQueryKey(projectId),
                  });
                }}
              />
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
