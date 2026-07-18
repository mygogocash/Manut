import {
  ApiError,
  canCancelLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  createLeaveRequestInputSchema,
  getLeaveBalances,
  getLeaveRequests,
  getLeaveTypes,
  LEAVE_BALANCES_QUERY_KEY,
  LEAVE_REQUESTS_QUERY_ROOT,
  LEAVE_TYPES_QUERY_KEY,
  leaveRequestsQueryKey,
  type HalfDayPeriod,
  type LeaveBalance,
  type LeaveDurationType,
  type LeaveRequest,
  type LeaveSource,
  type LeaveType,
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
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { LeaveCalendarSection } from "@/features/leave/leave-calendar-section";
import { leaveCancellationPrompt } from "@/features/leave/leave-cancellation-prompt";
import { LeaveTeamInbox } from "@/features/leave/leave-team-inbox";
import { useApiClient } from "@/providers/api-client-provider";

interface RequestDraft {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  durationType: LeaveDurationType;
  halfDayPeriod: HalfDayPeriod;
  reason: string;
  source: LeaveSource;
}

const emptyDraft: RequestDraft = {
  leaveTypeId: "",
  startDate: "",
  endDate: "",
  durationType: "full_day",
  halfDayPeriod: "am",
  reason: "",
  source: "entitled",
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatLeaveDays(days: string): string {
  return `${days} day${days === "1" || days === "1.0" ? "" : "s"}`;
}

function formatLeaveRange(request: LeaveRequest): string {
  if (request.startDate === request.endDate) {
    return `${request.startDate} · ${formatLeaveDays(request.days)}`;
  }
  return `${request.startDate} – ${request.endDate} · ${formatLeaveDays(request.days)}`;
}

function requestActionLabel(request: LeaveRequest): string {
  const subject = request.reason?.trim() || request.leaveType.name;
  return `${subject} leave request`;
}

function ChoiceOption({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
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
        opacity: disabled ? 0.6 : 1,
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

function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.textStrong, fontWeight: "700" }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {children}
      </View>
    </View>
  );
}

function RequestHistoryCard({
  request,
  canRequest,
  confirming,
  cancelling,
  onAskCancel,
  onConfirmCancel,
  onKeep,
}: {
  request: LeaveRequest;
  canRequest: boolean;
  confirming: boolean;
  cancelling: boolean;
  onAskCancel: () => void;
  onConfirmCancel: () => void;
  onKeep: () => void;
}) {
  const cancellable = canRequest && canCancelLeaveRequest(request.status);
  const actionLabel = requestActionLabel(request);

  return (
    <Card
      title={`${request.leaveType.name} · ${request.status}`}
      maxWidth={520}
    >
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.text }}>
          {formatLeaveRange(request)}
        </Text>
        {request.reason ? (
          <Text selectable style={{ color: colors.textMuted }}>
            {request.reason}
          </Text>
        ) : null}
        {cancellable ? (
          confirming ? (
            <View style={{ gap: spacing.sm }}>
              <StatusMessage tone="warning">
                {leaveCancellationPrompt(request)}
              </StatusMessage>
              <Button
                label="Confirm cancel"
                pendingLabel="Cancelling…"
                accessibilityLabel={`Confirm cancel ${actionLabel}`}
                pending={cancelling}
                onPress={onConfirmCancel}
              />
              <Button
                label="Keep request"
                pendingLabel="Keeping…"
                accessibilityLabel={`Keep ${actionLabel}`}
                disabled={cancelling}
                onPress={onKeep}
              />
            </View>
          ) : (
            <Button
              label="Cancel request"
              pendingLabel="Cancelling…"
              accessibilityLabel={`Cancel ${actionLabel}`}
              onPress={onAskCancel}
            />
          )
        ) : null}
      </View>
    </Card>
  );
}

function BalanceCard({
  balance,
  canRequest,
  onApply,
}: {
  balance: LeaveBalance;
  canRequest: boolean;
  onApply: (leaveTypeId: string) => void;
}) {
  const canApply = balance.remaining > 0 || balance.carriedRemaining > 0;
  const carriedLabel = balance.carriedExpired
    ? `${balance.carried} carried expired`
    : `${balance.carriedRemaining} carried available`;

  return (
    <Card title={balance.leaveType.name} maxWidth={520}>
      <View style={{ gap: spacing.sm }}>
        <Text
          selectable
          style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}
        >
          {balance.remaining} / {balance.entitled} days remaining
        </Text>
        <Text selectable style={{ color: colors.textMuted }}>
          {balance.used} used · {carriedLabel}
        </Text>
        {canRequest ? (
          <Button
            label={`Apply for ${balance.leaveType.name}`}
            pendingLabel="Opening…"
            disabled={!canApply}
            onPress={() => onApply(balance.leaveType.id)}
          />
        ) : null}
      </View>
    </Card>
  );
}

function LeaveRequestDialog({
  visible,
  leaveTypes,
  balances,
  draft,
  validationError,
  submitting,
  submissionError,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  draft: RequestDraft;
  validationError: string | null;
  submitting: boolean;
  submissionError: string | null;
  onDraftChange: (draft: RequestDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const selectedBalance = balances.find(
    (balance) => balance.leaveType.id === draft.leaveTypeId,
  );
  const carriedAvailable =
    !!selectedBalance &&
    !selectedBalance.carriedExpired &&
    selectedBalance.carriedRemaining > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
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
            <Card
              title="Request leave"
              description="Submit a request using the same form on web, iOS, and Android."
            >
              <View style={{ gap: spacing.lg }}>
                <ChoiceGroup label="Leave type">
                  {leaveTypes
                    .filter((leaveType) => leaveType.isActive)
                    .map((leaveType) => (
                      <ChoiceOption
                        key={leaveType.id}
                        label={leaveType.name}
                        selected={draft.leaveTypeId === leaveType.id}
                        onPress={() =>
                          onDraftChange({
                            ...draft,
                            leaveTypeId: leaveType.id,
                            source: "entitled",
                          })
                        }
                      />
                    ))}
                </ChoiceGroup>

                <ChoiceGroup label="Duration">
                  <ChoiceOption
                    label="Full day"
                    selected={draft.durationType === "full_day"}
                    onPress={() =>
                      onDraftChange({
                        ...draft,
                        durationType: "full_day",
                      })
                    }
                  />
                  <ChoiceOption
                    label="Half day"
                    selected={draft.durationType === "half_day"}
                    onPress={() =>
                      onDraftChange({
                        ...draft,
                        durationType: "half_day",
                        endDate: draft.startDate,
                      })
                    }
                  />
                </ChoiceGroup>

                {draft.durationType === "half_day" ? (
                  <ChoiceGroup label="Half-day period">
                    <ChoiceOption
                      label="A.M."
                      selected={draft.halfDayPeriod === "am"}
                      onPress={() =>
                        onDraftChange({ ...draft, halfDayPeriod: "am" })
                      }
                    />
                    <ChoiceOption
                      label="P.M."
                      selected={draft.halfDayPeriod === "pm"}
                      onPress={() =>
                        onDraftChange({ ...draft, halfDayPeriod: "pm" })
                      }
                    />
                  </ChoiceGroup>
                ) : null}

                <TextField
                  label="Start date (YYYY-MM-DD)"
                  value={draft.startDate}
                  placeholder="2026-07-20"
                  autoCapitalize="none"
                  onChangeText={(startDate) =>
                    onDraftChange({
                      ...draft,
                      startDate,
                      endDate:
                        draft.durationType === "half_day"
                          ? startDate
                          : draft.endDate,
                    })
                  }
                />
                <TextField
                  label="End date (YYYY-MM-DD)"
                  value={draft.endDate}
                  placeholder="2026-07-20"
                  autoCapitalize="none"
                  editable={draft.durationType !== "half_day"}
                  onChangeText={(endDate) =>
                    onDraftChange({ ...draft, endDate })
                  }
                />

                {carriedAvailable ? (
                  <ChoiceGroup label="Balance bucket">
                    <ChoiceOption
                      label="Current entitlement"
                      selected={draft.source === "entitled"}
                      onPress={() =>
                        onDraftChange({ ...draft, source: "entitled" })
                      }
                    />
                    <ChoiceOption
                      label={`Carried leave (${selectedBalance.carriedRemaining} available)`}
                      selected={draft.source === "carried"}
                      onPress={() =>
                        onDraftChange({ ...draft, source: "carried" })
                      }
                    />
                  </ChoiceGroup>
                ) : null}

                <TextField
                  label="Reason (optional)"
                  value={draft.reason}
                  multiline
                  maxLength={1000}
                  style={{ minHeight: 96, textAlignVertical: "top" }}
                  onChangeText={(reason) => onDraftChange({ ...draft, reason })}
                />

                {validationError ? (
                  <StatusMessage>{validationError}</StatusMessage>
                ) : null}
                {submissionError ? (
                  <StatusMessage>{submissionError}</StatusMessage>
                ) : null}

                <View style={{ gap: spacing.sm }}>
                  <Button
                    label="Submit request"
                    pendingLabel="Submitting…"
                    pending={submitting}
                    onPress={onSubmit}
                  />
                  <Button
                    label="Close request dialog"
                    pendingLabel="Closing…"
                    disabled={submitting}
                    onPress={onClose}
                  />
                </View>
              </View>
            </Card>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function LeaveScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canRequest = hasPermission("leave:request");
  const canViewHolidays =
    hasPermission("leave:read") ||
    hasPermission("leave:hr-read") ||
    hasPermission("leave:hr-settings");
  const canViewApprovalChain =
    hasPermission("leave:assign-approver") ||
    hasPermission("leave:hr-settings");
  const canViewPolicies = hasPermission("leave:hr-settings");
  const canViewCalendar =
    hasPermission("leave:read") || hasPermission("leave:hr-read");
  const canApproveTeam =
    hasPermission("leave:approve") || hasPermission("leave:hr-read");
  const employeeId = user?.id;
  const [historyPage, setHistoryPage] = useState(1);
  const selfRequestParams = useMemo(
    () =>
      employeeId
        ? { employeeId, page: historyPage, limit: 20 }
        : null,
    [employeeId, historyPage],
  );
  const [requestOpen, setRequestOpen] = useState(false);
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(
    null,
  );

  const balancesQuery = useQuery({
    queryKey: LEAVE_BALANCES_QUERY_KEY,
    queryFn: ({ signal }) => getLeaveBalances(api, signal),
  });
  const typesQuery = useQuery({
    queryKey: LEAVE_TYPES_QUERY_KEY,
    queryFn: ({ signal }) => getLeaveTypes(api, signal),
    enabled: canRequest,
  });
  const requestsQuery = useQuery({
    queryKey: selfRequestParams
      ? leaveRequestsQueryKey(selfRequestParams)
      : ([...LEAVE_REQUESTS_QUERY_ROOT, "unavailable"] as const),
    queryFn: ({ signal }) => {
      if (!selfRequestParams) {
        throw new Error("Authenticated leave history requires a user id.");
      }
      return getLeaveRequests(api, selfRequestParams, signal);
    },
    enabled: !!selfRequestParams,
  });
  const activeTypes = useMemo(
    () => (typesQuery.data ?? []).filter((leaveType) => leaveType.isActive),
    [typesQuery.data],
  );

  const requestMutation = useMutation({
    mutationFn: (input: Parameters<typeof createLeaveRequest>[1]) =>
      createLeaveRequest(api, input),
    onSuccess: () => {
      setRequestOpen(false);
      setDraft(emptyDraft);
      setValidationError(null);
      setSuccessMessage("Leave request submitted.");
      void queryClient.invalidateQueries({
        queryKey: LEAVE_BALANCES_QUERY_KEY,
      });
      void queryClient.invalidateQueries({
        queryKey: LEAVE_REQUESTS_QUERY_ROOT,
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => cancelLeaveRequest(api, requestId),
    onSuccess: () => {
      setConfirmingCancelId(null);
      setSuccessMessage("Leave request cancelled.");
      void queryClient.invalidateQueries({
        queryKey: LEAVE_BALANCES_QUERY_KEY,
      });
      void queryClient.invalidateQueries({
        queryKey: LEAVE_REQUESTS_QUERY_ROOT,
      });
    },
  });

  function openRequest(leaveTypeId = "") {
    requestMutation.reset();
    cancelMutation.reset();
    setValidationError(null);
    setSuccessMessage(null);
    setDraft({ ...emptyDraft, leaveTypeId });
    setRequestOpen(true);
  }

  function closeRequest() {
    if (requestMutation.isPending) return;
    setRequestOpen(false);
    setValidationError(null);
    requestMutation.reset();
  }

  function submitRequest() {
    const parsed = createLeaveRequestInputSchema.safeParse({
      leaveTypeId: draft.leaveTypeId,
      startDate: draft.startDate,
      endDate:
        draft.durationType === "half_day" ? draft.startDate : draft.endDate,
      durationType: draft.durationType,
      ...(draft.durationType === "half_day"
        ? { halfDayPeriod: draft.halfDayPeriod }
        : {}),
      reason: draft.reason,
      source: draft.source,
    });
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? "Check the request fields.",
      );
      return;
    }
    setValidationError(null);
    requestMutation.mutate(parsed.data);
  }

  const loading =
    balancesQuery.isPending || (canRequest && typesQuery.isPending);
  if (loading) return <LoadingState label="Loading leave balances…" />;

  const readError = balancesQuery.isError
    ? errorMessage(
        balancesQuery.error,
        "We could not load your leave balances.",
      )
    : canRequest && typesQuery.isError
      ? errorMessage(typesQuery.error, "We could not load leave policies.")
      : null;
  if (readError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xxl,
          backgroundColor: colors.canvas,
        }}
      >
        <Card title="Leave unavailable">
          <StatusMessage>{readError}</StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            accessibilityLabel="Retry leave"
            pending={balancesQuery.isFetching || typesQuery.isFetching}
            onPress={async () => {
              await Promise.all([
                balancesQuery.refetch(),
                ...(canRequest ? [typesQuery.refetch()] : []),
              ]);
            }}
          />
        </Card>
      </View>
    );
  }

  const balances = balancesQuery.data ?? [];
  const requests = requestsQuery.data?.data ?? [];
  return (
    <>
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
          <Card
            title="Leave"
            description="Review your current-year balances, request history, and submit leave requests."
            maxWidth={1080}
          >
            {canRequest ? (
              <Button
                label="Apply for leave"
                pendingLabel="Opening…"
                disabled={activeTypes.length === 0}
                onPress={() => openRequest()}
              />
            ) : (
              <Text selectable style={{ color: colors.textMuted }}>
                Your role can view leave information but cannot submit a
                request.
              </Text>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {canViewHolidays ? (
                <Button
                  label="Public holidays"
                  pendingLabel="Opening…"
                  accessibilityLabel="Open public holidays"
                  onPress={() => {
                    router.push("/leave/holidays");
                  }}
                />
              ) : null}
              {canViewApprovalChain ? (
                <Button
                  label="Approval chain"
                  pendingLabel="Opening…"
                  accessibilityLabel="Open leave approval chain"
                  onPress={() => {
                    router.push("/leave/approval");
                  }}
                />
              ) : null}
              {canViewPolicies ? (
                <Button
                  label="Leave policies"
                  pendingLabel="Opening…"
                  accessibilityLabel="Open leave policies"
                  onPress={() => {
                    router.push("/leave/policies");
                  }}
                />
              ) : null}
            </View>
          </Card>

          {successMessage ? (
            <StatusMessage tone="success">{successMessage}</StatusMessage>
          ) : null}

          {cancelMutation.isError ? (
            <StatusMessage>
              {errorMessage(
                cancelMutation.error,
                "The leave request could not be cancelled.",
              )}
            </StatusMessage>
          ) : null}

          {balances.length === 0 ? (
            <Card title="No leave policies" maxWidth={1080}>
              <Text selectable style={{ color: colors.textMuted }}>
                No active leave policy applies to your account yet.
              </Text>
            </Card>
          ) : (
            <View
              accessibilityLabel="My leave balances"
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.lg,
              }}
            >
              {balances.map((balance) => (
                <BalanceCard
                  key={balance.id}
                  balance={balance}
                  canRequest={canRequest}
                  onApply={openRequest}
                />
              ))}
            </View>
          )}

          {canViewCalendar ? <LeaveCalendarSection /> : null}
          {canApproveTeam ? <LeaveTeamInbox /> : null}

          <Card
            title="My leave requests"
            description="Pending and approved requests can be cancelled. Cancelling approved leave returns days to your balance."
            maxWidth={1080}
          >
            {requestsQuery.isPending ? (
              <LoadingState label="Loading leave requests…" />
            ) : requestsQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage>
                  {errorMessage(
                    requestsQuery.error,
                    "We could not load your leave requests.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry requests"
                  pendingLabel="Retrying…"
                  accessibilityLabel="Retry leave requests"
                  pending={requestsQuery.isFetching}
                  onPress={() => {
                    void requestsQuery.refetch();
                  }}
                />
              </View>
            ) : requests.length === 0 ? (
              <Text selectable style={{ color: colors.textMuted }}>
                You have not submitted any leave requests yet.
              </Text>
            ) : (
              <View style={{ gap: spacing.lg }}>
                <View
                  accessibilityLabel="My leave request history"
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.lg,
                  }}
                >
                  {requests.map((request) => (
                    <RequestHistoryCard
                      key={request.id}
                      request={request}
                      canRequest={canRequest}
                      confirming={confirmingCancelId === request.id}
                      cancelling={
                        cancelMutation.isPending &&
                        cancelMutation.variables === request.id
                      }
                      onAskCancel={() => {
                        cancelMutation.reset();
                        setSuccessMessage(null);
                        setConfirmingCancelId(request.id);
                      }}
                      onConfirmCancel={() => cancelMutation.mutate(request.id)}
                      onKeep={() => setConfirmingCancelId(null)}
                    />
                  ))}
                </View>
                {requestsQuery.data &&
                requestsQuery.data.meta.totalPages > 1 ? (
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
                      accessibilityLabel="Previous leave history page"
                      disabled={
                        historyPage <= 1 || requestsQuery.isFetching
                      }
                      onPress={() => {
                        setHistoryPage((current) => Math.max(1, current - 1));
                      }}
                    />
                    <Text selectable style={{ color: colors.textMuted }}>
                      Page {requestsQuery.data.meta.page} of{" "}
                      {requestsQuery.data.meta.totalPages}
                    </Text>
                    <Button
                      label="Next page"
                      pendingLabel="Loading…"
                      accessibilityLabel="Next leave history page"
                      disabled={
                        historyPage >=
                          requestsQuery.data.meta.totalPages ||
                        requestsQuery.isFetching
                      }
                      onPress={() => {
                        setHistoryPage((current) => current + 1);
                      }}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      <LeaveRequestDialog
        visible={requestOpen}
        leaveTypes={activeTypes}
        balances={balances}
        draft={draft}
        validationError={validationError}
        submitting={requestMutation.isPending}
        submissionError={
          requestMutation.isError
            ? errorMessage(
                requestMutation.error,
                "The leave request could not be submitted.",
              )
            : null
        }
        onDraftChange={setDraft}
        onClose={closeRequest}
        onSubmit={submitRequest}
      />
    </>
  );
}
