import {
  AlertCircle,
  Bot,
  Check,
  Copy,
  Loader2,
  Pencil,
  RefreshCcw,
  ThumbsDown,
  ThumbsUp,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { formatTime, type LocalMessage } from "@/components/aria/aria-utils";
import { AriaCodeBlock } from "@/components/aria/blocks/aria-code-block";
import { normalizeAssistantMarkdown } from "@/components/aria/markdown-normalize";
import { ThinkingDots } from "@/components/aria/thinking-dots";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { trackAriaFeedback } from "@/lib/events";
import { cn } from "@/lib/utils";
import { submitAriaFeedback } from "@/services/aria.service";

interface MessageBubbleProps {
  message: LocalMessage;
  /** Called when the user saves an edit on their own message. */
  onEdit?: (messageId: string, newContent: string) => void;
  /** Called when the user retries the assistant reply. */
  onRetry?: (assistantMessageId: string) => void;
  /**
   * Fired when the user clicks an inline action chip inside an
   * `aria-actions` block. Wired to the chat page's send pipeline so
   * the chip's `prompt` becomes a new user turn.
   */
  onAction?: (prompt: string) => void;
  /** Disables edit/retry controls while a stream is in flight. */
  disabled?: boolean;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function MessageBubble({
  message,
  onEdit,
  onRetry,
  onAction,
  disabled,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  // Keep the local draft in sync with the bubble content whenever the
  // server-side message changes (e.g. after a retry replaces it).
  useEffect(() => {
    if (!editing) setDraft(message.content);
  }, [message.content, editing]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        const el = draftRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  }, [editing]);

  const [reasonDraft, setReasonDraft] = useState("");
  const [openPopover, setOpenPopover] = useState<"up" | "down" | null>(null);

  // Optimistically set the rating then POST to /aria/feedback. The
  // server persists it into `aria_feedback`. If the call fails we
  // revert + toast — UI stays consistent with the DB.
  const persistFeedback = useCallback(
    async (rating: "up" | "down", reason?: string) => {
      const previous = feedback;
      setFeedback(rating);
      trackAriaFeedback({ rating });
      try {
        await submitAriaFeedback({
          messageId: message.id,
          rating,
          reason: reason?.trim() || undefined,
        });
      } catch {
        setFeedback(previous);
        toast.error("Failed to record feedback");
      }
    },
    [feedback, message.id],
  );

  // Both ratings open a reason popover. Submit persists the rating
  // (with or without text); closing without submit records nothing.
  const handleSubmitFeedback = useCallback(() => {
    const rating = openPopover;
    if (!rating) return;
    const reason = reasonDraft.trim();
    setOpenPopover(null);
    setReasonDraft("");
    void persistFeedback(rating, reason || undefined);
  }, [openPopover, reasonDraft, persistFeedback]);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(message.content);
    toast[ok ? "success" : "error"](ok ? "Copied" : "Copy failed");
  }, [message.content]);

  const handleSaveEdit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.content || !onEdit) {
      setEditing(false);
      setDraft(message.content);
      return;
    }
    setEditing(false);
    onEdit(message.id, trimmed);
  }, [draft, message.content, message.id, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setDraft(message.content);
  }, [message.content]);

  // Inject our `aria-*` fenced-block renderers into react-markdown.
  // Standard inline / fenced blocks fall through to the default
  // `<code>` element; only blocks tagged `language-aria-<kind>` get
  // routed through `AriaCodeBlock`.
  const markdownComponents = useMemo<Components>(
    () => ({
      code: ({ className, children, ...rest }) => (
        <AriaCodeBlock
          className={className}
          onAction={onAction}
          actionsDisabled={disabled || message.pending}
          {...rest}
        >
          {children}
        </AriaCodeBlock>
      ),
    }),
    [onAction, disabled, message.pending],
  );

  return (
    <div className={cn("group flex gap-3", isUser ? "flex-row-reverse" : "")}>
      <Avatar className="mt-0.5 size-7 shrink-0">
        <AvatarFallback
          className={cn(
            "text-[11px] font-semibold",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-linear-to-br from-violet-500 to-indigo-600 text-white",
          )}
        >
          {isUser ? (
            <User className="size-3.5" />
          ) : (
            <Bot className="size-3.5" />
          )}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex max-w-[75%] min-w-0 flex-col gap-1",
          isUser ? "items-end" : "",
        )}
      >
        {!isUser && message.toolUses && message.toolUses.length > 0 ? (
          <div className="flex flex-col gap-1">
            {message.toolUses.map((t) => (
              <div
                key={t.id}
                className={cn(
                  `
                    border-border/60 bg-muted/40 inline-flex items-center
                    gap-1.5 rounded-full border px-2.5 py-1 text-[11px]
                  `,
                  t.status === "error" &&
                    "border-destructive/40 text-destructive",
                )}
              >
                {t.status === "running" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : t.status === "error" ? (
                  <AlertCircle className="size-3" />
                ) : (
                  <Check className="size-3 text-emerald-600" />
                )}
                <Wrench className="size-3 opacity-60" />
                <span className="truncate">{t.summary}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : `
                bg-muted/60 text-foreground border-border/50 rounded-tl-md
                border
              `,
            editing && "w-full max-w-[75%]",
          )}
        >
          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                ref={draftRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleCancelEdit();
                  }
                }}
                rows={Math.min(8, Math.max(2, draft.split("\n").length + 1))}
                className={`
                  bg-background/40 text-foreground min-w-[260px] resize-y
                  text-[13px]
                `}
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  className="h-7 px-2.5 text-xs"
                >
                  <X className="size-3" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={
                    !draft.trim() ||
                    draft.trim() === message.content ||
                    disabled
                  }
                  className="h-7 px-2.5 text-xs"
                >
                  Save & resend
                </Button>
              </div>
            </div>
          ) : message.pending && !message.content.trim() ? (
            <ThinkingDots />
          ) : message.pending ? (
            isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div
                className={cn(
                  `
                    prose prose-sm max-w-none
                    dark:prose-invert
                  `,
                  `
                    [&_pre]:bg-background/50 [&_pre]:rounded-lg [&_pre]:border
                    [&_pre]:p-3
                  `,
                  `
                    [&_code]:bg-background/50 [&_code]:rounded [&_code]:px-1
                    [&_code]:py-0.5 [&_code]:text-[12px]
                  `,
                  `
                    [&_li]:my-0.5
                    [&_ol]:my-1
                    [&_p]:my-1
                    [&_ul]:my-1
                  `,
                  `
                    [&_h1]:text-base
                    [&_h2]:text-sm
                    [&_h3]:text-sm
                  `,
                  "[&_table]:text-xs",
                )}
              >
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {normalizeAssistantMarkdown(message.content)}
                </Markdown>
              </div>
            )
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div
              className={cn(
                `
                  prose prose-sm max-w-none
                  dark:prose-invert
                `,
                `
                  [&_pre]:bg-background/50 [&_pre]:rounded-lg [&_pre]:border
                  [&_pre]:p-3
                `,
                `
                  [&_code]:bg-background/50 [&_code]:rounded [&_code]:px-1
                  [&_code]:py-0.5 [&_code]:text-[12px]
                `,
                `
                  [&_li]:my-0.5
                  [&_ol]:my-1
                  [&_p]:my-1
                  [&_ul]:my-1
                `,
                `
                  [&_h1]:text-base
                  [&_h2]:text-sm
                  [&_h3]:text-sm
                `,
                "[&_table]:text-xs",
              )}
            >
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {normalizeAssistantMarkdown(message.content)}
              </Markdown>
            </div>
          )}
        </div>
        <p
          className={cn(
            "text-muted-foreground/60 px-1 text-[10px]",
            isUser ? "text-right" : "",
          )}
        >
          {(!message.pending || message.content.trim()) &&
            formatTime(message.createdAt)}
        </p>

        {/* Action toolbar. Always visible at a subdued opacity so
            users discover the controls without hovering — the earlier
            hover-only iteration drew "feature missing" feedback from
            HR. Hidden during edit + while the reply is streaming. */}
        {!editing && !message.pending && message.content.trim() && (
          <div
            className={cn(
              `
                flex items-center gap-1 px-1 opacity-60 transition-opacity
                group-hover:opacity-100
                focus-within:opacity-100
              `,
            )}
          >
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy"
              title="Copy"
              className={`
                text-muted-foreground rounded p-1 transition-colors
                hover:bg-muted/60
              `}
            >
              <Copy className="size-3" />
            </button>
            {isUser && onEdit ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={disabled}
                aria-label="Edit"
                title="Edit and resend"
                className={`
                  text-muted-foreground rounded p-1 transition-colors
                  hover:bg-muted/60
                  disabled:opacity-40
                `}
              >
                <Pencil className="size-3" />
              </button>
            ) : null}
            {!isUser && onRetry ? (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                disabled={disabled}
                aria-label="Retry"
                title="Retry"
                className={`
                  text-muted-foreground rounded p-1 transition-colors
                  hover:bg-muted/60
                  disabled:opacity-40
                `}
              >
                <RefreshCcw className="size-3" />
              </button>
            ) : null}
            {!isUser ? (
              <>
                {/* Both ratings open a reason popover. Submit persists
                    the rating (with or without text); closing without
                    submitting records nothing. */}
                <Popover
                  open={openPopover === "up"}
                  onOpenChange={(open) => {
                    if (feedback !== null) return;
                    setOpenPopover(open ? "up" : null);
                    if (!open) setReasonDraft("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={feedback !== null}
                      aria-label="Helpful"
                      className={cn(
                        "rounded p-1 transition-colors",
                        feedback === "up"
                          ? "text-emerald-600"
                          : "text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      <ThumbsUp className="size-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 space-y-2 p-3">
                    <p className="text-xs font-medium">What did you like?</p>
                    <Textarea
                      value={reasonDraft}
                      onChange={(e) => setReasonDraft(e.target.value)}
                      rows={3}
                      placeholder="Optional — helps us learn what works."
                      className="text-[12px]"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setOpenPopover(null);
                          setReasonDraft("");
                        }}
                        className="h-7 px-2.5 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitFeedback}
                        className="h-7 px-2.5 text-xs"
                      >
                        Send feedback
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover
                  open={openPopover === "down"}
                  onOpenChange={(open) => {
                    if (feedback !== null) return;
                    setOpenPopover(open ? "down" : null);
                    if (!open) setReasonDraft("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={feedback !== null}
                      aria-label="Not helpful"
                      className={cn(
                        "rounded p-1 transition-colors",
                        feedback === "down"
                          ? "text-destructive"
                          : "text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      <ThumbsDown className="size-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 space-y-2 p-3">
                    <p className="text-xs font-medium">What went wrong?</p>
                    <Textarea
                      value={reasonDraft}
                      onChange={(e) => setReasonDraft(e.target.value)}
                      rows={3}
                      placeholder="Optional — helps the admin draft a fix."
                      className="text-[12px]"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setOpenPopover(null);
                          setReasonDraft("");
                        }}
                        className="h-7 px-2.5 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitFeedback}
                        className="h-7 px-2.5 text-xs"
                      >
                        Send feedback
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
