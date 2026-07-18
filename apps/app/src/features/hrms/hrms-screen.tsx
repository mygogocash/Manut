import {
  ApiError,
  ATTENDANCE_TODAY_QUERY_KEY,
  checkInAttendance,
  checkOutAttendance,
  esopGrantsQueryKey,
  getAttendanceToday,
  listEsopGrants,
  listOnboardingRuns,
  onboardingRunsQueryKey,
  type AttendanceRecord,
  type AttendanceWorkMode,
  type EsopGrant,
  type OnboardingRun,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import {
  attendanceStatusLabel,
  attendanceWorkModeLabel,
} from "@/features/hrms/attendance-status-label";
import { esopGrantTypeLabel } from "@/features/hrms/esop-grant-type-label";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canUseAttendance(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("hrms:read") ||
    hasPermission("hrms:attendance-read") ||
    hasPermission("hrms:attendance-manage")
  );
}

function canReadEsop(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("hrms:read") || hasPermission("hrms:esop-manage");
}

function canReadOnboarding(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("hrms:read") || hasPermission("hrms:onboarding-manage")
  );
}

function WorkModeOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
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
        style={{
          color: selected ? colors.onAccent : colors.text,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AttendanceSection({
  record,
  workMode,
  onWorkModeChange,
  onCheckIn,
  onCheckOut,
  busy,
  actionError,
}: {
  record: AttendanceRecord | null | undefined;
  workMode: AttendanceWorkMode;
  onWorkModeChange: (mode: AttendanceWorkMode) => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  busy: boolean;
  actionError: string | null;
}) {
  const checkedIn = Boolean(record?.localCheckInTime);
  const checkedOut = Boolean(record?.localCheckOutTime);

  return (
    <Card title="Attendance today" description="Check in and out for today">
      <View style={{ gap: spacing.md }}>
        {record ? (
          <View style={{ gap: spacing.xs }}>
            <Text selectable style={{ color: colors.text, fontWeight: "600" }}>
              {attendanceStatusLabel(record.status)} ·{" "}
              {attendanceWorkModeLabel(record.workMode)}
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              Date {record.attendanceDate}
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              In {record.localCheckInTime ?? "—"} · Out{" "}
              {record.localCheckOutTime ?? "—"}
            </Text>
            {record.lateMinutes > 0 ? (
              <Text selectable style={{ color: colors.textMuted }}>
                Late by {record.lateMinutes} min
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ color: colors.textMuted }}>
            You have not checked in yet today.
          </Text>
        )}

        {!checkedIn ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.textMuted }}>Work mode</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {(["office", "remote", "hybrid"] as const).map((mode) => (
                <WorkModeOption
                  key={mode}
                  label={attendanceWorkModeLabel(mode)}
                  selected={workMode === mode}
                  onPress={() => onWorkModeChange(mode)}
                />
              ))}
            </View>
            <Button
              label="Check in"
              pendingLabel="Checking in…"
              pending={busy}
              onPress={onCheckIn}
              accessibilityLabel="Check in"
            />
          </View>
        ) : null}

        {checkedIn && !checkedOut ? (
          <Button
            label="Check out"
            pendingLabel="Checking out…"
            pending={busy}
            onPress={onCheckOut}
            accessibilityLabel="Check out"
          />
        ) : null}

        {checkedOut ? (
          <Text style={{ color: colors.textMuted }}>
            You are checked out for today.
          </Text>
        ) : null}

        {actionError ? (
          <StatusMessage tone="error">{actionError}</StatusMessage>
        ) : null}
      </View>
    </Card>
  );
}

function EsopGrantRow({ grant }: { grant: EsopGrant }) {
  return (
    <View
      accessibilityLabel={`${esopGrantTypeLabel(grant.grantType)} grant`}
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
        {esopGrantTypeLabel(grant.grantType)} · {grant.status}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {grant.employee.name}
        {grant.employee.department ? ` · ${grant.employee.department}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        Granted {grant.grantDate} · {grant.shares} shares · vested{" "}
        {grant.vestedToDate}
      </Text>
    </View>
  );
}

function OnboardingRow({ run }: { run: OnboardingRun }) {
  return (
    <View
      accessibilityLabel={`${run.employeeName} onboarding`}
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
        {run.employeeName}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {run.department}
        {run.entityName ? ` · ${run.entityName}` : ""} · starts {run.startDate}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {run.status} · tasks {run.tasksDone}/{run.tasksTotal}
      </Text>
    </View>
  );
}

export function HrmsScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const showAttendance = canUseAttendance(hasPermission);
  const showEsop = canReadEsop(hasPermission);
  const showOnboarding = canReadOnboarding(hasPermission);
  const [workMode, setWorkMode] = useState<AttendanceWorkMode>("office");
  const [actionError, setActionError] = useState<string | null>(null);

  const attendanceQuery = useQuery({
    queryKey: ATTENDANCE_TODAY_QUERY_KEY,
    queryFn: ({ signal }) => getAttendanceToday(api, signal),
    enabled: showAttendance,
  });

  const grantsQuery = useQuery({
    queryKey: esopGrantsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listEsopGrants(api, { page: 1, limit: 20 }, signal),
    enabled: showEsop,
  });

  const onboardingQuery = useQuery({
    queryKey: onboardingRunsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listOnboardingRuns(api, { page: 1, limit: 20 }, signal),
    enabled: showOnboarding,
  });

  const checkInMutation = useMutation({
    mutationFn: () => checkInAttendance(api, { workMode }),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({
        queryKey: ATTENDANCE_TODAY_QUERY_KEY,
      });
    },
    onError: (error) => {
      setActionError(errorMessage(error, "Check-in failed."));
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => checkOutAttendance(api, {}),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({
        queryKey: ATTENDANCE_TODAY_QUERY_KEY,
      });
    },
    onError: (error) => {
      setActionError(errorMessage(error, "Check-out failed."));
    },
  });

  const attendanceBusy =
    checkInMutation.isPending || checkOutMutation.isPending;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        gap: spacing.lg,
        padding: spacing.xxl,
      }}
    >
      <View style={{ width: "100%", maxWidth: 720, gap: spacing.lg }}>
        <Card
          title="HRMS"
          description="Attendance, equity grants, and onboarding"
        >
          <Text style={{ color: colors.textMuted }}>
            Self-service attendance plus read-only ESOP and onboarding lists.
            Pool KPIs, imports, offboarding, and payslips stay on the web
            surface for now.
          </Text>
        </Card>

        {showAttendance ? (
          attendanceQuery.isLoading ? (
            <LoadingState label="Loading attendance…" />
          ) : attendanceQuery.isError ? (
            <StatusMessage tone="error">
              {errorMessage(
                attendanceQuery.error,
                "We could not load today's attendance.",
              )}
            </StatusMessage>
          ) : (
            <AttendanceSection
              record={attendanceQuery.data}
              workMode={workMode}
              onWorkModeChange={setWorkMode}
              onCheckIn={() => checkInMutation.mutate()}
              onCheckOut={() => checkOutMutation.mutate()}
              busy={attendanceBusy}
              actionError={actionError}
            />
          )
        ) : null}

        {showEsop ? (
          <Card title="ESOP grants" description="Equity and token grants">
            {grantsQuery.isLoading ? (
              <LoadingState label="Loading grants…" />
            ) : grantsQuery.isError ? (
              <StatusMessage tone="error">
                {errorMessage(
                  grantsQuery.error,
                  "We could not load ESOP grants.",
                )}
              </StatusMessage>
            ) : grantsQuery.data?.data.length ? (
              <View style={{ gap: spacing.md }}>
                {grantsQuery.data.data.map((grant) => (
                  <EsopGrantRow key={grant.id} grant={grant} />
                ))}
              </View>
            ) : (
              <Text style={{ color: colors.textMuted }}>
                No ESOP grants to show.
              </Text>
            )}
          </Card>
        ) : null}

        {showOnboarding ? (
          <Card title="Onboarding" description="Active onboarding runs">
            {onboardingQuery.isLoading ? (
              <LoadingState label="Loading onboarding…" />
            ) : onboardingQuery.isError ? (
              <StatusMessage tone="error">
                {errorMessage(
                  onboardingQuery.error,
                  "We could not load onboarding runs.",
                )}
              </StatusMessage>
            ) : onboardingQuery.data?.data.length ? (
              <View style={{ gap: spacing.md }}>
                {onboardingQuery.data.data.map((run) => (
                  <OnboardingRow key={run.id} run={run} />
                ))}
              </View>
            ) : (
              <Text style={{ color: colors.textMuted }}>
                No onboarding runs to show.
              </Text>
            )}
          </Card>
        ) : null}

        {!showAttendance && !showEsop && !showOnboarding ? (
          <StatusMessage tone="error">
            You do not have permission to view HRMS.
          </StatusMessage>
        ) : null}
      </View>
    </ScrollView>
  );
}
