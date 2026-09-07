import { MessageSquarePlus, Send, Sparkles, Square, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { EmptyState } from "@/components/empty-state";
import { PageScreen } from "@/components/page-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { TABLET_MIN, useViewportWidth } from "@/hooks/use-viewport-width";
import {
  confirmAriaAction,
  deleteConversation,
  extractChatActions,
  getConversation,
  listConversations,
  streamAriaChat,
  type AriaConversation,
  type AriaMessage,
  type ChatAction,
  type ToolUseTrace,
} from "@/lib/aria-chat";
import { ApiError } from "@/lib/api-client";
import { ASSISTANT_DISPLAY_NAME, BRAND } from "@/lib/brand";
import { MANUT_AI_GREETING, MANUT_AI_PRESETS } from "@/lib/manut-ai-presets";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";

type LocalMessage = AriaMessage & {
  pending?: boolean;
  toolUses?: ToolUseTrace[];
  error?: string;
};

function MessageBubble({
  message,
  onAction,
  onConfirm,
  confirming,
}: {
  message: LocalMessage;
  onAction: (prompt: string) => void;
  onConfirm: (token: string) => void;
  confirming: boolean;
}) {
  const isUser = message.role === "user";
  const { display, actions, confirm } = extractChatActions(message.content);

  return (
    <View className={cn("mb-3 max-w-[92%]", isUser ? "self-end" : "self-start")}>
      <View
        className={cn(
          "rounded-2xl px-3.5 py-2.5",
          isUser ? "rounded-br-md bg-primary" : "rounded-bl-md border border-border bg-card",
        )}
      >
        {message.toolUses && message.toolUses.length > 0 ? (
          <View className="mb-2 gap-1.5">
            {message.toolUses.map((t) => (
              <View
                key={t.id}
                className="flex-row items-center gap-2 rounded-lg bg-intelligence-50 px-2.5 py-1.5"
              >
                {t.status === "running" ? (
                  <ActivityIndicator size="small" color={BRAND.intelligence} />
                ) : (
                  <Sparkles size={12} color={BRAND.intelligence} />
                )}
                <Text className="flex-1 text-[12px] text-intelligence-900" numberOfLines={2}>
                  {t.summary || t.name}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {display ? (
          <Text
            className={cn(
              "text-[14px] leading-5",
              isUser ? "text-primary-foreground" : "text-foreground",
            )}
          >
            {display}
          </Text>
        ) : message.pending ? (
          <ActivityIndicator color={isUser ? BRAND.paper : BRAND.intelligence} />
        ) : null}
        {message.error ? (
          <Text className="mt-1 text-[13px] text-destructive">{message.error}</Text>
        ) : null}
      </View>
      {!isUser && actions.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap gap-2">
          {actions.map((a: ChatAction) => (
            <Button key={`${a.label}-${a.prompt}`} size="sm" variant="outline" onPress={() => onAction(a.prompt)}>
              <Text>{a.label}</Text>
            </Button>
          ))}
        </View>
      ) : null}
      {!isUser && confirm ? (
        <View className="mt-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <Text className="text-[13px] leading-5 text-foreground">{confirm.summary}</Text>
          <Button
            size="sm"
            variant="ai"
            className="mt-2 self-start"
            disabled={confirming}
            onPress={() => onConfirm(confirm.token)}
          >
            <Text>{confirming ? "Confirming…" : "Confirm"}</Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

export default function ManutAiPage() {
  const canUse = useAuth((s) => s.hasPermission("aria:use"));
  const compact = useViewportWidth() < TABLET_MIN;

  const [conversations, setConversations] = useState<AriaConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(!compact);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const rows = await listConversations();
      setConversations(rows);
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!canUse) {
      setLoadingList(false);
      return;
    }
    void refreshConversations();
    return () => {
      abortRef.current?.abort();
    };
  }, [canUse, refreshConversations]);

  useEffect(() => {
    setHistoryOpen(!compact);
  }, [compact]);

  const startNew = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setInput("");
    if (compact) setHistoryOpen(false);
  }, [compact]);

  const loadConversation = useCallback(
    async (id: string) => {
      setActiveId(id);
      setMessages([]);
      setInput("");
      if (compact) setHistoryOpen(false);
      try {
        const convo = await getConversation(id);
        setMessages(convo.messages.map((m) => ({ ...m, pending: false })));
        scrollToBottom();
      } catch (e) {
        setActiveId(null);
        setListError(e instanceof Error ? e.message : "Failed to load conversation");
      }
    },
    [compact, scrollToBottom],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setMessages((prev) =>
      prev.map((m) => (m.pending ? { ...m, pending: false, content: m.content || "(Stopped)" } : m)),
    );
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteConversation(deleteId);
      setConversations((prev) => prev.filter((c) => c.id !== deleteId));
      if (activeId === deleteId) {
        setActiveId(null);
        setMessages([]);
      }
      setDeleteId(null);
      toast("Conversation deleted", "success");
    } catch {
      setListError("Failed to delete conversation");
    } finally {
      setDeleting(false);
    }
  }, [activeId, deleteId]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending || !canUse) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const tempUserId = `local-user-${Date.now()}`;
      const pendingAssistantId = `local-assistant-${Date.now()}`;
      const wasNewChat = !activeId;

      setInput("");
      setSending(true);
      setMessages((prev) => [
        ...prev,
        {
          id: tempUserId,
          conversationId: activeId ?? "pending",
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
        },
        {
          id: pendingAssistantId,
          conversationId: activeId ?? "pending",
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          pending: true,
          toolUses: [],
        },
      ]);
      scrollToBottom();

      try {
        await streamAriaChat(text, {
          conversationId: activeId ?? undefined,
          signal: controller.signal,
          onEvent: (ev) => {
            if (ev.t === "meta") {
              if (wasNewChat) {
                setActiveId(ev.conversationId);
                void refreshConversations();
              }
              return;
            }
            if (ev.t === "delta") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === pendingAssistantId ? { ...m, content: m.content + ev.text, pending: true } : m,
                ),
              );
              scrollToBottom();
              return;
            }
            if (ev.t === "tool_use") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== pendingAssistantId) return m;
                  const existing = m.toolUses ?? [];
                  const idx = existing.findIndex((t) => t.id === ev.id);
                  const next =
                    idx >= 0
                      ? existing.map((t, i) =>
                          i === idx
                            ? { ...t, status: ev.status, summary: ev.summary || t.summary }
                            : t,
                        )
                      : [...existing, { id: ev.id, name: ev.name, summary: ev.summary, status: ev.status }];
                  return { ...m, toolUses: next };
                }),
              );
              scrollToBottom();
              return;
            }
            if (ev.t === "done") {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === ev.message.conversationId
                    ? { ...c, updatedAt: new Date().toISOString() }
                    : c,
                ),
              );
              setMessages((prev) => {
                const pending = prev.find((m) => m.id === pendingAssistantId);
                return prev
                  .filter((m) => m.id !== pendingAssistantId)
                  .concat({
                    ...ev.message,
                    pending: false,
                    toolUses: pending?.toolUses,
                  });
              });
              scrollToBottom();
              return;
            }
            if (ev.t === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === pendingAssistantId
                    ? { ...m, pending: false, error: ev.message, content: m.content || ev.message }
                    : m,
                ),
              );
            }
          },
        });
      } catch (e) {
        if (controller.signal.aborted) return;
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Chat failed";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingAssistantId ? { ...m, pending: false, error: msg, content: m.content || msg } : m,
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [activeId, canUse, refreshConversations, scrollToBottom, sending],
  );

  const onConfirm = useCallback(async (token: string) => {
    setConfirming(true);
    try {
      await confirmAriaAction(token);
      setMessages((prev) => [
        ...prev,
        {
          id: `confirm-${Date.now()}`,
          conversationId: activeId ?? "local",
          role: "assistant",
          content: "Action confirmed.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setConfirming(false);
    }
  }, [activeId]);

  if (!canUse) {
    return (
      <PageScreen title={ASSISTANT_DISPLAY_NAME} subtitle={MANUT_AI_GREETING}>
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          <EmptyState
            heading="Manut AI is not available"
            description="You need the aria:use permission to chat with Manut AI."
          />
        </View>
      </PageScreen>
    );
  }

  const historyPane = (
    <View
      className={cn(
        "border-border bg-card",
        compact
          ? "absolute inset-y-0 left-0 z-20 w-[280px] border-r"
          : "w-[260px] shrink-0 border-r",
      )}
    >
      <View className="flex-row items-center justify-between border-b border-border px-3 py-2.5">
        <Text className="text-[13px] font-semibold text-foreground">History</Text>
        <Button size="icon" variant="ghost" onPress={startNew} accessibilityLabel="New chat">
          <MessageSquarePlus size={18} color={BRAND.ink} />
        </Button>
      </View>
      {loadingList ? (
        <View className="flex-1 items-center justify-center py-8">
          <ActivityIndicator color={BRAND.ink} />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="gap-0.5 p-2">
          {conversations.length === 0 ? (
            <Text className="px-2 py-4 text-[13px] text-muted-foreground">No chats yet</Text>
          ) : (
            conversations.map((c) => {
              const active = c.id === activeId;
              return (
                <View
                  key={c.id}
                  className={cn(
                    "mb-0.5 flex-row items-center rounded-lg",
                    active ? "bg-accent" : undefined,
                  )}
                >
                  <Pressable
                    accessibilityRole="button"
                    className="min-w-0 flex-1 px-2.5 py-2"
                    onPress={() => void loadConversation(c.id)}
                  >
                    <Text className="text-[13px] font-medium text-foreground" numberOfLines={1}>
                      {c.title?.trim() || "Untitled chat"}
                    </Text>
                    <Text className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Delete conversation"
                    className="px-2 py-2"
                    onPress={() => setDeleteId(c.id)}
                  >
                    <Trash2 size={14} color={BRAND.stone700} />
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );

  return (
    <PageScreen
      title={ASSISTANT_DISPLAY_NAME}
      subtitle={MANUT_AI_GREETING}
      scroll={false}
      actions={
        compact ? (
          <Button size="sm" variant="outline" onPress={() => setHistoryOpen((v) => !v)}>
            <Text>{historyOpen ? "Hide" : "History"}</Text>
          </Button>
        ) : (
          <Button size="sm" variant="ai" onPress={startNew}>
            <MessageSquarePlus size={14} color={BRAND.paper} />
            <Text>New chat</Text>
          </Button>
        )
      }
    >
      {listError ? (
        <View className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          <Text className="text-[13px] text-destructive">{listError}</Text>
        </View>
      ) : null}
      <View className="relative min-h-0 flex-1 flex-row overflow-hidden rounded-xl border border-border bg-background">
        {historyOpen ? historyPane : null}
        {compact && historyOpen ? (
          <Pressable
            accessibilityLabel="Close history"
            className="absolute inset-0 z-10 bg-black/20"
            onPress={() => setHistoryOpen(false)}
          />
        ) : null}

        <View className="min-w-0 flex-1">
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerClassName="flex-grow justify-end px-4 py-4"
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <View className="flex-1 items-center justify-center py-10">
                <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-intelligence-50">
                  <Sparkles size={28} color={BRAND.intelligence} />
                </View>
                <Text className="font-display text-[28px] tracking-tight text-foreground">
                  {ASSISTANT_DISPLAY_NAME}
                </Text>
                <Text className="mt-2 max-w-sm text-center text-[14px] leading-5 text-muted-foreground">
                  {MANUT_AI_GREETING}
                </Text>
                <View className="mt-6 w-full max-w-md flex-row flex-wrap justify-center gap-2">
                  {MANUT_AI_PRESETS.map((p) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      disabled={sending}
                      onPress={() => void send(p.prompt)}
                      className="rounded-full border border-border bg-card px-3 py-2"
                    >
                      <Text className="text-[13px] font-medium text-foreground">{p.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  confirming={confirming}
                  onAction={(prompt) => void send(prompt)}
                  onConfirm={(token) => void onConfirm(token)}
                />
              ))
            )}
          </ScrollView>

          <View className="border-t border-border bg-card px-3 py-3">
            {sending ? (
              <View className="mb-2 flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-2">
                  <Badge variant="intelligence">Thinking</Badge>
                  <Text className="text-[12px] text-muted-foreground">Manut AI is working…</Text>
                </View>
                <Button size="sm" variant="outline" onPress={stopStreaming} accessibilityLabel="Stop generating">
                  <Square size={12} color={BRAND.ink} />
                  <Text>Stop</Text>
                </Button>
              </View>
            ) : null}
            <View className="flex-row items-end gap-2">
              <Textarea
                accessibilityLabel="Message Manut AI"
                value={input}
                onChangeText={setInput}
                placeholder="Ask Manut AI…"
                editable={!sending}
                className="max-h-28 min-h-11 flex-1 rounded-xl bg-background"
              />
              <Button
                size="icon"
                variant="ai"
                disabled={sending || !input.trim()}
                onPress={() => void send(input)}
                accessibilityLabel="Send message"
              >
                <Send size={16} color={BRAND.paper} />
              </Button>
            </View>
          </View>
        </View>
      </View>

      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent
          title="Delete conversation?"
          description="This removes the chat from your history. You can’t undo this."
          footer={
            <DialogFooter>
              <Button variant="outline" disabled={deleting} onPress={() => setDeleteId(null)}>
                <Text>Cancel</Text>
              </Button>
              <Button variant="destructive" disabled={deleting} onPress={() => void confirmDelete()}>
                <Text>{deleting ? "Deleting…" : "Delete"}</Text>
              </Button>
            </DialogFooter>
          }
        >
          <Text className="text-[13px] text-muted-foreground">
            {conversations.find((c) => c.id === deleteId)?.title?.trim() || "Untitled chat"}
          </Text>
        </DialogContent>
      </Dialog>
    </PageScreen>
  );
}
