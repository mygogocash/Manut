import {
  adminDepartmentsQueryKey,
  ApiError,
  listAdminDepartments,
  type AdminDepartment,
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

function canReadFormConfig(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("admin:read") || hasPermission("admin:manage");
}

function DepartmentRow({ department }: { department: AdminDepartment }) {
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
        {department.name}
        {department.code ? ` · ${department.code}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {department.isActive ? "Active" : "Inactive"}
        {department.description ? ` · ${department.description}` : ""}
      </Text>
    </View>
  );
}

export function FormConfigScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadFormConfig(hasPermission);

  const departmentsQuery = useQuery({
    queryKey: adminDepartmentsQueryKey(),
    queryFn: ({ signal }) => listAdminDepartments(api, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Form configuration" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view form configuration.
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
        <Card title="Form configuration" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only department list. Create, update, and deactivate remain
              deferred.
            </Text>
            {departmentsQuery.isLoading ? (
              <LoadingState label="Loading departments…" />
            ) : null}
            {departmentsQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    departmentsQuery.error,
                    "Unable to load departments.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void departmentsQuery.refetch()}
                />
              </View>
            ) : null}
            {departmentsQuery.data?.data.length === 0 ? (
              <StatusMessage tone="warning">No departments found.</StatusMessage>
            ) : null}
            {departmentsQuery.data?.data.map((department) => (
              <DepartmentRow key={department.id} department={department} />
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
