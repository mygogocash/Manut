import { ApiError, listRoles, ROLES_QUERY_KEY, type Role } from "@manut/app-core";
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

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load roles.";
}

function RoleCard({ role }: { role: Role }) {
  return (
    <View
      accessibilityLabel={`${role.name} role`}
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {role.name}
        {role.isSystem ? " · System" : ""}
      </Text>
      {role.description ? (
        <Text selectable style={{ color: colors.textMuted }}>
          {role.description}
        </Text>
      ) : (
        <Text selectable style={{ color: colors.textMuted }}>
          No description
        </Text>
      )}
      <Text selectable style={{ color: colors.textMuted }}>
        {role.permissionCount} permission
        {role.permissionCount === 1 ? "" : "s"} · {role.userCount} member
        {role.userCount === 1 ? "" : "s"}
      </Text>
    </View>
  );
}

export function RolesScreen() {
  const api = useApiClient();
  const rolesQuery = useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: ({ signal }) => listRoles(api, signal),
  });

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
      <View style={{ width: "100%", maxWidth: 1080, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            Roles
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only role catalog. Create, clone, permission edit, and member
            assignment stay on later slices.
          </Text>
        </View>

        {rolesQuery.isPending ? <LoadingState label="Loading roles…" /> : null}

        {rolesQuery.isError ? (
          <Card title="Roles unavailable" maxWidth={1080}>
            <StatusMessage tone="error">
              {errorMessage(rolesQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry roles"
              pending={rolesQuery.isFetching}
              onPress={() => {
                void rolesQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {rolesQuery.data ? (
          rolesQuery.data.length === 0 ? (
            <Card title="No roles" maxWidth={1080}>
              <Text selectable style={{ color: colors.textMuted }}>
                No roles are configured yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Role catalog"
              style={{ gap: spacing.lg }}
            >
              {rolesQuery.data.map((role) => (
                <RoleCard key={role.id} role={role} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
