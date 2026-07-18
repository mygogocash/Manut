import {
  ApiError,
  getPublicSigningRequest,
  publicSigningQueryKey,
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
import { Linking, ScrollView, Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function isTerminalStatus(status: string): boolean {
  return (
    status === "signed" || status === "declined" || status === "cancelled"
  );
}

export function PublicSignScreen({ token }: { token: string }) {
  const api = useApiClient();

  const requestQuery = useQuery({
    queryKey: publicSigningQueryKey(token),
    queryFn: ({ signal }) => getPublicSigningRequest(api, token, signal),
    enabled: token.length > 0,
    retry: false,
  });

  if (!token) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          padding: spacing.xxl,
          backgroundColor: colors.canvas,
        }}
      >
        <View style={{ width: "100%", maxWidth: 560 }}>
          <Card title="Signing link">
            <StatusMessage tone="error">Missing signing token.</StatusMessage>
          </Card>
        </View>
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
      <View style={{ width: "100%", maxWidth: 560, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text
            selectable
            accessibilityRole="header"
            style={{ fontSize: 30, fontWeight: "700", color: colors.text }}
          >
            Document signing
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Public token access via /api/legal-public/sign. Submit and decline
            actions remain deferred for this foundation slice.
          </Text>
        </View>

        {requestQuery.isPending ? (
          <LoadingState label="Loading signing request…" />
        ) : null}

        {requestQuery.isError ? (
          <Card title="Signing unavailable">
            <StatusMessage tone="error">
              {errorMessage(
                requestQuery.error,
                "We could not load this signing request.",
              )}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry signing request"
              pending={requestQuery.isFetching}
              onPress={() => {
                void requestQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {requestQuery.data ? (
          <Card
            title={requestQuery.data.document.title}
            description={`Status: ${requestQuery.data.signature.status}`}
          >
            <Text selectable style={{ color: colors.textMuted }}>
              Signer: {requestQuery.data.signature.signerName}
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              Email: {requestQuery.data.signature.signerEmail}
            </Text>
            {requestQuery.data.signature.inviteMessage ? (
              <Text selectable style={{ color: colors.text }}>
                {requestQuery.data.signature.inviteMessage}
              </Text>
            ) : null}
            {requestQuery.data.signature.expiresAt ? (
              <Text selectable style={{ color: colors.textMuted }}>
                Expires: {requestQuery.data.signature.expiresAt}
              </Text>
            ) : null}
            {isTerminalStatus(requestQuery.data.signature.status) ? (
              <StatusMessage>
                {`This signing request is already ${requestQuery.data.signature.status}.`}
              </StatusMessage>
            ) : null}
            {requestQuery.data.document.fileUrl ? (
              <Button
                label="Open document"
                pendingLabel="Opening…"
                accessibilityLabel="Open signing document"
                onPress={() => {
                  const url = requestQuery.data?.document.fileUrl;
                  if (url) void Linking.openURL(url);
                }}
              />
            ) : (
              <Text selectable style={{ color: colors.textMuted }}>
                Document preview is not available for this status.
              </Text>
            )}
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
