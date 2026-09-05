"use client";

import {
  Copy,
  Download,
  FileText,
  History,
  MessageSquarePlus,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import {
  copyLastReply,
  exportConversationMarkdown,
  exportConversationPDF,
} from "@/components/aria/aria-export";
import type { LocalMessage } from "@/components/aria/aria-utils";
import { Button } from "@/components/ui/button";

interface AriaToolbarProps {
  messages: LocalMessage[];
  activeId: string | null;
  conversationTitle: string;
  onNewChat: () => void;
  onEndSession: () => void;
  onToggleHistory: () => void;
  disabled?: boolean;
}

export function AriaToolbar({
  messages,
  activeId,
  conversationTitle,
  onNewChat,
  onEndSession,
  onToggleHistory,
  disabled = false,
}: AriaToolbarProps) {
  const hasAssistantReply = messages.some(
    (m) => m.role === "assistant" && !m.pending && m.content.trim().length > 0,
  );
  const hasContent = messages.some(
    (m) => !m.pending && m.content.trim().length > 0,
  );
  const canEnd = !!activeId && !disabled;

  const handleCopy = () => {
    const copied = copyLastReply(messages);
    if (copied) toast.success("Last reply copied");
    else toast.error("No reply to copy yet");
  };

  const handleMarkdown = () => {
    exportConversationMarkdown(messages, conversationTitle);
  };

  const handlePDF = () => {
    exportConversationPDF(messages, conversationTitle);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <ToolbarChip
        icon={<Square className="size-3 fill-current" />}
        label="End this session"
        onClick={onEndSession}
        disabled={!canEnd}
      />
      <ToolbarChip
        icon={<Download className="size-3.5" />}
        label="Download PDF"
        onClick={handlePDF}
        disabled={!hasContent || disabled}
      />
      <ToolbarChip
        icon={<FileText className="size-3.5" />}
        label="Markdown"
        onClick={handleMarkdown}
        disabled={!hasContent || disabled}
      />
      <ToolbarChip
        icon={<Copy className="size-3.5" />}
        label="Copy last reply"
        onClick={handleCopy}
        disabled={!hasAssistantReply || disabled}
      />
      <ToolbarChip
        icon={<MessageSquarePlus className="size-3.5" />}
        label="New chat"
        onClick={onNewChat}
        disabled={disabled}
      />
      <ToolbarChip
        icon={<History className="size-3.5" />}
        label="History"
        onClick={onToggleHistory}
        disabled={disabled}
      />
    </div>
  );
}

function ToolbarChip({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={`
        text-foreground-secondary h-7 gap-1.5 rounded-full px-2.5 text-[11px]
        font-normal
        hover:bg-muted/50 hover:text-foreground
      `}
    >
      {icon}
      {label}
    </Button>
  );
}
