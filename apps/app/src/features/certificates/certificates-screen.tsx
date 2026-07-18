import {
  ApiError,
  certificatesQueryKey,
  listCertificates,
  type Certificate,
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
import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function canReadCertificates(
  hasPermission: (code: string) => boolean,
): boolean {
  return (
    hasPermission("certificate:read") || hasPermission("certificate:manage")
  );
}

function CertificateRow({ certificate }: { certificate: Certificate }) {
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
        {certificate.title}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {certificate.recipientName} · {certificate.type} · {certificate.status}
        {certificate.issuedAt
          ? ` · Issued ${certificate.issuedAt.slice(0, 10)}`
          : ""}
      </Text>
    </View>
  );
}

export function CertificatesScreen() {
  const api = useApiClient();
  const { hasPermission } = useAuth();
  const allowed = canReadCertificates(hasPermission);

  const certificatesQuery = useQuery({
    queryKey: certificatesQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) =>
      listCertificates(api, { page: 1, limit: 20 }, signal),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Card title="Certificates" maxWidth={720}>
          <StatusMessage tone="error">
            You do not have permission to view certificates.
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
        <Card title="Certificates" maxWidth={720}>
          <View style={{ gap: spacing.md }}>
            <Text selectable style={{ color: colors.textMuted }}>
              Read-only certificate list. Issue and download remain deferred.
            </Text>
            {certificatesQuery.isLoading ? (
              <LoadingState label="Loading certificates…" />
            ) : null}
            {certificatesQuery.isError ? (
              <View style={{ gap: spacing.md }}>
                <StatusMessage tone="error">
                  {errorMessage(
                    certificatesQuery.error,
                    "Unable to load certificates.",
                  )}
                </StatusMessage>
                <Button
                  label="Retry"
      pendingLabel="Working…"
                  onPress={() => void certificatesQuery.refetch()}
                />
              </View>
            ) : null}
            {certificatesQuery.data?.data.length === 0 ? (
              <StatusMessage tone="warning">No certificates found.</StatusMessage>
            ) : null}
            {certificatesQuery.data?.data.map((certificate) => (
              <CertificateRow
                key={certificate.id}
                certificate={certificate}
              />
            ))}
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
