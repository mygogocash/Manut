export interface ToolUseTrace {
  id: string;
  name: string;
  summary: string;
  status: "running" | "done" | "error";
}

export interface LocalMessageAttachment {
  id: string;
  name: string;
  kind: "image" | "document" | "video";
  mimeType: string;
  size: number;
  status: "ready" | "processing" | "failed";
}

export interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  pending?: boolean;
  /** Tool calls the assistant made while producing this reply, in order. */
  toolUses?: ToolUseTrace[];
  /** Files the user attached to this message. */
  attachments?: LocalMessageAttachment[];
}

export function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
