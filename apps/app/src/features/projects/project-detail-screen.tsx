import {
  ApiError,
  createProjectTask,
  createProjectTaskInputSchema,
  deleteProjectTask,
  getProject,
  listProjectMembers,
  PROJECT_TASK_PRIORITIES,
  PROJECT_TASK_PRIORITY_DEFAULT,
  projectDetailQueryKey,
  projectMembersQueryKey,
  reorderProjectTasks,
  type ProjectColumn,
  type ProjectDetail,
  type ProjectTask,
  updateProjectTask,
  updateProjectTaskInputSchema,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  radii,
  spacing,
  StatusMessage,
  TextField,
} from "@manut/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
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

function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: selected ? colors.text : colors.border,
        backgroundColor: selected ? colors.surfaceRaised : colors.canvas,
      }}
    >
      <Text style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

function TaskBoardCard({
  task,
  columns,
  canWrite,
  busy,
  onMove,
  onSaveTitle,
  onDelete,
}: {
  task: ProjectTask;
  columns: ProjectColumn[];
  canWrite: boolean;
  busy: boolean;
  onMove: (status: string) => void;
  onSaveTitle: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [validationError, setValidationError] = useState<string | null>(null);

  function submitTitle() {
    const parsed = updateProjectTaskInputSchema.safeParse({ title });
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? "Check the task title.",
      );
      return;
    }
    setValidationError(null);
    onSaveTitle(parsed.data.title ?? title);
    setEditing(false);
  }

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      {editing ? (
        <>
          <TextField
            label="Edit task title"
            value={title}
            onChangeText={setTitle}
            editable={!busy}
          />
          {validationError ? (
            <StatusMessage tone="error">{validationError}</StatusMessage>
          ) : null}
          <Button
            label="Save title"
            pendingLabel="Saving…"
            accessibilityLabel={`Save title for ${task.title}`}
            pending={busy}
            onPress={submitTitle}
          />
          <Button
            label="Cancel edit"
            accessibilityLabel={`Cancel edit for ${task.title}`}
            onPress={() => {
              setTitle(task.title);
              setEditing(false);
              setValidationError(null);
            }}
          />
        </>
      ) : (
        <>
          <Text selectable style={{ color: colors.text }}>
            {task.title}
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {task.priority}
            {task.owner ? ` · ${task.owner.name}` : ""}
          </Text>
        </>
      )}

      {canWrite && !editing ? (
        <View style={{ gap: spacing.xs }}>
          <Button
            label="Edit title"
            accessibilityLabel={`Edit title for ${task.title}`}
            onPress={() => setEditing(true)}
          />
          {columns
            .filter((column) => column.key !== task.status)
            .map((column) => (
              <Button
                key={column.id}
                label={`Move to ${column.label}`}
                pendingLabel="Moving…"
                accessibilityLabel={`Move ${task.title} to ${column.label}`}
                pending={busy}
                onPress={() => onMove(column.key)}
              />
            ))}
          <Button
            label="Delete task"
            pendingLabel="Deleting…"
            accessibilityLabel={`Delete ${task.title}`}
            pending={busy}
            onPress={onDelete}
          />
        </View>
      ) : null}
    </View>
  );
}

function BoardColumnCard({
  column,
  tasks,
  columns,
  canWrite,
  busyTaskId,
  onMove,
  onSaveTitle,
  onDelete,
}: {
  column: ProjectColumn;
  tasks: ProjectTask[];
  columns: ProjectColumn[];
  canWrite: boolean;
  busyTaskId: string | null;
  onMove: (task: ProjectTask, status: string) => void;
  onSaveTitle: (task: ProjectTask, title: string) => void;
  onDelete: (task: ProjectTask) => void;
}) {
  const columnTasks = tasksForColumn(column, tasks);
  return (
    <Card title={column.label} maxWidth={720}>
      <View style={{ gap: spacing.sm }}>
        {columnTasks.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No tasks</Text>
        ) : (
          columnTasks.map((task) => (
            <TaskBoardCard
              key={task.id}
              task={task}
              columns={columns}
              canWrite={canWrite}
              busy={busyTaskId === task.id}
              onMove={(status) => onMove(task, status)}
              onSaveTitle={(title) => onSaveTitle(task, title)}
              onDelete={() => onDelete(task)}
            />
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
  const [status, setStatus] = useState(project.columns[0]?.key ?? "todo");
  const [priority, setPriority] = useState<
    (typeof PROJECT_TASK_PRIORITIES)[number]
  >(PROJECT_TASK_PRIORITY_DEFAULT);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      status,
      priority,
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
          Choose a board column and priority, then create the task.
        </Text>
        <TextField
          label="Task title"
          value={title}
          onChangeText={setTitle}
          placeholder="Task title"
          editable={!createMutation.isPending}
        />
        {project.columns.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.textMuted }}>Column</Text>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
            >
              {project.columns.map((column) => (
                <Chip
                  key={column.id}
                  label={column.label}
                  selected={status === column.key}
                  disabled={createMutation.isPending}
                  onPress={() => setStatus(column.key)}
                />
              ))}
            </View>
          </View>
        ) : null}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.textMuted }}>Priority</Text>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            {PROJECT_TASK_PRIORITIES.map((value) => (
              <Chip
                key={value}
                label={value}
                selected={priority === value}
                disabled={createMutation.isPending}
                onPress={() => setPriority(value)}
              />
            ))}
          </View>
        </View>
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
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: projectDetailQueryKey(projectId),
    queryFn: ({ signal }) => getProject(api, projectId, signal),
    enabled: allowed && projectId.length > 0,
  });

  const membersQuery = useQuery({
    queryKey: projectMembersQueryKey(projectId),
    queryFn: ({ signal }) => listProjectMembers(api, projectId, signal),
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

  function invalidateBoard() {
    void queryClient.invalidateQueries({
      queryKey: projectDetailQueryKey(projectId),
    });
  }

  const moveMutation = useMutation({
    mutationFn: ({
      task,
      status,
    }: {
      task: ProjectTask;
      status: string;
    }) => {
      const targetIds = [
        ...boardTasks
          .filter((row) => row.status === status && row.id !== task.id)
          .map((row) => row.id),
        task.id,
      ];
      return reorderProjectTasks(api, projectId, {
        orderedIds: targetIds,
        status,
      });
    },
    onMutate: ({ task }) => setBusyTaskId(task.id),
    onSettled: () => setBusyTaskId(null),
    onSuccess: invalidateBoard,
  });

  const titleMutation = useMutation({
    mutationFn: ({ task, title }: { task: ProjectTask; title: string }) =>
      updateProjectTask(api, projectId, task.id, { title }),
    onMutate: ({ task }) => setBusyTaskId(task.id),
    onSettled: () => setBusyTaskId(null),
    onSuccess: (updated) => {
      queryClient.setQueryData<ProjectDetail>(
        projectDetailQueryKey(projectId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            tasks: current.tasks.map((row) =>
              row.id === updated.id ? updated : row,
            ),
          };
        },
      );
      invalidateBoard();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (task: ProjectTask) =>
      deleteProjectTask(api, projectId, task.id),
    onMutate: (task) => setBusyTaskId(task.id),
    onSettled: () => setBusyTaskId(null),
    onSuccess: (_result, task) => {
      queryClient.setQueryData<ProjectDetail>(
        projectDetailQueryKey(projectId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            taskCount: Math.max(0, current.taskCount - 1),
            tasks: current.tasks.filter((row) => row.id !== task.id),
          };
        },
      );
      invalidateBoard();
    },
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

        {moveMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(moveMutation.error, "We could not move the task.")}
          </StatusMessage>
        ) : null}
        {titleMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(titleMutation.error, "We could not update the task.")}
          </StatusMessage>
        ) : null}
        {deleteMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(
              deleteMutation.error,
              "We could not delete the task.",
            )}
          </StatusMessage>
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

            <Card title="Members" maxWidth={720}>
              {membersQuery.isPending ? (
                <LoadingState label="Loading members…" />
              ) : null}
              {membersQuery.isError ? (
                <StatusMessage tone="error">
                  {errorMessage(
                    membersQuery.error,
                    "We could not load members.",
                  )}
                </StatusMessage>
              ) : null}
              {membersQuery.data ? (
                membersQuery.data.length === 0 ? (
                  <Text style={{ color: colors.textMuted }}>
                    No members listed.
                  </Text>
                ) : (
                  <View
                    accessibilityLabel="Project members"
                    style={{ gap: spacing.sm }}
                  >
                    {membersQuery.data.map((member) => (
                      <Text
                        key={member.id}
                        selectable
                        style={{ color: colors.text }}
                      >
                        {member.user.name} · {member.role}
                      </Text>
                    ))}
                  </View>
                )
              ) : null}
            </Card>

            {boardColumns.length > 0 ? (
              boardColumns.map((column) => (
                <BoardColumnCard
                  key={column.id}
                  column={column}
                  tasks={boardTasks}
                  columns={boardColumns}
                  canWrite={canWrite}
                  busyTaskId={busyTaskId}
                  onMove={(task, status) => {
                    moveMutation.mutate({ task, status });
                  }}
                  onSaveTitle={(task, title) => {
                    titleMutation.mutate({ task, title });
                  }}
                  onDelete={(task) => {
                    deleteMutation.mutate(task);
                  }}
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
                  invalidateBoard();
                }}
              />
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
