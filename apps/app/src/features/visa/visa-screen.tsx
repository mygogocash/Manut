import {
  ApiError,
  getVisa,
  getVisaDownloadUrl,
  listVisas,
  visaDetailQueryKey,
  visasQueryKey,
  type VisaRecord,
  type VisaRecordDetail,
  type VisaStatus,
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { visaStatusLabel } from "@/features/visa/visa-status-label";
import { visaTypeLabel } from "@/features/visa/visa-type-label";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadVisa(hasPermission: (code: string) => boolean): boolean {
  return (
    hasPermission("visa:read") ||
    hasPermission("visa:hr-read") ||
    hasPermission("visa:manage")
  );
}

function holderLabel(record: VisaRecord | VisaRecordDetail): string {
  if (record.holderType === "dependent") {
    return (
      record.holderName ??
      `Dependent of ${record.employee.name}`
    );
  }
  return record.employee.name;
}

function VisaRow({
  record,
  onOpen,
}: {
  record: VisaRecord;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${visaTypeLabel(record.visaType)} for ${holderLabel(record)}`}
      onPress={onOpen}
      style={({ pressed }) => ({
        gap: spacing.xs,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: pressed ? colors.canvas : colors.surfaceRaised,
      })}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {visaTypeLabel(record.visaType)} · {visaStatusLabel(record.status)}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {holderLabel(record)}
        {record.entityName ? ` · ${record.entityName}` : ""}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {record.country} · expires {record.expiryDate}
        {record.documentCount > 0
          ? ` · ${record.documentCount} document${record.documentCount === 1 ? "" : "s"}`
          : ""}
      </Text>
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text selectable style={{ color: colors.textMuted }}>
      {label}: {value}
    </Text>
  );
}

function VisaDetailModal({
  visaId,
  onClose,
}: {
  visaId: string;
  onClose: () => void;
}) {
  const api = useApiClient();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: visaDetailQueryKey(visaId),
    queryFn: ({ signal }) => getVisa(api, visaId, signal),
  });

  const downloadMutation = useMutation({
    mutationFn: (docIndex: number | undefined) =>
      getVisaDownloadUrl(
        api,
        visaId,
        docIndex === undefined ? {} : { docIndex },
      ),
    onSuccess: async (file) => {
      setDownloadError(null);
      await Linking.openURL(file.url);
    },
    onError: (error) => {
      setDownloadError(
        errorMessage(error, "We could not open that document."),
      );
    },
  });

  const detail = detailQuery.data;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          gap: spacing.lg,
          padding: spacing.xxl,
        }}
      >
        <View style={{ width: "100%", maxWidth: 560, gap: spacing.lg }}>
          {detailQuery.isLoading ? (
            <LoadingState label="Loading visa…" />
          ) : null}
          {detailQuery.isError ? (
            <Card title="Unable to load visa">
              <StatusMessage tone="error">
                {errorMessage(
                  detailQuery.error,
                  "We could not load this visa record.",
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
            <Card
              title={visaTypeLabel(detail.visaType)}
              description={visaStatusLabel(detail.status)}
            >
              <View style={{ gap: spacing.sm }}>
                <DetailRow label="Holder" value={holderLabel(detail)} />
                {detail.holderType === "dependent" &&
                detail.holderRelationship ? (
                  <DetailRow
                    label="Relationship"
                    value={detail.holderRelationship}
                  />
                ) : null}
                <DetailRow label="Country" value={detail.country} />
                {detail.nationality ? (
                  <DetailRow label="Nationality" value={detail.nationality} />
                ) : null}
                {detail.issueDate ? (
                  <DetailRow label="Issued" value={detail.issueDate} />
                ) : null}
                <DetailRow label="Expires" value={detail.expiryDate} />
                {detail.workPermitExpiryDate ? (
                  <DetailRow
                    label="Work permit expires"
                    value={detail.workPermitExpiryDate}
                  />
                ) : null}
                {detail.entityName ? (
                  <DetailRow label="Entity" value={detail.entityName} />
                ) : null}
                <DetailRow
                  label="Employee"
                  value={detail.employee.email ?? detail.employee.name}
                />

                {detail.documents.map((doc, index) => (
                  <Button
                    key={`${doc.name}-${index}`}
                    label={`Open ${doc.name}`}
                    pendingLabel="Opening…"
                    accessibilityLabel={`Open document ${doc.name}`}
                    pending={
                      downloadMutation.isPending &&
                      downloadMutation.variables === index
                    }
                    onPress={() => downloadMutation.mutate(index)}
                  />
                ))}

                {detail.documents.length === 0 && detail.hasLegacyDocument ? (
                  <Button
                    label="Open document"
                    pendingLabel="Opening…"
                    accessibilityLabel="Open visa document"
                    pending={
                      downloadMutation.isPending &&
                      downloadMutation.variables === undefined
                    }
                    onPress={() => downloadMutation.mutate(undefined)}
                  />
                ) : null}

                {detail.documents.length === 0 &&
                !detail.hasLegacyDocument ? (
                  <Text style={{ color: colors.textMuted }}>
                    No documents attached.
                  </Text>
                ) : null}

                {downloadError ? (
                  <StatusMessage tone="error">{downloadError}</StatusMessage>
                ) : null}

                <Button
                  label="Close"
                  pendingLabel="Closing…"
                  accessibilityLabel="Close visa detail"
                  onPress={onClose}
                />
              </View>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </Modal>
  );
}

const STATUS_FILTERS: Array<"all" | VisaStatus> = [
  "all",
  "active",
  "expired",
  "pending",
  "processing",
];

export function VisaScreen() {
  const api = useApiClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const allowed = canReadVisa(hasPermission);
  const canManageVisa = hasPermission("visa:manage");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | VisaStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = {
    page,
    limit: 20,
    ...(statusFilter === "all" ? {} : { status: statusFilter }),
  };

  const listQuery = useQuery({
    queryKey: visasQueryKey(params),
    queryFn: ({ signal }) => listVisas(api, params, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          padding: spacing.xxl,
        }}
      >
        <StatusMessage tone="error">
          You do not have permission to view visas.
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
            title="Visas"
            description="Your visa records and expiry dates"
          >
            <Text style={{ color: colors.textMuted }}>
              Read-only tracker. Imports and 90-day residence notifications stay
              later.
            </Text>
            {canManageVisa ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                <Button
                  label="Knowledge base"
                  pendingLabel="Opening…"
                  accessibilityLabel="Open visa knowledge base"
                  onPress={() => {
                    router.push("/visa/knowledge-base");
                  }}
                />
                <Button
                  label="Checklist templates"
                  pendingLabel="Opening…"
                  accessibilityLabel="Open visa checklist templates"
                  onPress={() => {
                    router.push("/visa/checklist-templates");
                  }}
                />
              </View>
            ) : null}
          </Card>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            {STATUS_FILTERS.map((status) => {
              const selected = statusFilter === status;
              const label =
                status === "all" ? "All" : visaStatusLabel(status);
              return (
                <Pressable
                  key={status}
                  accessibilityRole="radio"
                  accessibilityLabel={`Filter ${label}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setPage(1);
                    setStatusFilter(status);
                  }}
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

          {listQuery.isLoading ? (
            <LoadingState label="Loading visas…" />
          ) : null}
          {listQuery.isError ? (
            <StatusMessage tone="error">
              {errorMessage(
                listQuery.error,
                "We could not load visa records.",
              )}
            </StatusMessage>
          ) : null}

          {listQuery.data?.data.length ? (
            <View style={{ gap: spacing.md }}>
              {listQuery.data.data.map((record) => (
                <VisaRow
                  key={record.id}
                  record={record}
                  onOpen={() => setSelectedId(record.id)}
                />
              ))}
            </View>
          ) : null}

          {listQuery.isSuccess && listQuery.data.data.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>
              No visa records to show.
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

      {selectedId ? (
        <VisaDetailModal
          visaId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  );
}
