import {
  addTravelAttachments,
  addTravelAttachmentsInputSchema,
  ApiError,
  approveTravelRequest,
  canCancelTravelRequest,
  cancelTravelRequest,
  createTravelRequest,
  createTravelRequestInputSchema,
  getTravelRequests,
  rejectTravelRequest,
  rejectTravelRequestInputSchema,
  TRAVEL_REQUESTS_QUERY_ROOT,
  travelRequestsQueryKey,
  type TravelCategory,
  type TravelRequest,
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
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import { travelCancellationPrompt } from "@/features/travel/travel-cancellation-prompt";
import { useApiClient } from "@/providers/api-client-provider";

type ListMode = "mine" | "inbox";

interface RequestDraft {
  origin: string;
  destination: string;
  purpose: string;
  departureDate: string;
  returnDate: string;
  category: TravelCategory;
}

interface AttachmentDraft {
  name: string;
  url: string;
}

const emptyDraft: RequestDraft = {
  origin: "",
  destination: "",
  purpose: "",
  departureDate: "",
  returnDate: "",
  category: "general",
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatTravelRange(request: TravelRequest): string {
  return `${request.departureDate} – ${request.returnDate}`;
}

function ChoiceOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.borderStrong,
        borderRadius: radii.control,
        backgroundColor: selected
          ? colors.accent
          : pressed
            ? colors.canvas
            : colors.surfaceRaised,
      })}
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
}

function RequestHistoryCard({
  request,
  canRequest,
  confirmingCancel,
  cancelling,
  rejecting,
  approving,
  attaching,
  rejectReason,
  rejectValidation,
  onRejectReasonChange,
  onAskCancel,
  onConfirmCancel,
  onKeepCancel,
  onApprove,
  onAskReject,
  onConfirmReject,
  onKeepReject,
  confirmingReject,
  onOpenAttach,
}: {
  request: TravelRequest;
  canRequest: boolean;
  confirmingCancel: boolean;
  cancelling: boolean;
  rejecting: boolean;
  approving: boolean;
  attaching: boolean;
  rejectReason: string;
  rejectValidation: string | null;
  onRejectReasonChange: (value: string) => void;
  onAskCancel: () => void;
  onConfirmCancel: () => void;
  onKeepCancel: () => void;
  onApprove: () => void;
  onAskReject: () => void;
  onConfirmReject: () => void;
  onKeepReject: () => void;
  confirmingReject: boolean;
  onOpenAttach: () => void;
}) {
  const cancelable = canRequest && canCancelTravelRequest(request.status);
  const actionable = request.viewerCanAct && request.status === "pending";
  return (
    <View
      accessibilityLabel={`${request.requestCode} travel request`}
      style={{
        flexGrow: 1,
        flexBasis: 280,
        gap: spacing.sm,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text selectable style={{ fontWeight: "600", color: colors.text }}>
        {request.requestCode}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {request.employee.name}
      </Text>
      <Text selectable style={{ color: colors.text }}>
        {request.origin ?? "—"} → {request.destination}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {formatTravelRange(request)} · {request.status}
      </Text>
      <Text selectable style={{ color: colors.textMuted }}>
        {request.purpose}
      </Text>

      {actionable ? (
        confirmingReject ? (
          <View style={{ gap: spacing.sm }}>
            <TextField
              label="Reject reason"
              value={rejectReason}
              multiline
              onChangeText={onRejectReasonChange}
            />
            {rejectValidation ? (
              <StatusMessage>{rejectValidation}</StatusMessage>
            ) : null}
            <Button
              label="Confirm reject"
              pendingLabel="Rejecting…"
              accessibilityLabel={`Confirm reject ${request.requestCode}`}
              pending={rejecting}
              onPress={onConfirmReject}
            />
            <Button
              label="Keep pending"
              pendingLabel="Keeping…"
              accessibilityLabel={`Keep pending ${request.requestCode}`}
              disabled={rejecting}
              onPress={onKeepReject}
            />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Button
              label="Approve request"
              pendingLabel="Approving…"
              accessibilityLabel={`Approve ${request.requestCode}`}
              pending={approving}
              onPress={onApprove}
            />
            <Button
              label="Reject request"
              pendingLabel="Opening…"
              accessibilityLabel={`Reject ${request.requestCode}`}
              disabled={approving}
              onPress={onAskReject}
            />
          </View>
        )
      ) : null}

      {cancelable ? (
        confirmingCancel ? (
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={{ color: colors.text }}>
              {travelCancellationPrompt(request)}
            </Text>
            <Button
              label="Confirm cancel"
              pendingLabel="Cancelling…"
              accessibilityLabel={`Confirm cancel ${request.requestCode}`}
              pending={cancelling}
              onPress={onConfirmCancel}
            />
            <Button
              label="Keep request"
              pendingLabel="Keeping…"
              accessibilityLabel={`Keep ${request.requestCode}`}
              disabled={cancelling}
              onPress={onKeepCancel}
            />
          </View>
        ) : (
          <Button
            label="Cancel request"
            pendingLabel="Opening…"
            accessibilityLabel={`Cancel ${request.requestCode}`}
            onPress={onAskCancel}
          />
        )
      ) : null}

      {canRequest ? (
        <Button
          label="Add attachment"
          pendingLabel="Opening…"
          accessibilityLabel={`Add attachment ${request.requestCode}`}
          pending={attaching}
          onPress={onOpenAttach}
        />
      ) : null}
    </View>
  );
}

function TravelRequestDialog({
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
  draft: RequestDraft;
  validationError: string | null;
  submitting: boolean;
  submissionError: string | null;
  onDraftChange: (draft: RequestDraft) => void;
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
        <View style={{ flex: 1, padding: spacing.xxl }}>
          <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
            <Card
              title="Request travel"
              description="Submit a trip for approval. Hotel and visa extras stay later."
              maxWidth={720}
            >
              <View style={{ gap: spacing.md }}>
                <TextField
                  label="Origin"
                  value={draft.origin}
                  placeholder="Bangkok"
                  onChangeText={(origin) =>
                    onDraftChange({ ...draft, origin })
                  }
                />
                <TextField
                  label="Destination"
                  value={draft.destination}
                  placeholder="Singapore"
                  onChangeText={(destination) =>
                    onDraftChange({ ...draft, destination })
                  }
                />
                <TextField
                  label="Purpose"
                  value={draft.purpose}
                  multiline
                  maxLength={1000}
                  style={{ minHeight: 96, textAlignVertical: "top" }}
                  onChangeText={(purpose) =>
                    onDraftChange({ ...draft, purpose })
                  }
                />
                <TextField
                  label="Departure date"
                  value={draft.departureDate}
                  placeholder="2026-08-10"
                  autoCapitalize="none"
                  onChangeText={(departureDate) =>
                    onDraftChange({ ...draft, departureDate })
                  }
                />
                <TextField
                  label="Return date"
                  value={draft.returnDate}
                  placeholder="2026-08-12"
                  autoCapitalize="none"
                  onChangeText={(returnDate) =>
                    onDraftChange({ ...draft, returnDate })
                  }
                />
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.textMuted }}>Category</Text>
                  <ChoiceOption
                    label="General"
                    selected={draft.category === "general"}
                    onPress={() =>
                      onDraftChange({ ...draft, category: "general" })
                    }
                  />
                  <ChoiceOption
                    label="Business / BD"
                    selected={draft.category === "business_or_bd"}
                    onPress={() =>
                      onDraftChange({ ...draft, category: "business_or_bd" })
                    }
                  />
                </View>
                {validationError ? (
                  <StatusMessage>{validationError}</StatusMessage>
                ) : null}
                {submissionError ? (
                  <StatusMessage>{submissionError}</StatusMessage>
                ) : null}
                <View style={{ gap: spacing.sm }}>
                  <Button
                    label="Submit request"
                    pendingLabel="Submitting…"
                    pending={submitting}
                    onPress={onSubmit}
                  />
                  <Button
                    label="Close request dialog"
                    pendingLabel="Closing…"
                    disabled={submitting}
                    onPress={onClose}
                  />
                </View>
              </View>
            </Card>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AttachmentDialog({
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
  draft: AttachmentDraft;
  validationError: string | null;
  submitting: boolean;
  submissionError: string | null;
  onDraftChange: (draft: AttachmentDraft) => void;
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
      <View style={{ flex: 1, padding: spacing.xxl, backgroundColor: colors.canvas }}>
        <Card
          title="Add attachment"
          description="Attach a URL now. Native file upload via R2 lands later."
          maxWidth={720}
        >
          <View style={{ gap: spacing.md }}>
            <TextField
              label="Name"
              value={draft.name}
              onChangeText={(name) => onDraftChange({ ...draft, name })}
            />
            <TextField
              label="URL"
              value={draft.url}
              autoCapitalize="none"
              placeholder="https://"
              onChangeText={(url) => onDraftChange({ ...draft, url })}
            />
            {validationError ? (
              <StatusMessage>{validationError}</StatusMessage>
            ) : null}
            {submissionError ? (
              <StatusMessage>{submissionError}</StatusMessage>
            ) : null}
            <Button
              label="Save attachment"
              pendingLabel="Saving…"
              pending={submitting}
              onPress={onSubmit}
            />
            <Button
              label="Close attachment dialog"
              pendingLabel="Closing…"
              disabled={submitting}
              onPress={onClose}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

export function TravelScreen() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canRequest = hasPermission("travel:request");
  const canBrowseInbox =
    hasPermission("travel:approve") ||
    hasPermission("travel:hr-read") ||
    hasPermission("travel:hr-approve");
  const canViewApprovalChain = hasPermission("travel:hr-settings");
  const employeeId = user?.id;
  const [listMode, setListMode] = useState<ListMode>("mine");
  const [historyPage, setHistoryPage] = useState(1);
  const listParams = useMemo(() => {
    if (!employeeId) return null;
    if (listMode === "inbox") {
      return { page: historyPage, limit: 20, status: "pending" as const };
    }
    return { employeeId, page: historyPage, limit: 20 };
  }, [employeeId, historyPage, listMode]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(
    null,
  );
  const [confirmingRejectId, setConfirmingRejectId] = useState<string | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [rejectValidation, setRejectValidation] = useState<string | null>(
    null,
  );
  const [attachRequestId, setAttachRequestId] = useState<string | null>(null);
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft>({
    name: "",
    url: "",
  });
  const [attachmentValidation, setAttachmentValidation] = useState<
    string | null
  >(null);

  const requestsQuery = useQuery({
    queryKey: listParams
      ? travelRequestsQueryKey(listParams)
      : ([...TRAVEL_REQUESTS_QUERY_ROOT, "unavailable"] as const),
    queryFn: ({ signal }) => {
      if (!listParams) {
        throw new Error("Authenticated travel history requires a user id.");
      }
      return getTravelRequests(api, listParams, signal);
    },
    enabled: !!listParams,
  });

  const requestMutation = useMutation({
    mutationFn: (input: Parameters<typeof createTravelRequest>[1]) =>
      createTravelRequest(api, input),
    onSuccess: () => {
      setRequestOpen(false);
      setDraft(emptyDraft);
      setValidationError(null);
      setSuccessMessage("Travel request submitted.");
      void queryClient.invalidateQueries({
        queryKey: TRAVEL_REQUESTS_QUERY_ROOT,
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => cancelTravelRequest(api, requestId),
    onSuccess: () => {
      setConfirmingCancelId(null);
      setSuccessMessage("Travel request cancelled.");
      void queryClient.invalidateQueries({
        queryKey: TRAVEL_REQUESTS_QUERY_ROOT,
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveTravelRequest(api, requestId),
    onSuccess: () => {
      setSuccessMessage("Travel request approved.");
      void queryClient.invalidateQueries({
        queryKey: TRAVEL_REQUESTS_QUERY_ROOT,
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason: string;
    }) => rejectTravelRequest(api, requestId, { reason }),
    onSuccess: () => {
      setConfirmingRejectId(null);
      setRejectReason("");
      setSuccessMessage("Travel request rejected.");
      void queryClient.invalidateQueries({
        queryKey: TRAVEL_REQUESTS_QUERY_ROOT,
      });
    },
  });

  const attachmentMutation = useMutation({
    mutationFn: ({
      requestId,
      input,
    }: {
      requestId: string;
      input: Parameters<typeof addTravelAttachments>[2];
    }) => addTravelAttachments(api, requestId, input),
    onSuccess: () => {
      setAttachRequestId(null);
      setAttachmentDraft({ name: "", url: "" });
      setAttachmentValidation(null);
      setSuccessMessage("Attachment saved.");
      void queryClient.invalidateQueries({
        queryKey: TRAVEL_REQUESTS_QUERY_ROOT,
      });
    },
  });

  function openRequest() {
    requestMutation.reset();
    cancelMutation.reset();
    setValidationError(null);
    setSuccessMessage(null);
    setDraft(emptyDraft);
    setRequestOpen(true);
  }

  function closeRequest() {
    if (requestMutation.isPending) return;
    setRequestOpen(false);
    setValidationError(null);
    requestMutation.reset();
  }

  function submitRequest() {
    const parsed = createTravelRequestInputSchema.safeParse(draft);
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? "Check the request fields.",
      );
      return;
    }
    setValidationError(null);
    requestMutation.mutate(parsed.data);
  }

  function submitAttachment() {
    if (!attachRequestId) return;
    const parsed = addTravelAttachmentsInputSchema.safeParse({
      attachments: [attachmentDraft],
    });
    if (!parsed.success) {
      setAttachmentValidation(
        parsed.error.issues[0]?.message ?? "Check the attachment fields.",
      );
      return;
    }
    setAttachmentValidation(null);
    attachmentMutation.mutate({
      requestId: attachRequestId,
      input: parsed.data,
    });
  }

  function confirmReject(requestId: string) {
    const parsed = rejectTravelRequestInputSchema.safeParse({
      reason: rejectReason,
    });
    if (!parsed.success) {
      setSuccessMessage(null);
      setRejectValidation(
        parsed.error.issues[0]?.message ?? "Enter a reject reason.",
      );
      return;
    }
    setRejectValidation(null);
    rejectMutation.mutate({ requestId, reason: parsed.data.reason });
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
        <Card title="Travel unavailable">
          <StatusMessage>
            Sign in again to load your travel requests.
          </StatusMessage>
        </Card>
      </View>
    );
  }

  if (requestsQuery.isPending) {
    return <LoadingState label="Loading travel requests…" />;
  }

  if (requestsQuery.isError) {
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
        <Card title="Travel unavailable">
          <StatusMessage>
            {errorMessage(
              requestsQuery.error,
              "We could not load your travel requests.",
            )}
          </StatusMessage>
          <Button
            label="Retry"
            pendingLabel="Retrying…"
            accessibilityLabel="Retry travel"
            pending={requestsQuery.isFetching}
            onPress={() => {
              void requestsQuery.refetch();
            }}
          />
        </Card>
      </View>
    );
  }

  const requests = requestsQuery.data?.data ?? [];

  return (
    <>
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
        <View style={{ width: "100%", maxWidth: 1080, gap: spacing.lg }}>
          <Card
            title="Travel"
            description="Request trips, attach links, and act on pending approvals in your scope."
            maxWidth={1080}
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {canRequest ? (
                <Button
                  label="Request travel"
                  pendingLabel="Opening…"
                  onPress={openRequest}
                />
              ) : null}
              {canViewApprovalChain ? (
                <Button
                  label="Approval chain"
                  pendingLabel="Opening…"
                  accessibilityLabel="Open travel approval chain"
                  onPress={() => {
                    router.push("/travel/approval");
                  }}
                />
              ) : null}
            </View>
            {!canRequest ? (
              <Text selectable style={{ color: colors.textMuted }}>
                Your role can view travel information but cannot submit a
                request.
              </Text>
            ) : null}
          </Card>

          {canBrowseInbox ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              <ChoiceOption
                label="My requests"
                selected={listMode === "mine"}
                onPress={() => {
                  setHistoryPage(1);
                  setListMode("mine");
                }}
              />
              <ChoiceOption
                label="Pending inbox"
                selected={listMode === "inbox"}
                onPress={() => {
                  setHistoryPage(1);
                  setListMode("inbox");
                }}
              />
            </View>
          ) : null}

          {successMessage ? (
            <StatusMessage tone="success">{successMessage}</StatusMessage>
          ) : null}

          {cancelMutation.isError ||
          approveMutation.isError ||
          rejectMutation.isError ||
          attachmentMutation.isError ? (
            <StatusMessage>
              {errorMessage(
                cancelMutation.error ??
                  approveMutation.error ??
                  rejectMutation.error ??
                  attachmentMutation.error,
                "The travel action could not be completed.",
              )}
            </StatusMessage>
          ) : null}

          <Card
            title={listMode === "inbox" ? "Pending inbox" : "My travel requests"}
            description={
              listMode === "inbox"
                ? "Approve or reject when viewerCanAct is true for your step."
                : "Cancel draft/pending, or attach a document URL."
            }
            maxWidth={1080}
          >
            {requests.length === 0 ? (
              <Text selectable style={{ color: colors.textMuted }}>
                {listMode === "inbox"
                  ? "No pending travel requests in your scope."
                  : "You have not submitted any travel requests yet."}
              </Text>
            ) : (
              <View style={{ gap: spacing.lg }}>
                <View
                  accessibilityLabel={
                    listMode === "inbox"
                      ? "Pending travel inbox"
                      : "My travel request history"
                  }
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.lg,
                  }}
                >
                  {requests.map((request) => (
                    <RequestHistoryCard
                      key={request.id}
                      request={request}
                      canRequest={
                        canRequest && request.employee.id === employeeId
                      }
                      confirmingCancel={confirmingCancelId === request.id}
                      cancelling={
                        cancelMutation.isPending &&
                        cancelMutation.variables === request.id
                      }
                      approving={
                        approveMutation.isPending &&
                        approveMutation.variables === request.id
                      }
                      rejecting={
                        rejectMutation.isPending &&
                        rejectMutation.variables?.requestId === request.id
                      }
                      attaching={
                        attachmentMutation.isPending &&
                        attachmentMutation.variables?.requestId === request.id
                      }
                      rejectReason={rejectReason}
                      rejectValidation={
                        confirmingRejectId === request.id
                          ? rejectValidation
                          : null
                      }
                      onRejectReasonChange={(value) => {
                        setRejectValidation(null);
                        setRejectReason(value);
                      }}
                      confirmingReject={confirmingRejectId === request.id}
                      onAskCancel={() => {
                        cancelMutation.reset();
                        setSuccessMessage(null);
                        setConfirmingCancelId(request.id);
                      }}
                      onConfirmCancel={() => cancelMutation.mutate(request.id)}
                      onKeepCancel={() => setConfirmingCancelId(null)}
                      onApprove={() => {
                        approveMutation.reset();
                        setSuccessMessage(null);
                        approveMutation.mutate(request.id);
                      }}
                      onAskReject={() => {
                        rejectMutation.reset();
                        setSuccessMessage(null);
                        setRejectReason("");
                        setRejectValidation(null);
                        setConfirmingRejectId(request.id);
                      }}
                      onConfirmReject={() => confirmReject(request.id)}
                      onKeepReject={() => {
                        setConfirmingRejectId(null);
                        setRejectReason("");
                        setRejectValidation(null);
                      }}
                      onOpenAttach={() => {
                        attachmentMutation.reset();
                        setAttachmentDraft({ name: "", url: "" });
                        setAttachmentValidation(null);
                        setAttachRequestId(request.id);
                      }}
                    />
                  ))}
                </View>
                {requestsQuery.data &&
                requestsQuery.data.meta.totalPages > 1 ? (
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
                      accessibilityLabel="Previous travel history page"
                      disabled={historyPage <= 1 || requestsQuery.isFetching}
                      onPress={() => {
                        setHistoryPage((current) => Math.max(1, current - 1));
                      }}
                    />
                    <Text selectable style={{ color: colors.textMuted }}>
                      Page {requestsQuery.data.meta.page} of{" "}
                      {requestsQuery.data.meta.totalPages}
                    </Text>
                    <Button
                      label="Next page"
                      pendingLabel="Loading…"
                      accessibilityLabel="Next travel history page"
                      disabled={
                        historyPage >= requestsQuery.data.meta.totalPages ||
                        requestsQuery.isFetching
                      }
                      onPress={() => {
                        setHistoryPage((current) => current + 1);
                      }}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      <TravelRequestDialog
        visible={requestOpen}
        draft={draft}
        validationError={validationError}
        submitting={requestMutation.isPending}
        submissionError={
          requestMutation.isError
            ? errorMessage(
                requestMutation.error,
                "The travel request could not be submitted.",
              )
            : null
        }
        onDraftChange={setDraft}
        onClose={closeRequest}
        onSubmit={submitRequest}
      />

      <AttachmentDialog
        visible={!!attachRequestId}
        draft={attachmentDraft}
        validationError={attachmentValidation}
        submitting={attachmentMutation.isPending}
        submissionError={
          attachmentMutation.isError
            ? errorMessage(
                attachmentMutation.error,
                "The attachment could not be saved.",
              )
            : null
        }
        onDraftChange={setAttachmentDraft}
        onClose={() => {
          if (attachmentMutation.isPending) return;
          setAttachRequestId(null);
          setAttachmentValidation(null);
        }}
        onSubmit={submitAttachment}
      />
    </>
  );
}
