import {
  addExpenseLine,
  addExpenseLineInputSchema,
  ApiError,
  canSubmitExpenseReport,
  createExpenseReport,
  createExpenseReportInputSchema,
  EXPENSE_FORM_ENTITIES_QUERY_KEY,
  EXPENSE_REPORTS_QUERY_ROOT,
  expenseReportDetailQueryKey,
  expenseReportsQueryKey,
  getExpenseReport,
  listExpenseFormEntities,
  listExpenseReports,
  submitExpenseReport,
  type ExpenseReport,
  type ExpenseReportCategory,
  type ExpenseReportDetail,
  type ExpenseReportStatus,
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
import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { ZodError } from "zod";

import { runLockedTransition } from "@/features/directory/transition-lock";
import { expenseStatusLabel } from "@/features/expenses/expense-status-label";
import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

const STATUS_FILTERS: { label: string; value?: ExpenseReportStatus }[] = [
  { label: "All" },
  { label: "Draft", value: "draft" },
  { label: "Submitted", value: "submitted" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Payroll", value: "payroll_processed" },
  { label: "Reimbursed", value: "reimbursed" },
];

interface ReportDraft {
  entityId: string;
  period: string;
  title: string;
  category: Exclude<ExpenseReportCategory, "allowance">;
}

interface LineDraft {
  description: string;
  amount: string;
  currency: string;
  date: string;
  receiptUrl: string;
}

const emptyReportDraft: ReportDraft = {
  entityId: "",
  period: "",
  title: "",
  category: "general",
};

const emptyLineDraft: LineDraft = {
  description: "",
  amount: "",
  currency: "USD",
  date: "",
  receiptUrl: "",
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  return fallback;
}

function formatTotal(
  report: Pick<ExpenseReport, "totalAmount" | "totalCurrency" | "converted">,
): string {
  if (!report.converted) return "— (rate missing)";
  return `${report.totalAmount} ${report.totalCurrency}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text selectable style={{ color: colors.textMuted }}>
      {label}: {value}
    </Text>
  );
}

function CreateReportDialog({
  visible,
  draft,
  entities,
  entitiesLoading,
  entitiesError,
  validationError,
  submitting,
  submissionError,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  draft: ReportDraft;
  entities: { id: string; name: string }[];
  entitiesLoading: boolean;
  entitiesError: string | null;
  validationError: string | null;
  submitting: boolean;
  submissionError: string | null;
  onDraftChange: (draft: ReportDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ gap: spacing.lg, padding: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          <Card
            title="New expense report"
            description="Create a draft report, then add lines and submit."
            maxWidth={720}
          >
            <View style={{ gap: spacing.md }}>
              {entitiesLoading ? (
                <LoadingState label="Loading entities…" />
              ) : null}
              {entitiesError ? (
                <StatusMessage tone="error">{entitiesError}</StatusMessage>
              ) : null}
              <Text selectable style={{ color: colors.textMuted }}>
                Entity
              </Text>
              <View style={{ gap: spacing.sm }}>
                {entities.map((entity) => {
                  const selected = draft.entityId === entity.id;
                  return (
                    <Pressable
                      key={entity.id}
                      accessibilityRole="radio"
                      accessibilityLabel={`Entity ${entity.name}`}
                      accessibilityState={{ selected }}
                      onPress={() =>
                        onDraftChange({ ...draft, entityId: entity.id })
                      }
                      style={{
                        minHeight: 44,
                        justifyContent: "center",
                        paddingHorizontal: spacing.lg,
                        borderWidth: 1,
                        borderColor: selected
                          ? colors.accent
                          : colors.borderStrong,
                        borderRadius: 8,
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
                        {entity.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextField
                label="Period"
                value={draft.period}
                placeholder="YYYY-MM"
                autoCapitalize="none"
                onChangeText={(period) => onDraftChange({ ...draft, period })}
              />
              <TextField
                label="Title"
                value={draft.title}
                onChangeText={(title) => onDraftChange({ ...draft, title })}
              />
              {validationError ? (
                <StatusMessage>{validationError}</StatusMessage>
              ) : null}
              {submissionError ? (
                <StatusMessage tone="error">{submissionError}</StatusMessage>
              ) : null}
              <Button
                label="Create draft"
                pendingLabel="Creating…"
                pending={submitting}
                onPress={onSubmit}
              />
              <Button
                label="Close"
                pendingLabel="Closing…"
                disabled={submitting}
                onPress={onClose}
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddLineDialog({
  visible,
  draft,
  validationError,
  submitting,
  submissionError,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  draft: LineDraft;
  validationError: string | null;
  submitting: boolean;
  submissionError: string | null;
  onDraftChange: (draft: LineDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ gap: spacing.lg, padding: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          <Card
            title="Add expense line"
            description="Optional receipt URL only for now. Native R2 upload lands later."
            maxWidth={720}
          >
            <View style={{ gap: spacing.md }}>
              <TextField
                label="Description"
                value={draft.description}
                onChangeText={(description) =>
                  onDraftChange({ ...draft, description })
                }
              />
              <TextField
                label="Amount"
                value={draft.amount}
                keyboardType="decimal-pad"
                onChangeText={(amount) => onDraftChange({ ...draft, amount })}
              />
              <TextField
                label="Currency"
                value={draft.currency}
                autoCapitalize="characters"
                onChangeText={(currency) =>
                  onDraftChange({ ...draft, currency })
                }
              />
              <TextField
                label="Date"
                value={draft.date}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                onChangeText={(date) => onDraftChange({ ...draft, date })}
              />
              <TextField
                label="Receipt URL (optional)"
                value={draft.receiptUrl}
                autoCapitalize="none"
                placeholder="https://"
                onChangeText={(receiptUrl) =>
                  onDraftChange({ ...draft, receiptUrl })
                }
              />
              {validationError ? (
                <StatusMessage>{validationError}</StatusMessage>
              ) : null}
              {submissionError ? (
                <StatusMessage tone="error">{submissionError}</StatusMessage>
              ) : null}
              <Button
                label="Save line"
                pendingLabel="Saving…"
                pending={submitting}
                onPress={onSubmit}
              />
              <Button
                label="Close"
                pendingLabel="Closing…"
                disabled={submitting}
                onPress={onClose}
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReportDetailSheet({
  reportId,
  canCreate,
  onClose,
  onAddLine,
  onSubmitReport,
  submitting,
  submitError,
  addingLine,
}: {
  reportId: string;
  canCreate: boolean;
  onClose: () => void;
  onAddLine: () => void;
  onSubmitReport: () => void;
  submitting: boolean;
  submitError: string | null;
  addingLine: boolean;
}) {
  const api = useApiClient();
  const detailQuery = useQuery({
    queryKey: expenseReportDetailQueryKey(reportId),
    queryFn: ({ signal }) => getExpenseReport(api, reportId, signal),
  });
  const detail = detailQuery.data;
  const canSubmit =
    detail != null &&
    canSubmitExpenseReport(detail.status, detail.lineCount) &&
    canCreate;

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.35)",
          padding: spacing.lg,
        }}
      >
        <ScrollView
          contentContainerStyle={{
            gap: spacing.md,
            paddingBottom: spacing.xxl,
          }}
        >
          {detailQuery.isPending ? (
            <LoadingState label="Loading expense report…" />
          ) : null}
          {detailQuery.isError ? (
            <Card title="Unable to load report" maxWidth={560}>
              <StatusMessage tone="error">
                {errorMessage(
                  detailQuery.error,
                  "We could not load expense reports.",
                )}
              </StatusMessage>
              <Button
                label="Close"
                pendingLabel="Closing…"
                onPress={onClose}
              />
            </Card>
          ) : null}
          {detail ? (
            <ReportDetailCard
              detail={detail}
              canCreate={canCreate}
              canSubmit={canSubmit}
              submitting={submitting}
              submitError={submitError}
              addingLine={addingLine}
              onClose={onClose}
              onAddLine={onAddLine}
              onSubmitReport={onSubmitReport}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ReportDetailCard({
  detail,
  canCreate,
  canSubmit,
  submitting,
  submitError,
  addingLine,
  onClose,
  onAddLine,
  onSubmitReport,
}: {
  detail: ExpenseReportDetail;
  canCreate: boolean;
  canSubmit: boolean;
  submitting: boolean;
  submitError: string | null;
  addingLine: boolean;
  onClose: () => void;
  onAddLine: () => void;
  onSubmitReport: () => void;
}) {
  const isDraft = detail.status === "draft";
  return (
    <Card title={detail.title} description={detail.period} maxWidth={560}>
      <View style={{ gap: spacing.sm }}>
        <DetailRow label="Status" value={expenseStatusLabel(detail.status)} />
        <DetailRow label="Entity" value={detail.entity.name} />
        <DetailRow
          label="Category"
          value={detail.category.replaceAll("_", " ")}
        />
        <DetailRow label="Total" value={formatTotal(detail)} />
        <DetailRow label="Line items" value={String(detail.lineCount)} />
        {detail.rejectReason ? (
          <DetailRow label="Reject reason" value={detail.rejectReason} />
        ) : null}
        {canCreate && isDraft ? (
          <Button
            label="Add line"
            pendingLabel="Opening…"
            accessibilityLabel={`Add line to ${detail.title}`}
            pending={addingLine}
            onPress={onAddLine}
          />
        ) : null}
        {canSubmit ? (
          <Button
            label="Submit report"
            pendingLabel="Submitting…"
            accessibilityLabel={`Submit ${detail.title}`}
            pending={submitting}
            onPress={onSubmitReport}
          />
        ) : null}
        {submitError ? (
          <StatusMessage tone="error">{submitError}</StatusMessage>
        ) : null}
        <Button
          label="Close"
          pendingLabel="Closing…"
          accessibilityLabel="Close expense report detail"
          onPress={onClose}
        />
      </View>
    </Card>
  );
}

function ReportCard({
  report,
  onOpen,
}: {
  report: ExpenseReport;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open expense report ${report.title}`}
      onPress={onOpen}
    >
      <Card title={report.title} description={report.period}>
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.textMuted }}>
            {expenseStatusLabel(report.status)} · {formatTotal(report)}
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {report.entity.name} · {report._count.expenses} line
            {report._count.expenses === 1 ? "" : "s"}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

export function ExpensesScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission("expense:create");
  const employeeId = user?.id;
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ExpenseReportStatus | undefined>();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reportDraft, setReportDraft] = useState<ReportDraft>(emptyReportDraft);
  const [createValidation, setCreateValidation] = useState<string | null>(null);
  const [lineReportId, setLineReportId] = useState<string | null>(null);
  const [lineDraft, setLineDraft] = useState<LineDraft>(emptyLineDraft);
  const [lineValidation, setLineValidation] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const transitionRef = useRef(false);
  const params = useMemo(
    () =>
      employeeId
        ? {
            page,
            limit: 20,
            employeeId,
            ...(status ? { status } : {}),
          }
        : null,
    [employeeId, page, status],
  );
  const reportsQuery = useQuery({
    queryKey: params
      ? expenseReportsQueryKey(params)
      : ([...EXPENSE_REPORTS_QUERY_ROOT, "unavailable"] as const),
    queryFn: ({ signal }) => {
      if (!params) {
        throw new Error("Authenticated expense history requires a user id.");
      }
      return listExpenseReports(api, params, signal).finally(() => {
        transitionRef.current = false;
      });
    },
    enabled: !!params,
  });
  const entitiesQuery = useQuery({
    queryKey: EXPENSE_FORM_ENTITIES_QUERY_KEY,
    queryFn: ({ signal }) => listExpenseFormEntities(api, signal),
    enabled: createOpen && canCreate,
  });
  const isTransitioning = reportsQuery.isFetching;

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createExpenseReport>[1]) =>
      createExpenseReport(api, input),
    onSuccess: (created) => {
      setCreateOpen(false);
      setReportDraft(emptyReportDraft);
      setCreateValidation(null);
      setSuccessMessage("Draft expense report created.");
      setSelectedReportId(created.id);
      void queryClient.invalidateQueries({
        queryKey: EXPENSE_REPORTS_QUERY_ROOT,
      });
    },
  });

  const addLineMutation = useMutation({
    mutationFn: ({
      reportId,
      input,
    }: {
      reportId: string;
      input: Parameters<typeof addExpenseLine>[2];
    }) => addExpenseLine(api, reportId, input),
    onSuccess: (_line, variables) => {
      setLineReportId(null);
      setLineDraft(emptyLineDraft);
      setLineValidation(null);
      setSuccessMessage("Expense line added.");
      setSelectedReportId(variables.reportId);
      void queryClient.invalidateQueries({
        queryKey: EXPENSE_REPORTS_QUERY_ROOT,
      });
      void queryClient.invalidateQueries({
        queryKey: expenseReportDetailQueryKey(variables.reportId),
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (reportId: string) => submitExpenseReport(api, reportId),
    onSuccess: (_report, reportId) => {
      setSuccessMessage("Expense report submitted.");
      void queryClient.invalidateQueries({
        queryKey: EXPENSE_REPORTS_QUERY_ROOT,
      });
      void queryClient.invalidateQueries({
        queryKey: expenseReportDetailQueryKey(reportId),
      });
    },
  });

  function startTransition(update: () => void) {
    runLockedTransition(transitionRef, update);
  }

  function confirmCreate() {
    const parsed = createExpenseReportInputSchema.safeParse(reportDraft);
    if (!parsed.success) {
      setCreateValidation(
        parsed.error.issues[0]?.message ?? "Check the report fields.",
      );
      return;
    }
    setCreateValidation(null);
    createMutation.mutate(parsed.data);
  }

  function confirmAddLine() {
    if (!lineReportId) return;
    const amount = Number(lineDraft.amount);
    const parsed = addExpenseLineInputSchema.safeParse({
      description: lineDraft.description,
      amount,
      currency: lineDraft.currency,
      date: lineDraft.date,
      ...(lineDraft.receiptUrl.trim()
        ? { receiptUrl: lineDraft.receiptUrl.trim() }
        : {}),
    });
    if (!parsed.success) {
      setLineValidation(
        parsed.error.issues[0]?.message ?? "Check the line fields.",
      );
      return;
    }
    setLineValidation(null);
    addLineMutation.mutate({ reportId: lineReportId, input: parsed.data });
  }

  if (!employeeId) {
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
        <Card title="Expenses unavailable">
          <StatusMessage>
            Sign in again to load your expense reports.
          </StatusMessage>
        </Card>
      </View>
    );
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
              Expenses
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              Draft reports, line items with optional receipt URLs, and submit.
              Approvals and native receipt upload remain later.
            </Text>
          </View>

          {canCreate ? (
            <Button
              label="New report"
              pendingLabel="Opening…"
              accessibilityLabel="New expense report"
              onPress={() => {
                setSuccessMessage(null);
                setCreateOpen(true);
              }}
            />
          ) : (
            <StatusMessage>
              Your role can view expense reports but cannot create or submit
              them.
            </StatusMessage>
          )}

          {successMessage ? (
            <StatusMessage tone="success">{successMessage}</StatusMessage>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            {STATUS_FILTERS.map((filter) => {
              const selected = status === filter.value;
              return (
                <Pressable
                  key={filter.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${filter.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    startTransition(() => {
                      setPage(1);
                      setStatus(filter.value);
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

          {reportsQuery.isPending ? (
            <LoadingState label="Loading expense reports…" />
          ) : null}

          {reportsQuery.isError ? (
            <Card title="Expenses unavailable" maxWidth={1080}>
              <StatusMessage tone="error">
                {errorMessage(
                  reportsQuery.error,
                  "We could not load expense reports.",
                )}
              </StatusMessage>
              <Button
                label="Retry"
                pendingLabel="Retrying…"
                accessibilityLabel="Retry expenses"
                pending={reportsQuery.isFetching}
                onPress={() => {
                  void reportsQuery.refetch();
                }}
              />
            </Card>
          ) : null}

          {reportsQuery.data ? (
            reportsQuery.data.data.length === 0 ? (
              <Card title="No expense reports" maxWidth={1080}>
                <Text selectable style={{ color: colors.textMuted }}>
                  You have no expense reports in this filter yet.
                </Text>
              </Card>
            ) : (
              <View
                accessibilityLabel="My expense reports"
                style={{ gap: spacing.lg }}
              >
                {reportsQuery.data.data.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    onOpen={() => setSelectedReportId(report.id)}
                  />
                ))}
                {reportsQuery.data.meta.totalPages > 1 ? (
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
                      accessibilityLabel="Previous expenses page"
                      disabled={page <= 1 || isTransitioning}
                      onPress={() => {
                        startTransition(() => {
                          setPage((current) => Math.max(1, current - 1));
                        });
                      }}
                    />
                    <Text selectable style={{ color: colors.textMuted }}>
                      Page {reportsQuery.data.meta.page} of{" "}
                      {reportsQuery.data.meta.totalPages}
                    </Text>
                    <Button
                      label="Next page"
                      pendingLabel="Loading…"
                      accessibilityLabel="Next expenses page"
                      disabled={
                        page >= reportsQuery.data.meta.totalPages ||
                        isTransitioning
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

      {selectedReportId ? (
        <ReportDetailSheet
          reportId={selectedReportId}
          canCreate={canCreate}
          submitting={submitMutation.isPending}
          submitError={
            submitMutation.isError
              ? errorMessage(
                  submitMutation.error,
                  "Could not submit expense report.",
                )
              : null
          }
          addingLine={false}
          onClose={() => {
            submitMutation.reset();
            setSelectedReportId(null);
          }}
          onAddLine={() => {
            setLineDraft(emptyLineDraft);
            setLineValidation(null);
            setLineReportId(selectedReportId);
            setSelectedReportId(null);
          }}
          onSubmitReport={() => {
            submitMutation.mutate(selectedReportId);
          }}
        />
      ) : null}

      <CreateReportDialog
        visible={createOpen}
        draft={reportDraft}
        entities={entitiesQuery.data ?? []}
        entitiesLoading={entitiesQuery.isPending}
        entitiesError={
          entitiesQuery.isError
            ? errorMessage(entitiesQuery.error, "Could not load entities.")
            : null
        }
        validationError={createValidation}
        submitting={createMutation.isPending}
        submissionError={
          createMutation.isError
            ? errorMessage(createMutation.error, "Could not create report.")
            : null
        }
        onDraftChange={setReportDraft}
        onClose={() => {
          setCreateOpen(false);
          setCreateValidation(null);
        }}
        onSubmit={confirmCreate}
      />

      <AddLineDialog
        visible={lineReportId != null}
        draft={lineDraft}
        validationError={lineValidation}
        submitting={addLineMutation.isPending}
        submissionError={
          addLineMutation.isError
            ? errorMessage(addLineMutation.error, "Could not add line.")
            : null
        }
        onDraftChange={setLineDraft}
        onClose={() => {
          setLineReportId(null);
          setLineValidation(null);
        }}
        onSubmit={confirmAddLine}
      />
    </>
  );
}
