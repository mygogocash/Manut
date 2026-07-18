import {
  ApiError,
  approveLeaveRequest,
  canActOnLeaveRequest,
  LEAVE_TEAM_REQUESTS_QUERY_ROOT,
  leaveTeamRequestsQueryKey,
  listLeaveTeamRequests,
  rejectLeaveRequest,
  rejectLeaveRequestInputSchema,
  type LeaveTeamRequest,
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
import { useState } from "react";
import { Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatRange(request: LeaveTeamRequest): string {
  if (request.startDate === request.endDate) {
    return `${request.startDate} · ${request.days} day${
      request.days === "1" || request.days === "1.0" ? "" : "s"
    }`;
  }
  return `${request.startDate} – ${request.endDate} · ${request.days} days`;
}

export function LeaveTeamInbox() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectValidation, setRejectValidation] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const inboxQuery = useQuery({
    queryKey: leaveTeamRequestsQueryKey({
      status: "pending",
      page: 1,
      limit: 20,
    }),
    queryFn: ({ signal }) =>
      listLeaveTeamRequests(
        api,
        { status: "pending", page: 1, limit: 20 },
        signal,
      ),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveLeaveRequest(api, requestId),
    onSuccess: () => {
      setActionMessage("Leave request approved.");
      setRejectingId(null);
      void queryClient.invalidateQueries({
        queryKey: LEAVE_TEAM_REQUESTS_QUERY_ROOT,
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason: string;
    }) => rejectLeaveRequest(api, requestId, { reason }),
    onSuccess: () => {
      setActionMessage("Leave request rejected.");
      setRejectingId(null);
      setRejectReason("");
      setRejectValidation(null);
      void queryClient.invalidateQueries({
        queryKey: LEAVE_TEAM_REQUESTS_QUERY_ROOT,
      });
    },
  });

  const requests = inboxQuery.data?.data ?? [];

  function submitReject(requestId: string) {
    const parsed = rejectLeaveRequestInputSchema.safeParse({
      reason: rejectReason,
    });
    if (!parsed.success) {
      setRejectValidation(
        parsed.error.issues[0]?.message ?? "Reason is required",
      );
      return;
    }
    setRejectValidation(null);
    rejectMutation.mutate({ requestId, reason: parsed.data.reason });
  }

  return (
    <Card
      title="Team approvals"
      description="Pending leave for your reports (or HR scope). Approve or reject with a reason."
      maxWidth={1080}
    >
      {actionMessage ? (
        <StatusMessage tone="success">{actionMessage}</StatusMessage>
      ) : null}

      {approveMutation.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            approveMutation.error,
            "The leave request could not be approved.",
          )}
        </StatusMessage>
      ) : null}

      {rejectMutation.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            rejectMutation.error,
            "The leave request could not be rejected.",
          )}
        </StatusMessage>
      ) : null}

      {inboxQuery.isPending ? (
        <LoadingState label="Loading pending approvals…" />
      ) : null}

      {inboxQuery.isError ? (
        <View style={{ gap: spacing.md }}>
          <StatusMessage tone="error">
            {errorMessage(
              inboxQuery.error,
              "We could not load pending leave approvals.",
            )}
          </StatusMessage>
          <Button
            label="Retry approvals"
            pendingLabel="Retrying…"
            accessibilityLabel="Retry leave approvals"
            pending={inboxQuery.isFetching}
            onPress={() => {
              void inboxQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {inboxQuery.data ? (
        requests.length === 0 ? (
          <Text selectable style={{ color: colors.textMuted }}>
            No pending leave requests need your approval.
          </Text>
        ) : (
          <View
            accessibilityLabel="Pending leave approvals"
            style={{ gap: spacing.lg }}
          >
            {requests.map((request) => {
              const actionable = canActOnLeaveRequest(request.status);
              const isRejecting = rejectingId === request.id;
              return (
                <View key={request.id} style={{ gap: spacing.sm }}>
                  <Text
                    selectable
                    style={{ fontWeight: "600", color: colors.text }}
                  >
                    {request.employee.name} · {request.leaveType.name}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted }}>
                    {formatRange(request)}
                    {request.reason ? ` · ${request.reason}` : ""}
                  </Text>
                  {actionable && !isRejecting ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: spacing.sm,
                      }}
                    >
                      <Button
                        label="Approve"
                        pendingLabel="Approving…"
                        accessibilityLabel={`Approve leave for ${request.employee.name}`}
                        pending={
                          approveMutation.isPending &&
                          approveMutation.variables === request.id
                        }
                        disabled={
                          approveMutation.isPending || rejectMutation.isPending
                        }
                        onPress={() => {
                          setActionMessage(null);
                          rejectMutation.reset();
                          approveMutation.mutate(request.id);
                        }}
                      />
                      <Button
                        label="Reject"
                        pendingLabel="Opening…"
                        accessibilityLabel={`Reject leave for ${request.employee.name}`}
                        disabled={
                          approveMutation.isPending || rejectMutation.isPending
                        }
                        onPress={() => {
                          setActionMessage(null);
                          approveMutation.reset();
                          setRejectReason("");
                          setRejectValidation(null);
                          setRejectingId(request.id);
                        }}
                      />
                    </View>
                  ) : null}
                  {isRejecting ? (
                    <View style={{ gap: spacing.sm }}>
                      <TextField
                        label="Rejection reason"
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        accessibilityLabel="Rejection reason"
                      />
                      {rejectValidation ? (
                        <StatusMessage tone="error">
                          {rejectValidation}
                        </StatusMessage>
                      ) : null}
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: spacing.sm,
                        }}
                      >
                        <Button
                          label="Confirm reject"
                          pendingLabel="Rejecting…"
                          accessibilityLabel={`Confirm reject leave for ${request.employee.name}`}
                          pending={
                            rejectMutation.isPending &&
                            rejectMutation.variables?.requestId === request.id
                          }
                          onPress={() => submitReject(request.id)}
                        />
                        <Button
                          label="Cancel"
                          pendingLabel="Closing…"
                          accessibilityLabel="Cancel leave rejection"
                          disabled={rejectMutation.isPending}
                          onPress={() => {
                            setRejectingId(null);
                            setRejectReason("");
                            setRejectValidation(null);
                          }}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )
      ) : null}
    </Card>
  );
}
