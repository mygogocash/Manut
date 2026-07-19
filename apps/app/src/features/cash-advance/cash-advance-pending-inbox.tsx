import {
  ApiError,
  approveCashAdvance,
  canActOnCashAdvance,
  CASH_ADVANCES_QUERY_ROOT,
  cashAdvancesQueryKey,
  listCashAdvances,
  rejectCashAdvance,
  rejectCashAdvanceInputSchema,
  type CashAdvanceRequest,
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

import { CashAdvanceLineItems } from "@/features/cash-advance/cash-advance-line-items";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function CashAdvancePendingInbox() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectValidation, setRejectValidation] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const inboxQuery = useQuery({
    queryKey: cashAdvancesQueryKey({
      scope: "all",
      status: "submitted",
      page: 1,
      limit: 20,
    }),
    queryFn: ({ signal }) =>
      listCashAdvances(
        api,
        { scope: "all", status: "submitted", page: 1, limit: 20 },
        signal,
      ),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveCashAdvance(api, requestId),
    onSuccess: () => {
      setActionMessage("Cash advance approved.");
      setRejectingId(null);
      void queryClient.invalidateQueries({
        queryKey: CASH_ADVANCES_QUERY_ROOT,
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
    }) => rejectCashAdvance(api, requestId, { reason }),
    onSuccess: () => {
      setActionMessage("Cash advance rejected.");
      setRejectingId(null);
      setRejectReason("");
      setRejectValidation(null);
      void queryClient.invalidateQueries({
        queryKey: CASH_ADVANCES_QUERY_ROOT,
      });
    },
  });

  const requests = inboxQuery.data?.data ?? [];

  function submitReject(requestId: string) {
    const parsed = rejectCashAdvanceInputSchema.safeParse({
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
      title="Pending approvals"
      description="Submitted cash advances waiting for your approval step."
      maxWidth={1080}
    >
      {actionMessage ? (
        <StatusMessage tone="success">{actionMessage}</StatusMessage>
      ) : null}

      {approveMutation.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            approveMutation.error,
            "The cash advance could not be approved.",
          )}
        </StatusMessage>
      ) : null}

      {rejectMutation.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            rejectMutation.error,
            "The cash advance could not be rejected.",
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
              "We could not load pending cash-advance approvals.",
            )}
          </StatusMessage>
          <Button
            label="Retry approvals"
            pendingLabel="Retrying…"
            accessibilityLabel="Retry cash-advance approvals"
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
            No submitted cash advances need your approval.
          </Text>
        ) : (
          <View
            accessibilityLabel="Pending cash-advance approvals"
            style={{ gap: spacing.lg }}
          >
            {requests.map((request: CashAdvanceRequest) => {
              const actionable = canActOnCashAdvance(request.status);
              const isRejecting = rejectingId === request.id;
              return (
                <View key={request.id} style={{ gap: spacing.sm }}>
                  <Text
                    selectable
                    style={{ fontWeight: "600", color: colors.text }}
                  >
                    {request.employee.name} · CA-{request.requestNumber}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted }}>
                    {request.requestDate} ·{" "}
                    {formatMoney(request.requestedTotal, request.currency)}
                    {request.entityName ? ` · ${request.entityName}` : ""}
                  </Text>
                  {request.items?.length ? (
                    <CashAdvanceLineItems
                      requestId={request.id}
                      requestNumber={request.requestNumber}
                      currency={request.currency}
                      items={request.items}
                    />
                  ) : null}
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
                        accessibilityLabel={`Approve cash advance for ${request.employee.name}`}
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
                        accessibilityLabel={`Reject cash advance for ${request.employee.name}`}
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
                        accessibilityLabel="Cash-advance rejection reason"
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
                          accessibilityLabel={`Confirm reject cash advance for ${request.employee.name}`}
                          pending={
                            rejectMutation.isPending &&
                            rejectMutation.variables?.requestId === request.id
                          }
                          onPress={() => submitReject(request.id)}
                        />
                        <Button
                          label="Cancel"
                          pendingLabel="Closing…"
                          accessibilityLabel="Cancel cash-advance rejection"
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
