"use client";

import { format } from "date-fns";
import { Pencil, User } from "lucide-react";

import { Badge } from "@/components/shared/badge";
import { RichTextViewer } from "@/components/shared/rich-text-editor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { stripHtmlToText } from "@/lib/utils";
import type {
  PartnerColumn,
  PartnerTask,
} from "@/services/partner-workspace.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Task being viewed; null closes the sheet. */
  task: PartnerTask | null;
  /** Direct children of `task` (parentTaskId === task.id). */
  subtasks: PartnerTask[];
  columns: PartnerColumn[];
  partnerName: string;
  canEdit: boolean;
  /** Open the edit dialog for this task. */
  onEdit: (task: PartnerTask) => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDay(iso: string | null) {
  if (!iso) return null;
  try {
    return format(new Date(`${iso.slice(0, 10)}T00:00:00`), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string) {
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

function PersonChip({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback className="text-[10px]">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-foreground text-[13px]">{name}</span>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`
          text-muted-foreground text-[10px] font-medium tracking-wide uppercase
        `}
      >
        {label}
      </span>
      <div className="text-foreground text-[13px]">{children}</div>
    </div>
  );
}

export function PartnerTaskDetailSheet({
  open,
  onOpenChange,
  task,
  subtasks,
  columns,
  partnerName,
  canEdit,
  onEdit,
}: Props) {
  if (!task) return null;

  const column = columns.find((c) => c.key === task.status);
  const hasDescription =
    !!task.description && stripHtmlToText(task.description).length > 0;
  const startDay = formatDay(task.startDate);
  const endDay = formatDay(task.endDate);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`
          flex h-full w-full max-w-none flex-col gap-0 overflow-hidden p-0
          sm:max-w-[min(720px,calc(100vw-24px))]!
        `}
        showCloseButton
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Task details</SheetTitle>
          <SheetDescription>View task details</SheetDescription>
        </SheetHeader>

        {/* Breadcrumb header */}
        <div
          className={`
            border-border bg-muted/20 flex shrink-0 items-center gap-1.5
            border-b px-4 py-2.5
          `}
        >
          <span className="text-foreground/80 truncate text-[11px] font-medium">
            {partnerName}
          </span>
          <span className="text-muted-foreground/70">/</span>
          <span className="text-muted-foreground font-mono text-[10px]">
            #{task.id.slice(-8).toUpperCase()}
          </span>
        </div>

        <div
          className={`
            flex min-h-0 flex-1 flex-col
            md:flex-row
          `}
        >
          {/* Main column */}
          <div
            className={`
              flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-5
              py-4
            `}
          >
            <h2 className="text-foreground text-lg font-semibold break-words">
              {task.title}
            </h2>

            <section className="flex flex-col gap-2">
              <span
                className={`
                  text-muted-foreground text-[10px] font-medium tracking-wide
                  uppercase
                `}
              >
                Description
              </span>
              {hasDescription ? (
                <RichTextViewer html={task.description as string} />
              ) : (
                <p className="text-muted-foreground text-[13px] italic">
                  No description
                </p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <span
                className={`
                  text-muted-foreground text-[10px] font-medium tracking-wide
                  uppercase
                `}
              >
                Assignees
              </span>
              {task.assignees.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {task.assignees.map((a) => (
                    <PersonChip key={a.id} name={a.user.name} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-[13px]">
                  No assignees
                </p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <span
                className={`
                  text-muted-foreground text-[10px] font-medium tracking-wide
                  uppercase
                `}
              >
                Subtasks
                {subtasks.length > 0 ? (
                  <span className="text-muted-foreground/70 ml-1.5 tabular-nums">
                    {subtasks.length}
                  </span>
                ) : null}
              </span>
              {subtasks.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {subtasks.map((sub) => {
                    const subColumn = columns.find((c) => c.key === sub.status);
                    return (
                      <li
                        key={sub.id}
                        className={`
                          border-border/60 bg-muted/20 flex items-center gap-2
                          rounded-md border px-2.5 py-1.5
                        `}
                      >
                        <span
                          className={`
                            inline-block size-2 shrink-0 rounded-full
                            ${subColumn?.color || "bg-zinc-500"}
                          `}
                        />
                        <span className="text-foreground flex-1 text-[13px]">
                          {sub.title}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {subColumn?.label ?? sub.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-muted-foreground text-[13px]">No subtasks</p>
              )}
            </section>
          </div>

          {/* Details rail */}
          <div
            className={`
              border-border bg-muted/10 flex shrink-0 flex-col gap-5 border-t
              px-5 py-4
              md:w-64 md:border-t-0 md:border-l
            `}
          >
            <DetailRow label="Status">
              <div className="flex items-center gap-2">
                <span
                  className={`
                    inline-block size-2 rounded-full
                    ${column?.color || "bg-zinc-500"}
                  `}
                />
                {column?.label ?? task.status}
              </div>
            </DetailRow>

            <DetailRow label="Priority">
              <Badge status={task.priority}>{task.priority}</Badge>
            </DetailRow>

            <DetailRow label="Owner">
              {task.owner ? (
                <PersonChip name={task.owner.name} />
              ) : (
                <span
                  className={`
                    text-muted-foreground inline-flex items-center gap-1.5
                  `}
                >
                  <User className="size-3.5" /> Unassigned
                </span>
              )}
            </DetailRow>

            <DetailRow label="Start date">
              {startDay ?? <span className="text-muted-foreground">None</span>}
            </DetailRow>

            <DetailRow label="End date">
              {endDay ?? <span className="text-muted-foreground">None</span>}
            </DetailRow>

            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                className="mt-1 w-full"
                onClick={() => onEdit(task)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            ) : null}

            <div
              className={`
                text-muted-foreground mt-auto flex flex-col gap-0.5 text-[11px]
              `}
            >
              <span>Created {formatDateTime(task.createdAt)}</span>
              <span>Updated {formatDateTime(task.updatedAt)}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
