import {
  ApiError,
  DIRECTORY_DEPARTMENTS_QUERY_KEY,
  DIRECTORY_ORG_CHART_QUERY_KEY,
  directoryDetailQueryKey,
  directoryListQueryKey,
  getDirectoryDepartments,
  getDirectoryEmployee,
  getDirectoryOrgChart,
  listDirectory,
  type DirectoryEmployee,
  type DirectoryEmployeeDetail,
  type OrgChartNode,
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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { runLockedTransition } from "@/features/directory/transition-lock";
import { useApiClient } from "@/providers/api-client-provider";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return undefined;
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [debounced, delay, value]);

  return debounced;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load the employee directory.";
}

function FilterChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 42,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.borderStrong,
        borderRadius: radii.control,
        backgroundColor: selected
          ? colors.accent
          : pressed
            ? colors.canvas
            : colors.surfaceRaised,
      })}
    >
      <Text
        selectable
        style={{
          color: selected ? colors.onAccent : colors.text,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text selectable style={{ color: colors.textMuted }}>
      {label}: {value}
    </Text>
  );
}

function EmployeeDetailSheet({
  employeeId,
  accessTier,
  onClose,
}: {
  employeeId: string;
  accessTier: "standard" | "sensitive";
  onClose: () => void;
}) {
  const api = useApiClient();
  const detailQuery = useQuery({
    queryKey: directoryDetailQueryKey(employeeId, accessTier),
    queryFn: ({ signal }) => getDirectoryEmployee(api, employeeId, signal),
  });

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      presentationStyle="overFullScreen"
      accessibilityViewIsModal
      onRequestClose={onClose}
    >
      <View
        accessibilityLabel="Directory profile"
        style={{
          flex: 1,
          justifyContent: "center",
          padding: spacing.lg,
          backgroundColor: "rgba(17, 24, 39, 0.55)",
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ alignItems: "center" }}
        >
          {detailQuery.isPending ? (
            <Card title="Directory profile" maxWidth={560}>
              <LoadingState label="Loading employee profile…" />
              <Button
                label="Close"
                pendingLabel="Closing…"
                accessibilityLabel="Close directory profile"
                onPress={onClose}
              />
            </Card>
          ) : detailQuery.isError ? (
            <Card title="Directory profile" maxWidth={560}>
              <StatusMessage>
                {detailQuery.error instanceof ApiError
                  ? detailQuery.error.message
                  : "We could not load this employee profile."}
              </StatusMessage>
              <Button
                label="Retry"
                pendingLabel="Retrying…"
                accessibilityLabel="Retry directory profile"
                pending={detailQuery.isFetching}
                onPress={() => {
                  void detailQuery.refetch();
                }}
              />
              <Button
                label="Close"
                pendingLabel="Closing…"
                accessibilityLabel="Close directory profile"
                onPress={onClose}
              />
            </Card>
          ) : detailQuery.data ? (
            <EmployeeDetailCard
              detail={detailQuery.data}
              canViewSensitive={accessTier === "sensitive"}
              onClose={onClose}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function EmployeeDetailCard({
  detail,
  canViewSensitive,
  onClose,
}: {
  detail: DirectoryEmployeeDetail;
  canViewSensitive: boolean;
  onClose: () => void;
}) {
  return (
    <Card
      title={detail.name}
      description="Directory profile"
      maxWidth={560}
    >
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.text }}>
          {detail.jobTitle ?? "No title"}
        </Text>
        <DetailRow label="Email" value={detail.email} />
        {detail.department ? (
          <DetailRow label="Department" value={detail.department} />
        ) : null}
        {detail.entity ? (
          <DetailRow label="Entity" value={detail.entity.name} />
        ) : null}
        {detail.manager ? (
          <DetailRow label="Manager" value={detail.manager.name} />
        ) : null}
        {detail.phone ? <DetailRow label="Phone" value={detail.phone} /> : null}
        {detail.location ? (
          <DetailRow label="Location" value={detail.location} />
        ) : null}
        {detail.timezone ? (
          <Text selectable style={{ color: colors.textMuted }}>
            {detail.timezone}
          </Text>
        ) : null}
        <DetailRow
          label="Employment"
          value={detail.employmentType.replaceAll("_", " ")}
        />
        {canViewSensitive && detail.salary != null && detail.salary !== "" ? (
          <DetailRow
            label="Compensation"
            value={`${detail.salary}${detail.currency ? ` ${detail.currency}` : ""}`}
          />
        ) : null}
        {detail.userRoles.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            {detail.userRoles.map((entry) => (
              <Text
                key={entry.role.id}
                selectable
                style={{ color: colors.textMuted }}
              >
                Role: {entry.role.name}
              </Text>
            ))}
          </View>
        ) : null}
        {detail.directReports.length > 0 ? (
          <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            <Text
              selectable
              style={{ color: colors.textStrong, fontWeight: "700" }}
            >
              Direct reports
            </Text>
            {detail.directReports.map((report) => (
              <Text
                key={report.id}
                selectable
                style={{ color: colors.textMuted }}
              >
                {report.name}
                {report.jobTitle ? ` · ${report.jobTitle}` : ""}
              </Text>
            ))}
          </View>
        ) : null}
        <Button
          label="Close"
          pendingLabel="Closing…"
          accessibilityLabel="Close directory profile"
          onPress={onClose}
        />
      </View>
    </Card>
  );
}

function EmployeeCard({
  employee,
  onOpen,
}: {
  employee: DirectoryEmployee;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${employee.name} directory profile`}
      onPress={onOpen}
    >
      <Card title={employee.name} description={employee.jobTitle ?? "No title"}>
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.textMuted }}>
            {employee.email}
          </Text>
          {employee.department ? (
            <Text selectable style={{ color: colors.textMuted }}>
              Department: {employee.department}
            </Text>
          ) : null}
          {employee.entity ? (
            <Text selectable style={{ color: colors.textMuted }}>
              Entity: {employee.entity.name}
            </Text>
          ) : null}
          {employee.phone ? (
            <Text selectable style={{ color: colors.textMuted }}>
              Phone: {employee.phone}
            </Text>
          ) : null}
          {employee.location ? (
            <Text selectable style={{ color: colors.textMuted }}>
              Location: {employee.location}
            </Text>
          ) : null}
          <Text selectable style={{ color: colors.textMuted }}>
            Employment: {employee.employmentType.replaceAll("_", " ")}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

function OrgChartList({ nodes }: { nodes: OrgChartNode[] }) {
  const roots = nodes.filter((node) => node.reportingTo === null);
  const byManager = new Map<string, OrgChartNode[]>();
  for (const node of nodes) {
    if (!node.reportingTo) continue;
    const existing = byManager.get(node.reportingTo) ?? [];
    existing.push(node);
    byManager.set(node.reportingTo, existing);
  }

  function renderBranch(node: OrgChartNode, depth: number) {
    const reports = byManager.get(node.id) ?? [];
    return (
      <View key={node.id} style={{ gap: spacing.sm, marginLeft: depth * 16 }}>
        <Card title={node.name} description={node.jobTitle ?? "No title"}>
          <Text selectable style={{ color: colors.textMuted }}>
            {node.department ?? "No department"}
            {node.entity ? ` · ${node.entity.name}` : ""}
          </Text>
          {reports.length > 0 ? (
            <Text selectable style={{ color: colors.textMuted }}>
              Reports: {reports.length}
            </Text>
          ) : null}
        </Card>
        {reports.map((report) => renderBranch(report, depth + 1))}
      </View>
    );
  }

  if (nodes.length === 0) {
    return (
      <Card title="Org chart empty">
        <Text selectable style={{ color: colors.textMuted }}>
          No active employees are available for the org chart.
        </Text>
      </Card>
    );
  }

  const forest = roots.length > 0 ? roots : nodes;
  return (
    <View accessibilityLabel="Organization chart" style={{ gap: spacing.md }}>
      {forest.map((node) => renderBranch(node, 0))}
    </View>
  );
}

export function DirectoryScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const [viewMode, setViewMode] = useState<"list" | "org">("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string | undefined>();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const transitionRef = useRef(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const canViewSensitive = hasPermission("directory:view-sensitive");
  const accessTier = canViewSensitive ? "sensitive" : "standard";
  const params = useMemo(
    () => ({
      page,
      limit: 24,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(department ? { department } : {}),
    }),
    [debouncedSearch, department, page],
  );
  const directoryQuery = useQuery({
    queryKey: directoryListQueryKey(params, accessTier),
    queryFn: ({ signal }) =>
      listDirectory(api, params, signal).finally(() => {
        transitionRef.current = false;
      }),
    enabled: viewMode === "list",
  });
  const departmentsQuery = useQuery({
    queryKey: DIRECTORY_DEPARTMENTS_QUERY_KEY,
    queryFn: ({ signal }) => getDirectoryDepartments(api, signal),
    enabled: viewMode === "list",
  });
  const orgChartQuery = useQuery({
    queryKey: DIRECTORY_ORG_CHART_QUERY_KEY,
    queryFn: ({ signal }) => getDirectoryOrgChart(api, signal),
    enabled: viewMode === "org",
  });
  const showLimitedDirectoryBanner =
    hasPermission("directory:read") && !canViewSensitive;
  const isTransitioning = directoryQuery.isFetching;

  function startTransition(update: () => void) {
    runLockedTransition(transitionRef, update);
  }

  return (
    <>
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
            Employee directory
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Browse active colleagues using clean runtime organization data.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <FilterChip
            label="list"
            selected={viewMode === "list"}
            onPress={() => setViewMode("list")}
          />
          <FilterChip
            label="org chart"
            selected={viewMode === "org"}
            onPress={() => setViewMode("org")}
          />
        </View>

        {viewMode === "org" ? (
          orgChartQuery.isPending ? (
            <LoadingState label="Loading org chart…" />
          ) : orgChartQuery.isError ? (
            <Card title="Org chart unavailable">
              <StatusMessage>
                {errorMessage(orgChartQuery.error)}
              </StatusMessage>
              <Button
                label="Retry"
                pendingLabel="Retrying…"
                accessibilityLabel="Retry org chart"
                pending={orgChartQuery.isFetching}
                onPress={() => {
                  void orgChartQuery.refetch();
                }}
              />
            </Card>
          ) : (
            <OrgChartList nodes={orgChartQuery.data ?? []} />
          )
        ) : null}

        {viewMode === "list" ? (
          <>
            {showLimitedDirectoryBanner ? (
              <Card
                title="Standard directory view"
                description="Private phone numbers and compensation fields are hidden."
              />
            ) : null}

            {directoryQuery.isFetching ? (
              <StatusMessage tone="warning">
                Updating directory results…
              </StatusMessage>
            ) : null}

            {directoryQuery.data ? (
              <StatusMessage tone="success">
                {`Showing ${directoryQuery.data.data.length} of ${directoryQuery.data.meta.total} employees. Page ${directoryQuery.data.meta.page} of ${Math.max(directoryQuery.data.meta.totalPages, 1)}.`}
              </StatusMessage>
            ) : null}

            <TextField
              label="Search directory"
              placeholder="Name, email, or department"
              value={search}
              onChangeText={(next) => {
                setSearch(next);
                setPage(1);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />

            {departmentsQuery.data && departmentsQuery.data.length > 0 ? (
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
              >
                <FilterChip
                  label="all departments"
                  selected={!department}
                  disabled={isTransitioning || !department}
                  onPress={() => {
                    startTransition(() => {
                      setDepartment(undefined);
                      setPage(1);
                    });
                  }}
                />
                {departmentsQuery.data.map((item) => (
                  <FilterChip
                    key={item.name}
                    label={item.name}
                    selected={department === item.name}
                    disabled={isTransitioning || department === item.name}
                    onPress={() => {
                      startTransition(() => {
                        setDepartment(item.name);
                        setPage(1);
                      });
                    }}
                  />
                ))}
              </ScrollView>
            ) : null}

            {directoryQuery.isError ? (
              <Card title="Directory unavailable">
                <StatusMessage>
                  {errorMessage(directoryQuery.error)}
                </StatusMessage>
                <Button
                  label="Retry"
                  pendingLabel="Retrying…"
                  accessibilityLabel="Retry directory"
                  pending={directoryQuery.isFetching}
                  onPress={async () => {
                    await directoryQuery.refetch();
                  }}
                />
              </Card>
            ) : directoryQuery.isPending || !directoryQuery.data ? (
              <Card
                title="Loading directory results"
                description="Your search and filter controls will stay available."
              />
            ) : directoryQuery.data.data.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {directoryQuery.data.data.map((employee) => (
                  <EmployeeCard
                    key={employee.id}
                    employee={employee}
                    onOpen={() => setSelectedEmployeeId(employee.id)}
                  />
                ))}
              </View>
            ) : (
              <Card
                title="No employees found"
                description="Try a different search or department filter."
              />
            )}

            {directoryQuery.data ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.md,
                }}
              >
                <Button
                  label="Previous"
                  pendingLabel="Previous"
                  accessibilityLabel="Previous page"
                  disabled={
                    isTransitioning || directoryQuery.data.meta.page <= 1
                  }
                  onPress={() =>
                    startTransition(() =>
                      setPage((current) => Math.max(1, current - 1)),
                    )
                  }
                  style={{ flex: 1 }}
                />
                <Text selectable style={{ color: colors.textMuted }}>
                  Page {directoryQuery.data.meta.page} of{" "}
                  {Math.max(directoryQuery.data.meta.totalPages, 1)}
                </Text>
                <Button
                  label="Next"
                  pendingLabel="Next"
                  accessibilityLabel="Next page"
                  disabled={
                    isTransitioning ||
                    directoryQuery.data.meta.page >=
                      directoryQuery.data.meta.totalPages
                  }
                  onPress={() =>
                    startTransition(() => setPage((current) => current + 1))
                  }
                  style={{ flex: 1 }}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>

    {selectedEmployeeId ? (
      <EmployeeDetailSheet
        employeeId={selectedEmployeeId}
        accessTier={accessTier}
        onClose={() => setSelectedEmployeeId(null)}
      />
    ) : null}
    </>
  );
}
