import {
  ApiError,
  createUpload,
  deleteUpload,
  getUploadSignedUrl,
  listUploads,
  UPLOADS_QUERY_ROOT,
  uploadsQueryKey,
  type Upload,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { useApiClient } from "@/providers/api-client-provider";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function pickUploadPayload(): Promise<{
  base64: string;
  originalName: string;
  mimeType: string;
} | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    base64: true,
  });
  if (picked.canceled || picked.assets == null || picked.assets.length === 0) {
    return null;
  }
  const asset = picked.assets[0];
  if (!asset) return null;

  const base64 =
    typeof asset.base64 === "string" && asset.base64.length > 0
      ? asset.base64
      : await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

  return {
    base64,
    originalName: asset.name,
    mimeType: asset.mimeType ?? "application/octet-stream",
  };
}

function FileRow({
  upload,
  opening,
  confirmingDelete,
  deleting,
  onOpen,
  onAskDelete,
  onConfirmDelete,
  onKeep,
}: {
  upload: Upload;
  opening: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  onOpen: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onKeep: () => void;
}) {
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${upload.originalName}`}
        disabled={opening || deleting}
        onPress={onOpen}
        style={{ gap: spacing.xs, opacity: opening ? 0.7 : 1 }}
      >
        <Text selectable style={{ fontWeight: "600", color: colors.text }}>
          {upload.originalName}
        </Text>
        <Text selectable style={{ color: colors.textMuted }}>
          {upload.mimeType} · {formatBytes(upload.size)}
          {upload.purpose ? ` · ${upload.purpose}` : ""}
        </Text>
        <Text selectable style={{ color: colors.accent, fontWeight: "600" }}>
          {opening ? "Opening…" : "Open signed download"}
        </Text>
      </Pressable>

      {confirmingDelete ? (
        <View style={{ gap: spacing.sm }}>
          <StatusMessage tone="warning">
            {`Delete ${upload.originalName}? This cannot be undone.`}
          </StatusMessage>
          <Button
            label="Confirm delete"
            pendingLabel="Deleting…"
            accessibilityLabel={`Confirm delete ${upload.originalName}`}
            pending={deleting}
            onPress={onConfirmDelete}
          />
          <Button
            label="Keep file"
            pendingLabel="Keeping…"
            accessibilityLabel={`Keep ${upload.originalName}`}
            disabled={deleting}
            onPress={onKeep}
          />
        </View>
      ) : (
        <Button
          label="Delete"
          pendingLabel="Deleting…"
          accessibilityLabel={`Delete ${upload.originalName}`}
          disabled={opening || deleting}
          onPress={onAskDelete}
        />
      )}
    </View>
  );
}

export function FilesScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [pickError, setPickError] = useState<string | null>(null);

  const uploadsQuery = useQuery({
    queryKey: uploadsQueryKey({ page: 1, limit: 20 }),
    queryFn: ({ signal }) => listUploads(api, { page: 1, limit: 20 }, signal),
  });

  const openMutation = useMutation({
    mutationFn: (uploadId: string) => getUploadSignedUrl(api, uploadId),
    onSuccess: async (result) => {
      await Linking.openURL(result.url);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (input: {
      base64: string;
      originalName: string;
      mimeType: string;
    }) => createUpload(api, input),
    onSuccess: async () => {
      setPickError(null);
      await queryClient.invalidateQueries({ queryKey: UPLOADS_QUERY_ROOT });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (uploadId: string) => deleteUpload(api, uploadId),
    onSuccess: async () => {
      setConfirmingDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: UPLOADS_QUERY_ROOT });
    },
  });

  async function handleUpload() {
    setPickError(null);
    try {
      const payload = await pickUploadPayload();
      if (!payload) return;
      uploadMutation.mutate(payload);
    } catch (error) {
      setPickError(errorMessage(error, "We could not read that file."));
    }
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
            Files
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            Your uploads with signed download links. Google Drive stays on its
            own surface.
          </Text>
        </View>

        <Button
          label="Upload file"
          pendingLabel="Uploading…"
          accessibilityLabel="Upload file"
          pending={uploadMutation.isPending}
          onPress={() => {
            void handleUpload();
          }}
        />

        {pickError ? (
          <StatusMessage tone="error">{pickError}</StatusMessage>
        ) : null}

        {uploadMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(uploadMutation.error, "We could not upload that file.")}
          </StatusMessage>
        ) : null}

        {deleteMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(
              deleteMutation.error,
              "We could not delete that file.",
            )}
          </StatusMessage>
        ) : null}

        {uploadsQuery.isPending ? (
          <LoadingState label="Loading files…" />
        ) : null}

        {uploadsQuery.isError ? (
          <Card title="Files unavailable">
            <StatusMessage tone="error">
              {errorMessage(uploadsQuery.error, "We could not load files.")}
            </StatusMessage>
            <Button
              label="Retry"
              pendingLabel="Retrying…"
              accessibilityLabel="Retry files"
              pending={uploadsQuery.isFetching}
              onPress={() => {
                void uploadsQuery.refetch();
              }}
            />
          </Card>
        ) : null}

        {openMutation.isError ? (
          <StatusMessage tone="error">
            {errorMessage(
              openMutation.error,
              "We could not open that file.",
            )}
          </StatusMessage>
        ) : null}

        {uploadsQuery.data ? (
          uploadsQuery.data.data.length === 0 ? (
            <Card title="No files">
              <Text selectable style={{ color: colors.textMuted }}>
                You have not uploaded any files yet.
              </Text>
            </Card>
          ) : (
            <View accessibilityLabel="Files" style={{ gap: spacing.md }}>
              {uploadsQuery.data.data.map((upload) => (
                <FileRow
                  key={upload.id}
                  upload={upload}
                  opening={
                    openMutation.isPending &&
                    openMutation.variables === upload.id
                  }
                  confirmingDelete={confirmingDeleteId === upload.id}
                  deleting={
                    deleteMutation.isPending &&
                    deleteMutation.variables === upload.id
                  }
                  onOpen={() => {
                    openMutation.mutate(upload.id);
                  }}
                  onAskDelete={() => {
                    setConfirmingDeleteId(upload.id);
                  }}
                  onConfirmDelete={() => {
                    deleteMutation.mutate(upload.id);
                  }}
                  onKeep={() => {
                    setConfirmingDeleteId(null);
                  }}
                />
              ))}
            </View>
          )
        ) : null}
      </View>
    </ScrollView>
  );
}
