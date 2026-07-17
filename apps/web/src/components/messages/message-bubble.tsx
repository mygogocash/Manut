"use client";

import { Bookmark, CheckCheck, Download, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  formatBytes,
  formatMessageTime,
  getInitials,
} from "@/components/messages/message-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Message, MessageAttachment } from "@/services/message.service";
import { getSignedUrl } from "@/services/upload.service";

export function MessageRow({
  message,
  isOwn,
  isGroupStart,
  showReadReceipt = false,
  onDelete,
  canDelete = true,
}: {
  message: Message;
  isOwn: boolean;
  isGroupStart: boolean;
  showReadReceipt?: boolean;
  onDelete: (id: string) => void;
  canDelete?: boolean;
}) {
  return (
    <div
      className={cn(
        `
          group relative flex items-start px-5 transition-colors
          hover:bg-accent/40
        `,
        isGroupStart ? "mt-1 gap-3 pt-1.5 pb-0.5" : "gap-3 py-px",
      )}
    >
      {/* Hover action toolbar */}
      {isOwn && canDelete && !message.isDeleted && (
        <div
          className={`
            bg-background absolute -top-2.5 right-5 z-10 flex items-center
            gap-0.5 rounded-md border px-0.5 py-0.5 opacity-0 shadow-sm
            transition-opacity
            group-hover:opacity-100
          `}
        >
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled
                  className={`
                    text-muted-foreground size-6
                    hover:bg-accent hover:text-foreground
                  `}
                >
                  <Bookmark className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Bookmark
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(message.id)}
                  className={`
                    text-muted-foreground size-6
                    hover:bg-accent hover:text-destructive
                  `}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Delete message
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Left column */}
      {isGroupStart ? (
        <Avatar className="mt-0.5 size-8 shrink-0 rounded-lg">
          <AvatarImage src={message.author.avatarUrl ?? undefined} />
          <AvatarFallback
            className={`
              bg-primary/10 text-primary rounded-lg text-[11px] font-semibold
            `}
          >
            {getInitials(message.author.name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex w-8 shrink-0 items-center justify-center">
          <span
            className={`
              text-muted-foreground text-[10px] leading-none opacity-0
              transition-opacity
              group-hover:opacity-100
            `}
          >
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      {/* Right column */}
      <div className="min-w-0 flex-1">
        {isGroupStart && (
          <div className="flex items-baseline gap-2">
            <span
              className={`text-foreground text-[13px] leading-tight font-bold`}
            >
              {message.author.name}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>
        )}

        {message.isDeleted ? (
          <p
            className={`text-muted-foreground text-[13px] leading-[1.46] italic`}
          >
            This message was deleted
          </p>
        ) : (
          message.content && (
            <p
              className={`
                text-foreground/90 text-[13px] leading-[1.46] wrap-break-word
                whitespace-pre-wrap
              `}
            >
              {message.content}
            </p>
          )
        )}

        {!message.isDeleted &&
          message.attachments &&
          message.attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {message.attachments.map((att) => (
                <AttachmentChip key={att.id} attachment={att} />
              ))}
            </div>
          )}

        {showReadReceipt &&
          isOwn &&
          message.readBy &&
          message.readBy.length > 0 && (
            <div
              className={`
                text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]
              `}
            >
              <CheckCheck size={10} className="text-primary" />
              <span>Read</span>
            </div>
          )}
      </div>
    </div>
  );
}

export { MessageRow as MessageBubble };

function AttachmentChip({ attachment }: { attachment: MessageAttachment }) {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    try {
      const url = await getSignedUrl(attachment.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Failed to open attachment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={loading}
      className={cn(
        `
          bg-accent/50 flex max-w-[280px] items-center gap-2 rounded-lg border
          px-2.5 py-1.5 text-left text-[11px]
          hover:bg-accent
          disabled:opacity-50
        `,
      )}
    >
      <FileText size={14} className="text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate font-medium">
          {attachment.originalName}
        </div>
        <div className="text-muted-foreground text-[10px]">
          {formatBytes(attachment.size)}
        </div>
      </div>
      <Download size={12} className="text-muted-foreground shrink-0" />
    </button>
  );
}
