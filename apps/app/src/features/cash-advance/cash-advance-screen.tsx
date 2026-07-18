import {
  ApiError,
  CASH_ADVANCES_QUERY_ROOT,
  canDeleteCashAdvanceDraft,
  canSubmitCashAdvance,
  cashAdvancesQueryKey,
  createCashAdvance,
  createCashAdvanceInputSchema,
  deleteCashAdvance,
  listCashAdvances,
  submitCashAdvance,
  type CashAdvancePayoutMode,
  type CashAdvanceRequest,
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
import { useState } from "react";
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
import { cashAdvanceStatusLabel } from "@/features/cash-advance/cash-advance-status-label";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function RequestRow({
  request,
  canCreate,
  submittingId,
  deletingId,
  onSubmit,
  onDelete,
}: {
  request: CashAdvanceRequest;
  canCreate: boolean;
  submittingId: string | null;
  deletingId: string | null;
  onSubmit: () => void;
  onDelete: () => void;
}) {
  const showSubmit = canCreate && canSubmitCashAdvance(request.status);
  const showDelete = canCreate && canDeleteCashAdvanceDraft(request.status);

  return (
    <View
      accessibilityLabel={`Cash advance CA-${request.requestNumber}`}
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
        CA-{request.requestNumber} ·{" "}
        {cashAdvanceStatusLabel(request.status)}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {request.employee.name}
        {request.entityName ? ` · ${request.entityName}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {request.requestDate} ·{" "}
        {request.payoutMode === "cash" ? "Cash" : "Bank transfer"} ·{" "}
        {formatMoney(request.requestedTotal, request.currency)} ·{" "}
        {request.itemCount} item{request.itemCount === 1 ? "" : "s"}
      </Text>
      {request.rejectReason ? (
        <Text selectable style={{ color: colors.errorText }}>
          Rejected: {request.rejectReason}
        </Text>
      ) : null}
      {showSubmit || showDelete ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {showSubmit ? (
            <Button
              label="Submit"
              pendingLabel="Submitting…"
              accessibilityLabel={`Submit CA-${request.requestNumber}`}
              pending={submittingId === request.id}
              onPress={onSubmit}
            />
          ) : null}
          {showDelete ? (
            <Button
              label="Delete draft"
              pendingLabel="Deleting…"
              accessibilityLabel={`Delete draft CA-${request.requestNumber}`}
              pending={deletingId === request.id}
              onPress={onDelete}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

interface CreateDraft {
  payoutMode: CashAdvancePayoutMode;
  currency: string;
  bankName: string;
  bankAccountNo: string;
  description: string;
  amount: string;
  notes: string;
}

const emptyDraft: CreateDraft = {
  payoutMode: "cash",
  currency: "THB",
  bankName: "",
  bankAccountNo: "",
  description: "",
  amount: "",
  notes: "",
};

function CreateRequestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const api = useApiClient();
  const [draft, setDraft] = useState<CreateDraft>(emptyDraft);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      const amount = Number(draft.amount);
      const parsed = createCashAdvanceInputSchema.safeParse({
        payoutMode: draft.payoutMode,
        currency: draft.currency,
        ...(draft.payoutMode === "bank-transfer"
          ? {
              bankName: draft.bankName,
              bankAccountNo: draft.bankAccountNo,
            }
          : {}),
        ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
        items: [
          {
            description: draft.description,
            requestedAmount: amount,
          },
        ],
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(issue?.message ?? "Check the form and try again.");
      }
      return createCashAdvance(api, parsed.data);
    },
    onSuccess: () => {
      setValidationError(null);
      setSubmitError(null);
      onCreated();
      onClose();
    },
    onError: (error) => {
      if (error instanceof Error && !(error instanceof ApiError)) {
        setValidationError(error.message);
        setSubmitError(null);
        return;
      }
      setValidationError(null);
      setSubmitError(
        errorMessage(error, "We could not create the cash advance."),
      );
    },
  });

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            gap: spacing.lg,
            padding: spacing.xxl,
          }}
        >
          <Card title="New cash advance" description="Create a draft request">
            <View style={{ gap: spacing.md }}>
              <Text style={{ color: colors.textMuted }}>Payout mode</Text>
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
              >
                {(
                  [
                    ["cash", "Cash"],
                    ["bank-transfer", "Bank transfer"],
                  ] as const
                ).map(([mode, label]) => {
                  const selected = draft.payoutMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      accessibilityRole="radio"
                      accessibilityLabel={label}
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setDraft((current) => ({
                          ...current,
                          payoutMode: mode,
                        }))
                      }
                      style={{
                        minHeight: 44,
                        justifyContent: "center",
                        paddingHorizontal: spacing.lg,
                        borderWidth: 1,
                        borderColor: selected
                          ? colors.accent
                          : colors.borderStrong,
                        borderRadius: radii.control,
                        backgroundColor: selected
                          ? colors.accent
                          : colors.surfaceRaised,
                      }}
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
                })}
              </View>

              <TextField
                label="Currency"
                value={draft.currency}
                onChangeText={(currency) =>
                  setDraft((current) => ({ ...current, currency }))
                }
                autoCapitalize="characters"
              />
              {draft.payoutMode === "bank-transfer" ? (
                <>
                  <TextField
                    label="Bank name"
                    value={draft.bankName}
                    onChangeText={(bankName) =>
                      setDraft((current) => ({ ...current, bankName }))
                    }
                  />
                  <TextField
                    label="Bank account number"
                    value={draft.bankAccountNo}
                    onChangeText={(bankAccountNo) =>
                      setDraft((current) => ({ ...current, bankAccountNo }))
                    }
                  />
                </>
              ) : null}
              <TextField
                label="Line description"
                value={draft.description}
                onChangeText={(description) =>
                  setDraft((current) => ({ ...current, description }))
                }
              />
              <TextField
                label="Amount"
                value={draft.amount}
                onChangeText={(amount) =>
                  setDraft((current) => ({ ...current, amount }))
                }
                keyboardType="decimal-pad"
              />
              <TextField
                label="Notes (optional)"
                value={draft.notes}
                onChangeText={(notes) =>
                  setDraft((current) => ({ ...current, notes }))
                }
              />

              {validationError ? (
                <StatusMessage tone="error">{validationError}</StatusMessage>
              ) : null}
              {submitError ? (
                <StatusMessage tone="error">{submitError}</StatusMessage>
              ) : null}

              <Button
                label="Create draft"
                pendingLabel="Creating…"
                accessibilityLabel="Create cash advance draft"
                pending={createMutation.isPending}
                onPress={() => createMutation.mutate()}
              />
              <Button
                label="Cancel"
                pendingLabel="Closing…"
                onPress={onClose}
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CashAdvanceScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canRead =
    hasPermission("cash-advance:read") ||
    hasPermission("cash-advance:read-all") ||
    hasPermission("cash-advance:approve") ||
    hasPermission("cash-advance:create");
  const canCreate = hasPermission("cash-advance:create");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const params = { scope: "mine" as const, page, limit: 20 };
  const listQuery = useQuery({
    queryKey: cashAdvancesQueryKey(params),
    queryFn: ({ signal }) => listCashAdvances(api, params, signal),
    enabled: canRead,
  });

  async function refreshList() {
    await queryClient.invalidateQueries({
      queryKey: CASH_ADVANCES_QUERY_ROOT,
    });
  }

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitCashAdvance(api, id),
    onMutate: (id) => {
      setSubmittingId(id);
      setActionError(null);
    },
    onSuccess: async () => {
      await refreshList();
    },
    onError: (error) => {
      setActionError(errorMessage(error, "Submit failed."));
    },
    onSettled: () => setSubmittingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCashAdvance(api, id),
    onMutate: (id) => {
      setDeletingId(id);
      setActionError(null);
    },
    onSuccess: async () => {
      await refreshList();
    },
    onError: (error) => {
      setActionError(errorMessage(error, "Delete failed."));
    },
    onSettled: () => setDeletingId(null),
  });

  if (!canRead) {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          padding: spacing.xxl,
        }}
      >
        <StatusMessage tone="error">
          You do not have permission to view cash advances.
        </StatusMessage>
      </ScrollView>
    );
  }

  const meta = listQuery.data?.meta;

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
        }}
      >
        <View style={{ width: "100%", maxWidth: 720, gap: spacing.lg }}>
          <Card
            title="Cash advance"
            description="Request and track cash advances"
          >
            <View style={{ gap: spacing.md }}>
              <Text style={{ color: colors.textMuted }}>
                Self-service drafts and submit. Approval-step config, inbox
                approve/reject, and disbursement proof uploads stay deferred.
              </Text>
              {canCreate ? (
                <Button
                  label="New request"
                  pendingLabel="Opening…"
                  accessibilityLabel="New cash advance request"
                  onPress={() => setShowCreate(true)}
                />
              ) : null}
            </View>
          </Card>

          {actionError ? (
            <StatusMessage tone="error">{actionError}</StatusMessage>
          ) : null}

          {listQuery.isLoading ? (
            <LoadingState label="Loading cash advances…" />
          ) : null}
          {listQuery.isError ? (
            <StatusMessage tone="error">
              {errorMessage(
                listQuery.error,
                "We could not load cash advances.",
              )}
            </StatusMessage>
          ) : null}

          {listQuery.data?.data.length ? (
            <View style={{ gap: spacing.md }}>
              {listQuery.data.data.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  canCreate={canCreate}
                  submittingId={submittingId}
                  deletingId={deletingId}
                  onSubmit={() => submitMutation.mutate(request.id)}
                  onDelete={() => deleteMutation.mutate(request.id)}
                />
              ))}
            </View>
          ) : null}

          {listQuery.isSuccess && listQuery.data.data.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>
              No cash advance requests yet.
            </Text>
          ) : null}

          {meta && meta.totalPages > 1 ? (
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                alignItems: "center",
              }}
            >
              <Button
                label="Previous"
                pendingLabel="Loading…"
                disabled={page <= 1 || listQuery.isFetching}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              />
              <Text style={{ color: colors.textMuted }}>
                Page {meta.page} of {meta.totalPages}
              </Text>
              <Button
                label="Next"
                pendingLabel="Loading…"
                disabled={page >= meta.totalPages || listQuery.isFetching}
                onPress={() => setPage((current) => current + 1)}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {showCreate ? (
        <CreateRequestModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            void refreshList();
          }}
        />
      ) : null}
    </>
  );
}
