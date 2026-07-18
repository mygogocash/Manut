import {
  ApiError,
  createDeal,
  createDealInputSchema,
  DEALS_QUERY_ROOT,
  dealsQueryKey,
  listDeals,
  type Deal,
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

function DealRow({ deal }: { deal: Deal }) {
  return (
    <View
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
        {deal.company}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {deal.stage} · {deal.value}
        {deal.contact ? ` · ${deal.contact}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {deal.owner.name}
        {deal.country ? ` · ${deal.country}` : ""}
      </Text>
    </View>
  );
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
          Creates a lead-stage deal. Pipeline kanban, notes editor, and delete
          remain deferred.
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

export function DealsScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const allowed = canReadDeals(hasPermission);
  const canCreate = canCreateDeals(hasPermission);

  const dealsQuery = useQuery({
    queryKey: dealsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listDeals(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
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
            Deals list with create. Pipeline summary, stage drag, notes, and
            delete remain later.
          </Text>
        </View>

        {canCreate ? (
          <CreateDealForm
            onCreated={() => {
              void queryClient.invalidateQueries({
                queryKey: DEALS_QUERY_ROOT,
              });
            }}
          />
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
          dealsQuery.data.data.length === 0 ? (
            <Card title="No deals">
              <Text selectable style={{ color: colors.textMuted }}>
                No deals are available yet.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Deals" style={{ gap: spacing.md }}>
              {dealsQuery.data.data.map((deal) => (
                <DealRow key={deal.id} deal={deal} />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
