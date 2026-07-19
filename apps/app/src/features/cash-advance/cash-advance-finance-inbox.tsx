import {
  ApiError,
  CASH_ADVANCES_QUERY_ROOT,
  canClearCashAdvance,
  canDisburseCashAdvance,
  cashAdvancesQueryKey,
  clearCashAdvance,
  disburseCashAdvance,
  disburseCashAdvanceInputSchema,
  listCashAdvances,
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

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function CashAdvanceFinanceInbox() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofValidation, setProofValidation] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const approvedQuery = useQuery({
    queryKey: cashAdvancesQueryKey({
      scope: "all",
      status: "approved",
      page: 1,
      limit: 20,
    }),
    queryFn: ({ signal }) =>
      listCashAdvances(
        api,
        { scope: "all", status: "approved", page: 1, limit: 20 },
        signal,
      ),
  });

  const disbursedQuery = useQuery({
    queryKey: cashAdvancesQueryKey({
      scope: "all",
      status: "disbursed",
      page: 1,
      limit: 20,
    }),
    queryFn: ({ signal }) =>
      listCashAdvances(
        api,
        { scope: "all", status: "disbursed", page: 1, limit: 20 },
        signal,
      ),
  });

  const disburseMutation = useMutation({
    mutationFn: ({
      requestId,
      proofUrl,
    }: {
      requestId: string;
      proofUrl: string;
    }) => disburseCashAdvance(api, requestId, { proofUrl }),
    onSuccess: () => {
      setActionMessage("Cash advance marked disbursed.");
      setProofValidation(null);
      void queryClient.invalidateQueries({
        queryKey: CASH_ADVANCES_QUERY_ROOT,
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: (requestId: string) => clearCashAdvance(api, requestId),
    onSuccess: () => {
      setActionMessage("Cash advance marked cleared.");
      void queryClient.invalidateQueries({
        queryKey: CASH_ADVANCES_QUERY_ROOT,
      });
    },
  });

  const approved = approvedQuery.data?.data ?? [];
  const disbursed = disbursedQuery.data?.data ?? [];
  const isLoading = approvedQuery.isPending || disbursedQuery.isPending;
  const loadError = approvedQuery.error ?? disbursedQuery.error;

  function submitDisburse(request: CashAdvanceRequest) {
    const parsed = disburseCashAdvanceInputSchema.safeParse({
      proofUrl: proofUrls[request.id] ?? "",
    });
    if (!parsed.success) {
      setProofValidation(
        parsed.error.issues[0]?.message ??
          "Disbursement proof file is required",
      );
      return;
    }
    setProofValidation(null);
    setActionMessage(null);
    clearMutation.reset();
    disburseMutation.mutate({
      requestId: request.id,
      proofUrl: parsed.data.proofUrl,
    });
  }

  return (
    <Card
      title="Finance actions"
      description="Mark approved advances disbursed (proof URL) or clear disbursed advances."
      maxWidth={1080}
    >
      {actionMessage ? (
        <StatusMessage tone="success">{actionMessage}</StatusMessage>
      ) : null}

      {disburseMutation.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            disburseMutation.error,
            "The cash advance could not be marked disbursed.",
          )}
        </StatusMessage>
      ) : null}

      {clearMutation.isError ? (
        <StatusMessage tone="error">
          {errorMessage(
            clearMutation.error,
            "The cash advance could not be marked cleared.",
          )}
        </StatusMessage>
      ) : null}

      {proofValidation ? (
        <StatusMessage tone="error">{proofValidation}</StatusMessage>
      ) : null}

      {isLoading ? <LoadingState label="Loading finance queue…" /> : null}

      {loadError ? (
        <View style={{ gap: spacing.md }}>
          <StatusMessage tone="error">
            {errorMessage(
              loadError,
              "We could not load the cash-advance finance queue.",
            )}
          </StatusMessage>
          <Button
            label="Retry finance queue"
            pendingLabel="Retrying…"
            accessibilityLabel="Retry cash-advance finance queue"
            pending={approvedQuery.isFetching || disbursedQuery.isFetching}
            onPress={() => {
              void approvedQuery.refetch();
              void disbursedQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {!isLoading && !loadError ? (
        approved.length === 0 && disbursed.length === 0 ? (
          <Text selectable style={{ color: colors.textMuted }}>
            No approved or disbursed cash advances need finance action.
          </Text>
        ) : (
          <View
            accessibilityLabel="Cash-advance finance actions"
            style={{ gap: spacing.lg }}
          >
            {approved.map((request) => {
              if (!canDisburseCashAdvance(request.status)) return null;
              return (
                <View key={request.id} style={{ gap: spacing.sm }}>
                  <Text
                    selectable
                    style={{ fontWeight: "600", color: colors.text }}
                  >
                    {request.employee.name} · CA-{request.requestNumber}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted }}>
                    Approved · {request.requestDate} ·{" "}
                    {formatMoney(request.approvedTotal, request.currency)}
                    {request.entityName ? ` · ${request.entityName}` : ""}
                  </Text>
                  <TextField
                    label={`Disbursement proof URL for ${request.employee.name}`}
                    value={proofUrls[request.id] ?? ""}
                    onChangeText={(value) =>
                      setProofUrls((current) => ({
                        ...current,
                        [request.id]: value,
                      }))
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Button
                    label="Mark disbursed"
                    pendingLabel="Disbursing…"
                    accessibilityLabel={`Mark cash advance disbursed for ${request.employee.name}`}
                    pending={
                      disburseMutation.isPending &&
                      disburseMutation.variables?.requestId === request.id
                    }
                    disabled={
                      disburseMutation.isPending || clearMutation.isPending
                    }
                    onPress={() => submitDisburse(request)}
                  />
                </View>
              );
            })}

            {disbursed.map((request) => {
              if (!canClearCashAdvance(request.status)) return null;
              return (
                <View key={request.id} style={{ gap: spacing.sm }}>
                  <Text
                    selectable
                    style={{ fontWeight: "600", color: colors.text }}
                  >
                    {request.employee.name} · CA-{request.requestNumber}
                  </Text>
                  <Text selectable style={{ color: colors.textMuted }}>
                    Disbursed · {request.requestDate} ·{" "}
                    {formatMoney(request.approvedTotal, request.currency)}
                    {request.entityName ? ` · ${request.entityName}` : ""}
                  </Text>
                  <Button
                    label="Mark cleared"
                    pendingLabel="Clearing…"
                    accessibilityLabel={`Mark cash advance cleared for ${request.employee.name}`}
                    pending={
                      clearMutation.isPending &&
                      clearMutation.variables === request.id
                    }
                    disabled={
                      disburseMutation.isPending || clearMutation.isPending
                    }
                    onPress={() => {
                      setActionMessage(null);
                      disburseMutation.reset();
                      clearMutation.mutate(request.id);
                    }}
                  />
                </View>
              );
            })}
          </View>
        )
      ) : null}
    </Card>
  );
}
