import { ApiError, api, apiRequest } from "@/lib/api-client";

export interface AriaConversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface AriaMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AriaConversationWithMessages extends AriaConversation {
  messages: AriaMessage[];
}

export type AriaStreamEvent =
  | { t: "meta"; conversationId: string }
  | { t: "delta"; text: string }
  | {
      t: "tool_use";
      id: string;
      name: string;
      status: "running" | "done" | "error";
      summary: string;
    }
  | { t: "done"; message: AriaMessage }
  | { t: "error"; message: string };

export type ToolUseTrace = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  summary: string;
};

export type ChatAction = { label: string; prompt: string };

function isNdjsonContentType(ct: string | null): boolean {
  if (!ct) return false;
  return ct.includes("application/x-ndjson") || ct.includes("application/ndjson");
}

function parseStreamLine(line: string): AriaStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const obj = JSON.parse(trimmed) as Record<string, unknown>;
  const t = obj.t;
  if (t === "meta" && typeof obj.conversationId === "string") {
    return { t: "meta", conversationId: obj.conversationId };
  }
  if (t === "delta" && typeof obj.text === "string") {
    return { t: "delta", text: obj.text };
  }
  if (t === "done" && obj.message && typeof obj.message === "object") {
    const m = obj.message as Record<string, unknown>;
    if (
      typeof m.id === "string" &&
      typeof m.conversationId === "string" &&
      (m.role === "assistant" || m.role === "user") &&
      typeof m.content === "string" &&
      typeof m.createdAt === "string"
    ) {
      return {
        t: "done",
        message: {
          id: m.id,
          conversationId: m.conversationId,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        },
      };
    }
  }
  if (t === "tool_use") {
    if (
      typeof obj.id === "string" &&
      typeof obj.name === "string" &&
      (obj.status === "running" || obj.status === "done" || obj.status === "error") &&
      typeof obj.summary === "string"
    ) {
      return {
        t: "tool_use",
        id: obj.id,
        name: obj.name,
        status: obj.status,
        summary: obj.summary,
      };
    }
  }
  if (t === "error" && typeof obj.message === "string") {
    return { t: "error", message: obj.message };
  }
  return null;
}

export async function listConversations(): Promise<AriaConversation[]> {
  const res = await api.get<{ data: AriaConversation[] }>("/aria/conversations");
  return res.data;
}

export async function getConversation(id: string): Promise<AriaConversationWithMessages> {
  const res = await api.get<{ data: AriaConversationWithMessages }>(`/aria/conversations/${id}`);
  return res.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await apiRequest(`/aria/conversations/${id}`, { method: "DELETE" });
}

export async function confirmAriaAction(token: string): Promise<void> {
  await api.post("/aria/confirm-action", { token });
}

/**
 * POST /aria/chat — NDJSON stream. Web ReadableStream; falls back to full-body
 * text parse when streaming is unavailable (some RN environments).
 */
export async function streamAriaChat(
  message: string,
  opts: {
    conversationId?: string;
    signal?: AbortSignal;
    onEvent: (event: AriaStreamEvent) => void;
  },
): Promise<void> {
  const res = await apiRequest("/aria/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      conversationId: opts.conversationId,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const raw = await res.text();
    let messageText = `HTTP ${res.status}`;
    try {
      const body = JSON.parse(raw) as { error?: { message?: string } };
      messageText = body.error?.message ?? messageText;
    } catch {
      if (raw.trim()) messageText = raw.trim();
    }
    throw new ApiError(res.status, "STREAM_ERROR", messageText);
  }

  if (!isNdjsonContentType(res.headers.get("content-type"))) {
    throw new ApiError(res.status, "STREAM_ERROR", "Expected NDJSON chat stream");
  }

  const reader = res.body?.getReader?.();
  if (!reader) {
    const text = await res.text();
    for (const line of text.split("\n")) {
      const event = parseStreamLine(line);
      if (event) opts.onEvent(event);
    }
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const event = parseStreamLine(line);
      if (event) opts.onEvent(event);
    }
  }
  if (buffer.trim()) {
    const event = parseStreamLine(buffer);
    if (event) opts.onEvent(event);
  }
}

/** Strip interactive fences for plain display; extract action chips. */
export function extractChatActions(content: string): {
  display: string;
  actions: ChatAction[];
  confirm?: { action: string; token: string; summary: string };
} {
  const actions: ChatAction[] = [];
  let confirm: { action: string; token: string; summary: string } | undefined;
  let display = content;

  const fenceRe = /```(aria-actions|aria-confirm)\s*([\s\S]*?)```/gi;
  display = display.replace(fenceRe, (_full, lang: string, body: string) => {
    try {
      const parsed = JSON.parse(body.trim()) as Record<string, unknown>;
      if (lang.toLowerCase() === "aria-actions" && Array.isArray(parsed.actions)) {
        for (const item of parsed.actions) {
          if (
            item &&
            typeof item === "object" &&
            typeof (item as ChatAction).label === "string" &&
            typeof (item as ChatAction).prompt === "string"
          ) {
            actions.push({
              label: (item as ChatAction).label,
              prompt: (item as ChatAction).prompt,
            });
          }
        }
      }
      if (
        lang.toLowerCase() === "aria-confirm" &&
        typeof parsed.token === "string" &&
        typeof parsed.summary === "string" &&
        typeof parsed.action === "string"
      ) {
        confirm = {
          action: parsed.action,
          token: parsed.token,
          summary: parsed.summary,
        };
      }
    } catch {
      // leave fence text if JSON is incomplete mid-stream
      return _full;
    }
    return "";
  });

  display = display.replace(/\n{3,}/g, "\n\n").trim();
  return { display, actions, confirm };
}
