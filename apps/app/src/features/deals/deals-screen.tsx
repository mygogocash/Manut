import {
  ApiError,
  createDeal,
  createDealInputSchema,
  DEAL_STAGES,
  DEALS_PIPELINE_QUERY_ROOT,
  DEALS_QUERY_ROOT,
  dealDetailQueryKey,
  dealsPipelineQueryKey,
  dealsQueryKey,
  getDeal,
  getDealPipeline,
  listDeals,
  type Deal,
  type DealDetail,
  type DealStage,
  updateDeal,
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
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadDeals(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("deals:read");
}

function canCreateDeals(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("deals:create") || hasPermission("deals:manage");
}

function canUpdateDeals(hasPermission: (code: string) => boolean): boolean {
  return hasPermission("deals:update") || hasPermission("deals:manage");
}

function stageLabel(stage: string): string {
  return stage.replaceAll("_", " ");
}

function adjacentStages(stage: string): {
  previous: DealStage | null;
  next: DealStage | null;
} {
  const index = DEAL_STAGES.indexOf(stage as DealStage);
  if (index < 0) {
    return { previous: null, next: null };
  }
  return {
    previous: index > 0 ? DEAL_STAGES[index - 1]! : null,
    next: index < DEAL_STAGES.length - 1 ? DEAL_STAGES[index + 1]! : null,
  };
}

function CreateDealForm({ onCreated }: { onCreated: (deal: Deal) => void }) {
  const api = useApiClient();
  const [company, setCompany] = useState("");
  const [valueText, setValueText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createDeal>[1]) =>
      createDeal(api, input),
    onSuccess: (deal) => {
      setCompany("");
      setValueText("");
      setValidationError(null);
      setSuccessMessage(`Created "${deal.company}".`);
      onCreated(deal);
    },
  });

  function submit() {
    const value = Number(valueText);
    const parsed = createDealInputSchema.safeParse({
      company,
      value: Number.isFinite(value) ? value : Number.NaN,
    });
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? "Check company and value.",
      );
      return;
    }
    setValidationError(null);
    setSuccessMessage(null);
    createMutation.mutate(parsed.data);
  }

  return (
    <Card title="Create deal" maxWidth={720}>
      <View style={{ gap: spacing.md }}>
        <Text style={{ color: colors.textMuted }}>
          Creates a lead-stage deal. Hard-delete stays deferred (API has no
          soft-delete).
        </Text>
        <TextField
          label="Company"
          value={company}
          onChangeText={setCompany}
          placeholder="Company"
          editable={!createMutation.isPending}
        />
        <TextField
          label="Value"
          value={valueText}
          onChangeText={setValueText}
          placeholder="0"
          keyboardType="decimal-pad"
          editable={!createMutation.isPending}
        />
        {validationError ? (
          <StatusMessage tone="error">{validationError}</StatusMessage>
        ) : null}
        {createMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(createMutation.error, "We could not create the deal.")}
          </StatusMessage>
        ) : null}
        {successMessage ? (
          <StatusMessage tone="success">{successMessage}</StatusMessage>
        ) : null}
        <Button
          label="Create deal"
          pendingLabel="Creating…"
          accessibilityLabel="Create deal"
          pending={createMutation.isPending}
          onPress={submit}
        />
      </View>
    </Card>
  );
}

function DealNotesEditor({
  dealId,
  onSaved,
  onClose,
}: {
  dealId: string;
  onSaved: (deal: DealDetail) => void;
  onClose: () => void;
}) {
  const api = useApiClient();
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const detailQuery = useQuery({
    queryKey: dealDetailQueryKey(dealId),
    queryFn: ({ signal }) => getDeal(api, dealId, signal),
  });

  useEffect(() => {
    if (detailQuery.data && !hydrated) {
      setNotes(detailQuery.data.notes ?? "");
      setHydrated(true);
    }
  }, [detailQuery.data, hydrated]);

  const saveMutation = useMutation({
    mutationFn: () => updateDeal(api, dealId, { notes }),
    onSuccess: onSaved,
  });

  return (
    <Card title="Deal notes" maxWidth={720}>
      <View style={{ gap: spacing.md }}>
        {detailQuery.isPending ? (
          <LoadingState label="Loading notes…" />
        ) : null}
        {detailQuery.isError ? (
          <StatusMessage tone="error">
            {errorMessage(detailQuery.error, "We could not load notes.")}
          </StatusMessage>
        ) : null}
        {detailQuery.data ? (
          <>
            <Text selectable style={{ fontWeight: "600", color: colors.text }}>
              {detailQuery.data.company}
            </Text>
            <TextField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes"
              multiline
              style={{ minHeight: 96, textAlignVertical: "top" }}
              editable={!saveMutation.isPending}
            />
            {saveMutation.isError ? (
              <StatusMessage tone="error">
                {errorMessage(
                  saveMutation.error,
                  "We could not save the notes.",
                )}
              </StatusMessage>
            ) : null}
            {saveMutation.isSuccess ? (
              <StatusMessage tone="success">Notes saved.</StatusMessage>
            ) : null}
            <Button
              label="Save notes"
              pendingLabel="Saving…"
              accessibilityLabel="Save notes"
              pending={saveMutation.isPending}
              onPress={() => saveMutation.mutate()}
            />
            <Button
              label="Close notes"
              accessibilityLabel="Close notes"
              onPress={onClose}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

function DealKanbanCard({
  deal,
  canUpdate,
  pending,
  onMove,
  onEditNotes,
}: {
  deal: Deal;
  canUpdate: boolean;
  pending: boolean;
  onMove: (stage: DealStage) => void;
  onEditNotes: () => void;
}) {
  const { previous, next } = adjacentStages(deal.stage);

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {deal.company}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {deal.value}
        {deal.contact ? ` · ${deal.contact}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {deal.owner.name}
      </Text>
      {canUpdate ? (
        <View style={{ gap: spacing.xs }}>
          {previous ? (
            <Button
              label={`Move to ${stageLabel(previous)}`}
              accessibilityLabel={`Move ${deal.company} to ${stageLabel(previous)}`}
              pending={pending}
              pendingLabel="Moving…"
              onPress={() => onMove(previous)}
            />
          ) : null}
          {next ? (
            <Button
              label={`Move to ${stageLabel(next)}`}
              accessibilityLabel={`Move ${deal.company} to ${stageLabel(next)}`}
              pending={pending}
              pendingLabel="Moving…"
              onPress={() => onMove(next)}
            />
          ) : null}
          <Button
            label="Edit notes"
            accessibilityLabel={`Edit notes for ${deal.company}`}
            onPress={onEditNotes}
          />
        </View>
      ) : null}
    </View>
  );
}

export function DealsScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const allowed = canReadDeals(hasPermission);
  const canCreate = canCreateDeals(hasPermission);
  const canUpdate = canUpdateDeals(hasPermission);
  const [notesDealId, setNotesDealId] = useState<string | null>(null);
  const [movingDealId, setMovingDealId] = useState<string | null>(null);

  const listParams = { page: 1, limit: 100 } as const;

  const dealsQuery = useQuery({
    queryKey: dealsQueryKey(listParams),
    queryFn: ({ signal }) => listDeals(api, listParams, signal),
    enabled: allowed,
  });

  const pipelineQuery = useQuery({
    queryKey: dealsPipelineQueryKey(),
    queryFn: ({ signal }) => getDealPipeline(api, signal),
    enabled: allowed,
  });

  const stageBuckets = useMemo(() => {
    const deals = dealsQuery.data?.data ?? [];
    return DEAL_STAGES.map((stage) => ({
      stage,
      deals: deals.filter((deal) => deal.stage === stage),
    }));
  }, [dealsQuery.data?.data]);

  const stageMutation = useMutation({
    mutationFn: ({ dealId, stage }: { dealId: string; stage: DealStage }) =>
      updateDeal(api, dealId, { stage }),
    onMutate: ({ dealId }) => {
      setMovingDealId(dealId);
    },
    onSettled: () => {
      setMovingDealId(null);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DEALS_QUERY_ROOT });
      void queryClient.invalidateQueries({
        queryKey: DEALS_PIPELINE_QUERY_ROOT,
      });
    },
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Deals" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view deals.
          </StatusMessage>
        </Card>
      </ScrollView>
    );
  }

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
      <View style={{ width: "100%", maxWidth: 720, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            Deals
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Pipeline kanban with stage updates and notes. Hard-delete stays
            deferred.
          </Text>
        </View>

        {canCreate ? (
          <CreateDealForm
            onCreated={() => {
              void queryClient.invalidateQueries({
                queryKey: DEALS_QUERY_ROOT,
              });
              void queryClient.invalidateQueries({
                queryKey: DEALS_PIPELINE_QUERY_ROOT,
              });
            }}
          />
        ) : null}

        {pipelineQuery.isPending ? (
          <LoadingState label="Loading pipeline…" />
        ) : null}
        {pipelineQuery.isError ? (
          <Card title="Pipeline unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                pipelineQuery.error,
                "We could not load the pipeline summary.",
              )}
            </StatusMessage>
          </Card>
        ) : null}
        {pipelineQuery.data ? (
          <Card title="Pipeline summary" maxWidth={720}>
            <View
              accessibilityLabel="Pipeline summary"
              style={{ gap: spacing.sm }}
            >
              {pipelineQuery.data.length === 0 ? (
                <Text style={{ color: colors.textMuted }}>
                  No pipeline totals yet.
                </Text>
              ) : (
                pipelineQuery.data.map((row) => (
                  <Text
                    key={row.stage}
                    selectable
                    style={{ color: colors.text }}
                  >
                    {stageLabel(row.stage)}: {row.count} · {row.totalValue}
                  </Text>
                ))
              )}
            </View>
          </Card>
        ) : null}

        {notesDealId && canUpdate ? (
          <DealNotesEditor
            dealId={notesDealId}
            onSaved={() => {
              void queryClient.invalidateQueries({
                queryKey: dealDetailQueryKey(notesDealId),
              });
            }}
            onClose={() => setNotesDealId(null)}
          />
        ) : null}

        {stageMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(
              stageMutation.error,
              "We could not update the deal stage.",
            )}
          </StatusMessage>
        ) : null}

        {dealsQuery.isPending ? <LoadingState label="Loading deals…" /> : null}

        {dealsQuery.isError ? (
          <Card title="Deals unavailable">
            <StatusMessage tone="error">
              {errorMessage(dealsQuery.error, "We could not load deals.")}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry deals"
              pending={dealsQuery.isFetching}
              onPress={() => {
                void dealsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {dealsQuery.data ? (
          <View
            accessibilityLabel="Deal pipeline board"
            style={{ gap: spacing.lg }}
          >
            {stageBuckets.map(({ stage, deals }) => (
              <Card
                key={stage}
                title={`${stageLabel(stage)} (${deals.length})`}
                maxWidth={720}
              >
                <View style={{ gap: spacing.md }}>
                  {deals.length === 0 ? (
                    <Text style={{ color: colors.textMuted }}>No deals</Text>
                  ) : (
                    deals.map((deal) => (
                      <DealKanbanCard
                        key={deal.id}
                        deal={deal}
                        canUpdate={canUpdate}
                        pending={movingDealId === deal.id}
                        onMove={(nextStage) => {
                          stageMutation.mutate({
                            dealId: deal.id,
                            stage: nextStage,
                          });
                        }}
                        onEditNotes={() => setNotesDealId(deal.id)}
                      />
                    ))
                  )}
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
