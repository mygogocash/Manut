"use client";

import { Loader2, Paperclip, Send, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getMessagesRealtimeSocket,
  socketSignalTyping,
} from "@/components/messages/message-stream";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Message } from "@/services/message.service";
import * as messageService from "@/services/message.service";
import { uploadFile } from "@/services/upload.service";

interface PendingAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
}

const MAX_ATTACHMENTS = 20;

export function MessageInput({
  channelId,
  currentUser,
  typing,
  currentUserId,
  onSent,
  disabled = false,
}: {
  channelId: string;
  currentUser: { id: string; name: string; avatarUrl: string | null };
  typing: Record<string, { userName: string; until: number }>;
  currentUserId: string;
  onSent: (msg: Message) => void;
  disabled?: boolean;
}) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSignalAt = useRef(0);

  const typingText = useMemo(() => {
    const now = Date.now();
    const names = Object.entries(typing)
      .filter(([uid, entry]) => uid !== currentUserId && entry.until > now)
      .map(([, entry]) => entry.userName);

    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    }
    return `${names[0]} and ${names.length - 1} others are typing...`;
  }, [typing, currentUserId]);

  const fireTypingSignal = () => {
    const now = Date.now();
    if (now - lastTypingSignalAt.current < 3000) return;
    lastTypingSignalAt.current = now;
    socketSignalTyping(channelId);
  };

  const canSubmit =
    !disabled &&
    !uploading &&
    (content.trim().length > 0 || attachments.length > 0);

  const handleSend = () => {
    if (!canSubmit) return;

    const trimmed = content.trim();
    const attIds = attachments.map((a) => a.id);
    const now = new Date().toISOString();

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      channelId,
      authorId: currentUser.id,
      content: trimmed,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
      author: {
        id: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
      },
      attachments: attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        originalName: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        path: "",
        bucket: null,
      })),
    };

    onSent(optimisticMsg);
    setContent("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const socket = getMessagesRealtimeSocket();
    if (socket.connected) {
      socket.emit("message:send", {
        channelId,
        content: trimmed,
        attachmentIds: attIds,
      });
    } else {
      messageService
        .sendMessage(channelId, {
          content: trimmed,
          attachmentIds: attIds,
        })
        .catch(() => {
          toast.error("Failed to send message");
        });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (files.length > remaining) {
      toast.error(`Maximum ${MAX_ATTACHMENTS} attachments per message`);
      return;
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map((file) =>
          uploadFile(file, { bucket: "uploads", purpose: "message" }),
        ),
      );
      setAttachments((prev) => [
        ...prev,
        ...uploaded.map((u) => ({
          id: u.id,
          filename: u.originalName,
          size: u.size,
          mimeType: u.mimeType,
        })),
      ]);
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="shrink-0">
      {/* Typing indicator - fixed height to prevent layout shift */}
      <div className="h-5 px-5">
        {typingText && (
          <span className="text-muted-foreground text-[11px] italic">
            {typingText}
          </span>
        )}
      </div>

      {/* Composer */}
      <div className="px-5 pb-4">
        <div
          className={`
            bg-background rounded-lg border shadow-sm transition-shadow
            focus-within:border-muted-foreground/40 focus-within:shadow-md
          `}
        >
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className={`
                    bg-accent text-foreground flex items-center gap-1.5
                    rounded-md px-2 py-1 text-[11px]
                  `}
                >
                  <Paperclip size={11} className="text-muted-foreground" />
                  <span className="max-w-[160px] truncate">{att.filename}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className={`
                      text-muted-foreground
                      hover:text-foreground
                    `}
                    aria-label={`Remove ${att.filename}`}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-0.5 px-1.5 py-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={`
                text-muted-foreground size-8 shrink-0 rounded-md
                hover:bg-accent hover:text-foreground
              `}
              disabled={disabled || uploading}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Paperclip size={16} />
              )}
            </Button>

            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (e.target.value.length > 0) fireTypingSignal();
              }}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={
                disabled
                  ? "You do not have permission to send messages."
                  : "Type a message..."
              }
              rows={1}
              disabled={disabled}
              className={cn(
                `
                  flex-1 resize-none border-0 bg-transparent px-2 py-1.5
                  text-[13px] leading-relaxed shadow-none
                  focus-visible:ring-0
                `,
                disabled && "cursor-not-allowed opacity-60",
              )}
              style={{ maxHeight: 120 }}
            />

            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "size-8 shrink-0 rounded-md transition-colors",
                canSubmit
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground/40",
              )}
              disabled={!canSubmit}
              onClick={handleSend}
            >
              <Send size={15} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
