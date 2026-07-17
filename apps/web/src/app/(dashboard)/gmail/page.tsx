"use client";

import {
  AlertOctagon,
  ArrowLeft,
  Clock,
  FileText,
  Forward,
  Inbox,
  Loader2,
  Mail,
  PenSquare,
  RefreshCw,
  Reply,
  ReplyAll,
  RotateCcw,
  Search,
  Send,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GmailComposeDialog } from "@/components/gmail/gmail-compose-dialog";
import {
  buildComposeDraft,
  type ComposeDraft,
  type ComposeMode,
} from "@/components/gmail/gmail-utils";
import { GmailSendScopeBanner } from "@/components/integrations/gmail-send-scope-banner";
import { NotConnectedBanner } from "@/components/integrations/not-connected-banner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  getIntegrationsStatus,
  type GmailFolder,
  type GmailLabel,
  type GmailListItem,
  type GmailMessage,
  listGmail,
  listGmailLabels,
  modifyGmail,
  readGmail,
  trashGmail,
  untrashGmail,
} from "@/services/integrations.service";

function isGoogleNotConnected(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 412 &&
    err.code === "GOOGLE_NOT_CONNECTED"
  );
}

const GMAIL_AUTO_REFRESH_MS = 60_000;

const FOLDERS: Array<{
  id: GmailFolder;
  label: string;
  icon: typeof Inbox;
}> = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "important", label: "Important", icon: AlertOctagon },
  { id: "snoozed", label: "Scheduled", icon: Clock },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "spam", label: "Spam", icon: AlertOctagon },
  { id: "trash", label: "Bin", icon: Trash2 },
];

function senderName(raw: string): string {
  if (!raw) return "—";
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>$/);
  if (m && m[1]) return m[1].trim();
  const at = raw.indexOf("@");
  if (at > 0) return raw.slice(0, at);
  return raw;
}

function formatRowDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatEmailDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HeaderRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="text-foreground break-all">{value}</span>
    </div>
  );
}

// One selector for the active sidebar entry. Discriminated so the
// list-fetch code can pass the right payload to the BE (`folder`
// for system labels, `labelId` for user-defined ones).
type ActiveView =
  | { kind: "folder"; folder: GmailFolder }
  | { kind: "label"; id: string; name: string };

export default function GmailPage() {
  const [view, setView] = useState<ActiveView>({
    kind: "folder",
    folder: "inbox",
  });
  const [userLabels, setUserLabels] = useState<GmailLabel[]>([]);
  const [emails, setEmails] = useState<GmailListItem[]>([]);
  const [rawText, setRawText] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [sendScopeRequired, setSendScopeRequired] = useState(false);
  const [myEmail, setMyEmail] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<GmailMessage | null>(null);
  const [readingEmail, setReadingEmail] = useState(false);
  // Track which labels are on the message being read so the star /
  // trash / spam toolbar reflects current state without a re-fetch.
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [actingOnMessage, setActingOnMessage] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null);

  useEffect(() => {
    void getIntegrationsStatus()
      .then((res) => {
        const g = res.data.google;
        setNotConnected(!g.connected);
        setSendScopeRequired(g.connected === true && g.canSendMail === false);
        setMyEmail(g.accountEmail);
      })
      .catch(() => {});
  }, []);

  // Resolve the current `view` into the payload `listGmail` expects.
  const listTarget = useMemo<GmailFolder | { labelId: string }>(
    () => (view.kind === "folder" ? view.folder : { labelId: view.id }),
    [view],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await listGmail(listTarget);
        setEmails(res.data ?? []);
        setRawText(res.raw);
        setNextPageToken(res.nextPageToken ?? null);
        setNotConnected(false);
      } catch (err) {
        if (isGoogleNotConnected(err)) {
          setNotConnected(true);
        } else if (!silent) {
          const message =
            err instanceof ApiError ? err.message : "Failed to load emails";
          toast.error(message);
        }
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [listTarget],
  );

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await listGmail(listTarget, { pageToken: nextPageToken });
      setEmails((prev) => [...prev, ...(res.data ?? [])]);
      setNextPageToken(res.nextPageToken ?? null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load more emails";
      toast.error(message);
    } finally {
      setLoadingMore(false);
    }
  }, [listTarget, nextPageToken, loadingMore]);

  useEffect(() => {
    if (notConnected) return;
    void load();
  }, [view, notConnected, load]);

  // One-shot fetch of the user's Gmail labels for the sidebar's
  // "Labels" section. Failures are silent — the sidebar just won't
  // show any user labels.
  useEffect(() => {
    if (notConnected) return;
    void listGmailLabels()
      .then((res) => setUserLabels(res.data.user ?? []))
      .catch(() => setUserLabels([]));
  }, [notConnected]);

  useEffect(() => {
    if (notConnected || selectedId) return;
    if (typeof document === "undefined") return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void load({ silent: true });
    };
    const interval = window.setInterval(tick, GMAIL_AUTO_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [notConnected, selectedId, load]);

  const filteredEmails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter((em) => {
      const hay = [em.from, em.sender, em.subject, em.snippet, em.preview]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [emails, search]);

  async function openEmail(id: string) {
    setReadingEmail(true);
    setSelectedId(id);
    setSelectedEmail(null);
    // Seed `selectedLabelIds` from the list row's labelIds so the
    // star / trash toolbar reflects the right state immediately —
    // the read endpoint doesn't currently include labels.
    const listRow = emails.find((e) => e.id === id || e.messageId === id);
    setSelectedLabelIds(listRow?.labelIds ?? []);
    try {
      const res = await readGmail(id);
      const data = res.data;
      setSelectedEmail({
        messageId: data.messageId ?? id,
        threadId: data.threadId ?? "",
        rfcMessageId: data.rfcMessageId ?? "",
        from: data.from ?? "",
        to: data.to ?? "",
        cc: data.cc ?? "",
        subject: data.subject ?? "",
        date: data.date ?? "",
        bodyText: data.bodyText ?? "",
        bodyHtml: data.bodyHtml ?? "",
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load email";
      toast.error(message);
      setSelectedId(null);
    } finally {
      setReadingEmail(false);
    }
  }

  // Toggle Gmail's STARRED label on a single message. Optimistically
  // updates the row's labelIds + the selectedLabelIds when the message
  // is open, then reconciles with whatever the API returned.
  async function toggleStar(messageId: string, currentlyStarred: boolean) {
    setActingOnMessage(true);
    setEmails((prev) =>
      prev.map((row) => {
        const rowId = row.id ?? row.messageId;
        if (rowId !== messageId) return row;
        const labels = row.labelIds ?? [];
        return {
          ...row,
          labelIds: currentlyStarred
            ? labels.filter((l) => l !== "STARRED")
            : [...labels, "STARRED"],
        };
      }),
    );
    if (selectedId === messageId) {
      setSelectedLabelIds((prev) =>
        currentlyStarred
          ? prev.filter((l) => l !== "STARRED")
          : [...prev, "STARRED"],
      );
    }
    try {
      const res = await modifyGmail(messageId, {
        addLabelIds: currentlyStarred ? [] : ["STARRED"],
        removeLabelIds: currentlyStarred ? ["STARRED"] : [],
      });
      setEmails((prev) =>
        prev.map((row) => {
          const rowId = row.id ?? row.messageId;
          if (rowId !== messageId) return row;
          return { ...row, labelIds: res.data.labelIds };
        }),
      );
      if (selectedId === messageId) setSelectedLabelIds(res.data.labelIds);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update star";
      toast.error(message);
      // Roll back the optimistic mutation by reloading the list.
      void load({ silent: true });
    } finally {
      setActingOnMessage(false);
    }
  }

  // Move-to-trash / spam / restore. Each call shrinks the visible list
  // (the message no longer matches the current label) and closes the
  // read pane.
  async function moveMessage(
    messageId: string,
    action: "trash" | "spam" | "untrash" | "unspam",
  ) {
    setActingOnMessage(true);
    try {
      if (action === "trash") {
        await trashGmail(messageId);
      } else if (action === "untrash") {
        await untrashGmail(messageId);
      } else if (action === "spam") {
        await modifyGmail(messageId, {
          addLabelIds: ["SPAM"],
          removeLabelIds: ["INBOX"],
        });
      } else {
        await modifyGmail(messageId, {
          addLabelIds: ["INBOX"],
          removeLabelIds: ["SPAM"],
        });
      }
      toast.success(
        action === "trash"
          ? "Moved to Bin"
          : action === "spam"
            ? "Marked as spam"
            : action === "untrash"
              ? "Restored from Bin"
              : "Marked as not spam",
      );
      setEmails((prev) =>
        prev.filter((row) => (row.id ?? row.messageId) !== messageId),
      );
      if (selectedId === messageId) {
        setSelectedId(null);
        setSelectedEmail(null);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Action failed";
      toast.error(message);
    } finally {
      setActingOnMessage(false);
    }
  }

  function openCompose(mode: ComposeMode = "new", email?: GmailMessage) {
    if (mode === "new" || !email) {
      setComposeDraft({
        mode: "new",
        to: "",
        cc: "",
        subject: "",
        bodyHtml: "",
      });
    } else {
      setComposeDraft(buildComposeDraft(mode, email, myEmail));
    }
    setComposeOpen(true);
  }

  return (
    <div className={`-mx-6 -my-5 flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <div className="shrink-0 space-y-4 px-6 pt-5">
        <PageHeader
          title="Gmail"
          subtitle="Connected via Google · Your Workspace inbox"
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load()}
            disabled={loading || notConnected}
          >
            {loading || refreshing ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-3.5" />
            )}
            Refresh
          </Button>
        </PageHeader>

        {notConnected ? <NotConnectedBanner feature="Gmail" /> : null}
        {!notConnected && sendScopeRequired ? <GmailSendScopeBanner /> : null}
      </div>

      <div
        className={`
          bg-card mx-6 mb-5 flex min-h-0 flex-1 overflow-hidden rounded-lg
          border
        `}
      >
        <aside
          className={`border-border flex w-56 shrink-0 flex-col border-r p-3`}
        >
          <Button
            className="mb-3 justify-start gap-2"
            size="lg"
            onClick={() => openCompose("new")}
            disabled={notConnected || sendScopeRequired}
          >
            <PenSquare className="size-4" />
            Compose
          </Button>
          <nav className="flex flex-col gap-0.5 overflow-y-auto">
            {FOLDERS.map(({ id, label, icon: Icon }) => {
              const active = view.kind === "folder" && view.folder === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setView({ kind: "folder", folder: id });
                    setSelectedId(null);
                    setSelectedEmail(null);
                    setEmails([]);
                    setRawText(undefined);
                  }}
                  className={cn(
                    `
                      flex items-center gap-3 rounded-full px-3 py-2 text-left
                      text-sm transition-colors
                    `,
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                  {active && emails.length > 0 ? (
                    <span
                      className={`
                        text-muted-foreground text-[11px] tabular-nums
                      `}
                    >
                      {emails.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {userLabels.length > 0 ? (
              <>
                <div
                  className={`
                    text-muted-foreground mt-3 px-3 pt-1 pb-1 text-[10px]
                    font-semibold tracking-wider uppercase
                  `}
                >
                  Labels
                </div>
                {userLabels.map((label) => {
                  const active = view.kind === "label" && view.id === label.id;
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => {
                        setView({
                          kind: "label",
                          id: label.id,
                          name: label.name,
                        });
                        setSelectedId(null);
                        setSelectedEmail(null);
                        setEmails([]);
                        setRawText(undefined);
                      }}
                      className={cn(
                        `
                          flex items-center gap-3 rounded-full px-3 py-2
                          text-left text-sm transition-colors
                        `,
                        active
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <Tag className="size-4" />
                      <span className="flex-1 truncate" title={label.name}>
                        {label.name}
                      </span>
                      {label.messagesUnread && label.messagesUnread > 0 ? (
                        <span
                          className={`
                            text-muted-foreground text-[11px] tabular-nums
                          `}
                        >
                          {label.messagesUnread}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </>
            ) : null}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          {selectedId ? (
            <EmailReader
              email={selectedEmail}
              loading={readingEmail}
              labelIds={selectedLabelIds}
              acting={actingOnMessage}
              onBack={() => {
                setSelectedId(null);
                setSelectedEmail(null);
              }}
              onReply={(mode) => {
                if (sendScopeRequired) {
                  toast.error(
                    "Reconnect Google in Settings to enable sending.",
                  );
                  return;
                }
                if (selectedEmail) openCompose(mode, selectedEmail);
              }}
              onToggleStar={() =>
                void toggleStar(
                  selectedId,
                  selectedLabelIds.includes("STARRED"),
                )
              }
              onTrash={() => void moveMessage(selectedId, "trash")}
              onSpam={() => void moveMessage(selectedId, "spam")}
              onUntrash={() => void moveMessage(selectedId, "untrash")}
              onUnspam={() => void moveMessage(selectedId, "unspam")}
              sendDisabled={sendScopeRequired}
            />
          ) : (
            <>
              <div
                className={`
                  border-border bg-background flex items-center gap-2 border-b
                  px-4 py-2.5
                `}
              >
                <div className="relative flex-1">
                  <Search
                    className={`
                      text-muted-foreground pointer-events-none absolute top-1/2
                      left-3 size-3.5 -translate-y-1/2
                    `}
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search mail"
                    className="bg-muted/40 h-9 border-transparent pl-9 text-sm"
                    disabled={notConnected}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                  <div
                    className={`text-muted-foreground py-12 text-center text-sm`}
                  >
                    <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                    Loading emails…
                  </div>
                ) : filteredEmails.length === 0 ? (
                  <div className="text-muted-foreground py-16 text-center">
                    <Mail className="mx-auto mb-3 size-8 opacity-50" />
                    <p className="text-sm">
                      {search
                        ? "No emails match your search"
                        : rawText
                          ? rawText
                          : "No emails to show"}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-border divide-y">
                    {filteredEmails.map((em, i) => {
                      const id = em.id || em.messageId || String(i);
                      const name = senderName(em.from || em.sender || "");
                      const subject = em.subject || "(no subject)";
                      const snippet = em.snippet || em.preview || "";
                      const date = formatRowDate(em.date || "");
                      const labels = em.labelIds ?? [];
                      const isStarred = labels.includes("STARRED");
                      return (
                        <li
                          key={id}
                          className={`
                            hover:bg-muted/40
                            flex w-full items-center gap-3 px-4 py-2.5 text-left
                          `}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleStar(id, isStarred);
                            }}
                            disabled={actingOnMessage}
                            title={isStarred ? "Remove star" : "Star"}
                            className={cn(
                              `
                                hover:bg-muted
                                shrink-0 rounded-full p-0.5 transition-colors
                                outline-none
                              `,
                              isStarred
                                ? "text-amber-500"
                                : "text-muted-foreground/40",
                            )}
                          >
                            <Star
                              className={cn(
                                "size-4",
                                isStarred ? "fill-current" : "",
                              )}
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEmail(id)}
                            className={`
                              focus-visible:bg-muted/60
                              flex min-w-0 flex-1 items-center gap-3 text-left
                              outline-none
                            `}
                          >
                            <span
                              className={`
                                text-foreground w-40 shrink-0 truncate text-sm
                                font-semibold
                              `}
                            >
                              {name}
                            </span>
                            <span
                              className={`
                                flex min-w-0 flex-1 items-baseline gap-1.5
                                text-sm
                              `}
                            >
                              <span className="text-foreground truncate">
                                {subject}
                              </span>
                              {snippet ? (
                                <>
                                  <span
                                    className={`text-muted-foreground shrink-0`}
                                  >
                                    —
                                  </span>
                                  <span
                                    className={`text-muted-foreground truncate`}
                                  >
                                    {snippet}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            <span
                              className={`
                                text-muted-foreground w-20 shrink-0 text-right
                                text-xs tabular-nums
                              `}
                            >
                              {date}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {!loading && filteredEmails.length > 0 && nextPageToken ? (
                  <div className="my-3 flex justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadMore()}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : null}
                      Load more
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>

      <GmailComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        draft={composeDraft}
        onSent={() => {
          toast.success("Email sent");
          if (view.kind === "folder" && view.folder === "sent") {
            void load({ silent: true });
          }
        }}
      />
    </div>
  );
}

function EmailReader({
  email,
  loading,
  labelIds,
  acting,
  onBack,
  onReply,
  onToggleStar,
  onTrash,
  onSpam,
  onUntrash,
  onUnspam,
  sendDisabled,
}: {
  email: GmailMessage | null;
  loading: boolean;
  // Current labels on the message — drives the star fill state +
  // which restore button shows when viewing Trash / Spam.
  labelIds: string[];
  acting: boolean;
  onBack: () => void;
  onReply: (mode: ComposeMode) => void;
  onToggleStar: () => void;
  onTrash: () => void;
  onSpam: () => void;
  onUntrash: () => void;
  onUnspam: () => void;
  sendDisabled?: boolean;
}) {
  const isStarred = labelIds.includes("STARRED");
  const inTrash = labelIds.includes("TRASH");
  const inSpam = labelIds.includes("SPAM");
  return (
    <div className="flex h-full flex-col">
      <div
        className={`
          border-border flex flex-wrap items-center gap-2 border-b px-4 py-2.5
        `}
      >
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-1 size-3.5" />
          Back to list
        </Button>
        {email && !loading ? (
          <div className="ml-auto flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleStar}
              disabled={acting}
              title={isStarred ? "Remove star" : "Star"}
              className={isStarred ? "text-amber-500" : ""}
            >
              <Star
                className={cn("mr-1 size-3.5", isStarred ? "fill-current" : "")}
              />
              {isStarred ? "Starred" : "Star"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReply("reply")}
              disabled={sendDisabled}
            >
              <Reply className="mr-1 size-3.5" />
              Reply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReply("replyAll")}
              disabled={sendDisabled}
            >
              <ReplyAll className="mr-1 size-3.5" />
              Reply all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReply("forward")}
              disabled={sendDisabled}
            >
              <Forward className="mr-1 size-3.5" />
              Forward
            </Button>
            {inTrash ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onUntrash}
                disabled={acting}
              >
                <RotateCcw className="mr-1 size-3.5" />
                Restore
              </Button>
            ) : inSpam ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onUnspam}
                disabled={acting}
              >
                <RotateCcw className="mr-1 size-3.5" />
                Not spam
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSpam}
                  disabled={acting}
                >
                  <AlertOctagon className="mr-1 size-3.5" />
                  Spam
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onTrash}
                  disabled={acting}
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Bin
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {loading || !email ? (
        <div className="text-muted-foreground flex-1 py-10 text-center text-sm">
          <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
          Loading email…
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <h2 className={`text-foreground text-xl leading-tight font-semibold`}>
            {email.subject || "(no subject)"}
          </h2>
          <div className="space-y-1.5 border-b pb-4">
            <HeaderRow label="From" value={email.from} />
            <HeaderRow label="To" value={email.to} />
            <HeaderRow label="Cc" value={email.cc} />
            <HeaderRow label="Date" value={formatEmailDate(email.date)} />
          </div>

          {email.bodyHtml ? (
            <iframe
              title="Email body"
              sandbox=""
              srcDoc={email.bodyHtml}
              className="h-[55vh] w-full rounded border bg-white"
            />
          ) : (
            <pre
              className={`
                text-foreground/90 max-h-[55vh] overflow-auto font-sans text-sm
                leading-relaxed whitespace-pre-wrap
              `}
            >
              {email.bodyText || "(empty)"}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
