import {
  ApiError,
  getAppraisal,
  listAppraisals,
  performanceAppraisalsQueryKey,
  performanceDetailQueryKey,
  type Appraisal,
  type AppraisalStatus,
} from "@manut/app-core";
import {
  Button,
  Card,
  colors,
  LoadingState,
  spacing,
  StatusMessage,
} from "@manut/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { runLockedTransition } from "@/features/directory/transition-lock";
import { useApiClient } from "@/providers/api-client-provider";

const STATUS_FILTERS: Array<{ label: string; value?: AppraisalStatus }> = [
  { label: "All" },
  { label: "Pending", value: "pending" },
  { label: "Self review", value: "self_review" },
  { label: "Manager review", value: "manager_review" },
  { label: "Completed", value: "completed" },
];

function formatStatus(status: AppraisalStatus): string {
  return status.replaceAll("_", " ");
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We could not load performance appraisals.";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text selectable style={{ color: colors.textMuted }}>
      {label}: {value}
    </Text>
  );
}

function AppraisalDetailSheet({
  appraisalId,
  onClose,
}: {
  appraisalId: string;
  onClose: () => void;
}) {
  const api = useApiClient();
  const detailQuery = useQuery({
    queryKey: performanceDetailQueryKey(appraisalId),
    queryFn: ({ signal }) => getAppraisal(api, appraisalId, signal),
  });

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
            <LoadingState label="Loading appraisal…" />
          ) : null}
          {detailQuery.isError ? (
            <Card title="Unable to load appraisal" maxWidth={560}>
              <StatusMessage tone="error">
                {errorMessage(detailQuery.error)}
              </StatusMessage>
              <Button
                label="Close"
                pendingLabel="Closing…"
                onPress={onClose}
              />
            </Card>
          ) : null}
          {detailQuery.data ? (
            <AppraisalDetailCard detail={detailQuery.data} onClose={onClose} />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function AppraisalDetailCard({
  detail,
  onClose,
}: {
  detail: Appraisal;
  onClose: () => void;
}) {
  return (
    <Card
      title={detail.employee.name}
      description={detail.cycle.name}
      maxWidth={560}
    >
      <View style={{ gap: spacing.sm }}>
        <DetailRow label="Status" value={formatStatus(detail.status)} />
        {detail.selfRating != null ? (
          <Text selectable style={{ color: colors.text }}>
            Self rating: {detail.selfRating}
          </Text>
        ) : null}
        {detail.selfComment ? (
          <DetailRow label="Self comment" value={detail.selfComment} />
        ) : null}
        {detail.managerRating != null ? (
          <DetailRow
            label="Manager rating"
            value={String(detail.managerRating)}
          />
        ) : null}
        {detail.finalRating != null ? (
          <DetailRow label="Final rating" value={String(detail.finalRating)} />
        ) : null}
        {detail.manager ? (
          <DetailRow label="Manager" value={detail.manager.name} />
        ) : null}
        {detail.goals.length > 0 ? (
          <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            <Text
              selectable
              style={{ color: colors.textStrong, fontWeight: "700" }}
            >
              Goals
            </Text>
            {detail.goals.map((goal) => (
              <Text
                key={goal.id}
                selectable
                style={{ color: colors.textMuted }}
              >
                {goal.title}
                {goal.selfScore != null ? ` · self ${goal.selfScore}` : ""}
                {` · ${goal.status.replaceAll("_", " ")}`}
              </Text>
            ))}
          </View>
        ) : (
          <Text selectable style={{ color: colors.textMuted }}>
            No goals on this appraisal.
          </Text>
        )}
        <Button
          label="Close"
          pendingLabel="Closing…"
          accessibilityLabel="Close appraisal detail"
          onPress={onClose}
        />
      </View>
    </Card>
  );
}

function AppraisalCard({
  appraisal,
  onOpen,
}: {
  appraisal: Appraisal;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${appraisal.employee.name} appraisal for ${appraisal.cycle.name}`}
      onPress={onOpen}
    >
      <Card
        title={appraisal.employee.name}
        description={appraisal.cycle.name}
      >
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.textMuted }}>
            {formatStatus(appraisal.status)}
          </Text>
          {appraisal.employee.department ? (
            <Text selectable style={{ color: colors.textMuted }}>
              Department: {appraisal.employee.department}
            </Text>
          ) : null}
          {appraisal.manager ? (
            <Text selectable style={{ color: colors.textMuted }}>
              Manager: {appraisal.manager.name}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function PerformanceScreen() {
  const api = useApiClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AppraisalStatus | undefined>();
  const [selectedAppraisalId, setSelectedAppraisalId] = useState<string | null>(
    null,
  );
  const transitionRef = useRef(false);
  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(status ? { status } : {}),
    }),
    [page, status],
  );
  const appraisalsQuery = useQuery({
    queryKey: performanceAppraisalsQueryKey(params),
    queryFn: ({ signal }) =>
      listAppraisals(api, params, signal).finally(() => {
        transitionRef.current = false;
      }),
  });
  const isTransitioning = appraisalsQuery.isFetching;

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
              Performance
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only appraisals for your permission scope. Reviews and goal
              edits stay on dedicated flows until those slices land.
            </Text>
          </View>

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
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.borderStrong,
                    borderRadius: 8,
                    backgroundColor: selected
                      ? colors.accent
                      : colors.surfaceRaised,
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: selected ? colors.onAccent : colors.text,
                      fontWeight: "700",
                    }}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {appraisalsQuery.isPending ? (
            <LoadingState label="Loading appraisals…" />
          ) : null}

          {appraisalsQuery.isError ? (
            <Card title="Unable to load appraisals">
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(appraisalsQuery.error)}
                </StatusMessage>
                <Button
                  label="Retry"
                  pendingLabel="Retrying…"
                  onPress={() => {
                    void appraisalsQuery.refetch();
                  }}
                />
              </View>
            </Card>
          ) : null}

          {appraisalsQuery.data?.data.length === 0 ? (
            <Card title="No appraisals">
              <Text selectable style={{ color: colors.textMuted }}>
                No appraisals match this filter for your access scope.
              </Text>
            </Card>
          ) : null}

          {appraisalsQuery.data?.data.map((item) => (
            <AppraisalCard
              key={item.id}
              appraisal={item}
              onOpen={() => setSelectedAppraisalId(item.id)}
            />
          ))}

          {appraisalsQuery.data ? (
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
                disabled={page <= 1 || isTransitioning}
                onPress={() => {
                  startTransition(() => setPage((current) => current - 1));
                }}
              />
              <Text selectable style={{ color: colors.textMuted }}>
                Page {appraisalsQuery.data.meta.page} of{" "}
                {Math.max(appraisalsQuery.data.meta.totalPages, 1)}
              </Text>
              <Button
                label="Next page"
                pendingLabel="Loading…"
                disabled={
                  page >= appraisalsQuery.data.meta.totalPages ||
                  isTransitioning
                }
                onPress={() => {
                  startTransition(() => setPage((current) => current + 1));
                }}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {selectedAppraisalId ? (
        <AppraisalDetailSheet
          appraisalId={selectedAppraisalId}
          onClose={() => setSelectedAppraisalId(null)}
        />
      ) : null}
    </>
  );
}
