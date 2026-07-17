import {
  adminUsersQueryKey,
  ApiError,
  listAdminUsers,
  type AdminUser,
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
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { runLockedTransition } from "@/features/directory/transition-lock";
import { employmentTypeLabel } from "@/features/employees/employment-type-label";
import { useApiClient } from "@/providers/api-client-provider";

type ActiveFilter = "all" | "active" | "inactive";

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load employees.";
}

function EmployeeCard({ user }: { user: AdminUser }) {
  const roleNames = user.roles.map((role) => role.name).join(", ") || "No roles";
  return (
    <View
      accessibilityLabel={`${user.name} employee`}
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
        {user.name}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {user.email}
        {user.employeeId ? ` · ${user.employeeId}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {user.isActive ? "Active" : "Inactive"} ·{" "}
        {employmentTypeLabel(user.employmentType)}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {[user.department, user.jobTitle, user.entity?.name]
          .filter(Boolean)
          .join(" · ") || "No org placement"}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        Roles: {roleNames}
      </Text>
    </View>
  );
}

export function EmployeesScreen() {
  const api = useApiClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const transitionRef = useRef(false);

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(committedSearch ? { search: committedSearch } : {}),
      ...(activeFilter === "active"
        ? { isActive: true as const }
        : activeFilter === "inactive"
          ? { isActive: false as const }
          : {}),
    }),
    [page, committedSearch, activeFilter],
  );

  const usersQuery = useQuery({
    queryKey: adminUsersQueryKey(params),
    queryFn: ({ signal }) =>
      listAdminUsers(api, params, signal).finally(() => {
        transitionRef.current = false;
      }),
  });
  const isTransitioning = usersQuery.isFetching;

  function startTransition(update: () => void) {
    runLockedTransition(transitionRef, update);
  }

  function applySearch() {
    startTransition(() => {
      setPage(1);
      setCommittedSearch(search.trim());
    });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
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
            Employees
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Read-only admin directory. Create, role assign, and deactivate stay
            on later slices.
          </Text>
        </View>

        <Card title="Find people" maxWidth={1080}>
          <View style={{ gap: spacing.md }}>
            <TextField
              label="Search"
              value={search}
              placeholder="Name, email, or employee id"
              onChangeText={setSearch}
              onSubmitEditing={applySearch}
              returnKeyType="search"
            />
            <Button
              label="Search employees"
              pendingLabel="Searching…"
              onPress={applySearch}
            />
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {(
                [
                  { label: "All", value: "all" as const },
                  { label: "Active", value: "active" as const },
                  { label: "Inactive", value: "inactive" as const },
                ] as const
              ).map((filter) => {
                const selected = activeFilter === filter.value;
                return (
                  <Pressable
                    key={filter.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${filter.label}`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      startTransition(() => {
                        setPage(1);
                        setActiveFilter(filter.value);
                      });
                    }}
                    style={{
                      minHeight: 42,
                      justifyContent: "center",
                      paddingHorizontal: spacing.lg,
                      borderRadius: 999,
                      backgroundColor: selected
                        ? colors.accent
                        : colors.surfaceRaised,
                      borderWidth: 1,
                      borderColor: selected ? colors.accent : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? colors.onAccent : colors.text,
                        fontWeight: selected ? "600" : "400",
                      }}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        {usersQuery.isPending ? (
          <LoadingState label="Loading employees…" />
        ) : null}

        {usersQuery.isError ? (
          <Card title="Employees unavailable" maxWidth={1080}>
            <StatusMessage tone="error">
              {errorMessage(usersQuery.error)}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry employees"
              pending={usersQuery.isFetching}
              onPress={() => {
                void usersQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {usersQuery.data ? (
          usersQuery.data.data.length === 0 ? (
            <Card title="No employees" maxWidth={1080}>
              <Text selectable style={{ color: colors.textMuted }}>
                No employees match this filter.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="Employee directory"
              style={{ gap: spacing.lg }}
            >
              {usersQuery.data.data.map((user) => (
                <EmployeeCard key={user.id} user={user} />
              ))}
              {usersQuery.data.meta.totalPages > 1 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing.md,
                  }}
                >
                  <Button
                    label="Previous page"
                    pendingLabel="Loading…"
                    accessibilityLabel="Previous employees page"
                    disabled={page <= 1 || isTransitioning}
                    onPress={() => {
                      startTransition(() => {
                        setPage((current) => Math.max(1, current - 1));
                      });
                    }}
                  />
                  <Text selectable style={{ color: colors.textMuted }}>
                    Page {usersQuery.data.meta.page} of{" "}
                    {usersQuery.data.meta.totalPages}
                  </Text>
                  <Button
                    label="Next page"
                    pendingLabel="Loading…"
                    accessibilityLabel="Next employees page"
                    disabled={
                      page >= usersQuery.data.meta.totalPages || isTransitioning
                    }
                    onPress={() => {
                      startTransition(() => {
                        setPage((current) => current + 1);
                      });
                    }}
                  />
                </View>
              ) : null}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
