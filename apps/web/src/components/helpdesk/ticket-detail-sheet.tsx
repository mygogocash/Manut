"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Paperclip, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  addTicketComment,
  deleteTicket,
  getTicket,
  type HelpdeskAssignee,
  type HelpdeskComment,
  type HelpdeskTicket,
  listHelpdeskAssignees,
  listTicketComments,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  updateTicket,
} from "@/services/helpdesk.service";

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function priorityBadgeVariant(
  p: TicketPriority,
): "default" | "secondary" | "destructive" | "outline" {
  switch (p) {
    case "urgent":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
    default:
      return "outline";
  }
}

interface TicketDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  /** Bubbles updates so the kanban / list parent can refresh in place. */
  onChanged?: (ticket: HelpdeskTicket) => void;
  onDeleted?: (id: string) => void;
}

export function TicketDetailSheet({
  open,
  onOpenChange,
  ticketId,
  onChanged,
  onDeleted,
}: TicketDetailSheetProps) {
  const { user, hasPermission } = useAuth();
  const [ticket, setTicket] = useState<HelpdeskTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [comments, setComments] = useState<HelpdeskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [assignees, setAssignees] = useState<HelpdeskAssignee[]>([]);

  const canSeeAll = hasPermission("it:read-all");
  const canUpdate = hasPermission("it:update");
  const canAssign = hasPermission("it:assign");
  const canResolve = hasPermission("it:resolve");
  const canDelete = hasPermission("it:delete");

  // Fetch IT-team roster once per sheet open. Guarded on `canAssign`
  // so a plain employee viewing their own ticket doesn't trigger a
  // 403 round-trip. Cheap query, no need to cache across opens.
  useEffect(() => {
    if (!open || !canAssign) return;
    let cancelled = false;
    void listHelpdeskAssignees()
      .then((res) => {
        if (!cancelled) setAssignees(res.data);
      })
      .catch(() => {
        // Non-fatal — dropdown falls back to the current-assignee +
        // current-user options as before.
      });
    return () => {
      cancelled = true;
    };
  }, [open, canAssign]);

  useEffect(() => {
    if (!open || !ticketId) {
      setTicket(null);
      setComments([]);
      setCommentDraft("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setCommentsLoading(true);
    Promise.all([getTicket(ticketId), listTicketComments(ticketId)])
      .then(([ticketRes, commentsRes]) => {
        if (cancelled) return;
        setTicket(ticketRes.data);
        setResolutionNote(ticketRes.data.resolutionNote ?? "");
        setComments(commentsRes.data);
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError ? err.message : "Failed to load ticket";
        toast.error(msg);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, ticketId]);

  async function handleSubmitComment() {
    if (!ticket) return;
    const body = commentDraft.trim();
    if (!body) {
      toast.error("Comment can't be empty");
      return;
    }
    try {
      setCommentSubmitting(true);
      const res = await addTicketComment(ticket.id, body);
      setComments((prev) => [...prev, res.data]);
      setCommentDraft("");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to post comment";
      toast.error(msg);
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function applyPatch(patch: Parameters<typeof updateTicket>[1]) {
    if (!ticket) return;
    try {
      setSaving(true);
      const res = await updateTicket(ticket.id, patch);
      setTicket(res.data);
      onChanged?.(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!ticket) return;
    if (
      !confirm(`Delete ticket IT-${ticket.ticketNumber}? Cannot be undone.`)
    ) {
      return;
    }
    try {
      setSaving(true);
      await deleteTicket(ticket.id);
      toast.success("Ticket deleted");
      onDeleted?.(ticket.id);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to delete";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const isAuthor = ticket?.createdBy.id === user?.id;
  // Author can edit narrow fields only while no IT staff has picked the
  // ticket up. After that, edits flow through the IT team via this sheet.
  const authorCanEdit =
    isAuthor && ticket?.status === "open" && ticket.assignee === null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`
          flex w-full flex-col gap-0 overflow-hidden p-0
          sm:max-w-xl
        `}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3">
          <SheetTitle>
            {ticket
              ? `IT-${ticket.ticketNumber} · ${ticket.title}`
              : "Loading ticket"}
          </SheetTitle>
          <SheetDescription>
            {ticket
              ? `${TICKET_CATEGORY_LABELS[ticket.category]} · opened ${formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}`
              : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div
              className={`text-muted-foreground flex items-center gap-2 text-sm`}
            >
              <Loader2 className="size-4 animate-spin" />
              Loading...
            </div>
          )}

          {!loading && ticket && (
            <div className="flex flex-col gap-5">
              <div
                className={`
                  grid gap-4
                  sm:grid-cols-2
                `}
              >
                <div className="flex flex-col gap-1.5">
                  <Label>Status</Label>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) =>
                      void applyPatch({ status: v as TicketStatus })
                    }
                    disabled={saving || !canUpdate || !canResolve}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TICKET_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={ticket.priority}
                    onValueChange={(v) =>
                      void applyPatch({ priority: v as TicketPriority })
                    }
                    disabled={saving || (!canUpdate && !authorCanEdit)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {TICKET_PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Category</Label>
                  <Select
                    value={ticket.category}
                    onValueChange={(v) =>
                      void applyPatch({ category: v as TicketCategory })
                    }
                    disabled={saving || (!canUpdate && !authorCanEdit)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {TICKET_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Assignee</Label>
                  <Select
                    value={ticket.assignee?.id ?? "__unassigned"}
                    onValueChange={(v) =>
                      void applyPatch({
                        assigneeId: v === "__unassigned" ? null : v,
                      })
                    }
                    disabled={saving || !canAssign}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned">Unassigned</SelectItem>
                      {/*
                        Render the current assignee first (so the
                        Select trigger always has a matching option,
                        even if the user has lost IT perms since being
                        assigned), then the live IT-team roster from
                        `/helpdesk/assignees`, deduped against the
                        current assignee.
                      */}
                      {ticket.assignee &&
                        !assignees.some(
                          (a) => a.id === ticket.assignee?.id,
                        ) && (
                          <SelectItem value={ticket.assignee.id}>
                            {ticket.assignee.name}
                          </SelectItem>
                        )}
                      {assignees.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                          {user?.id === a.id ? " (me)" : ""}
                        </SelectItem>
                      ))}
                      {/* Fallback: when the roster fetch failed and
                          the current user is IT but isn't the assignee
                          yet, still let them self-assign. */}
                      {assignees.length === 0 &&
                        user &&
                        user.id !== ticket.assignee?.id && (
                          <SelectItem value={user.id}>
                            {user.name} (me)
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <section className="flex flex-col gap-2">
                <Label>Description</Label>
                <p
                  className={`
                    bg-muted/40 text-foreground rounded-md border px-3 py-2
                    text-sm whitespace-pre-wrap
                  `}
                >
                  {ticket.description}
                </p>
              </section>

              {ticket.attachments && ticket.attachments.length > 0 && (
                <section className="flex flex-col gap-2">
                  <Label>Attachments ({ticket.attachments.length})</Label>
                  <ul className="flex flex-col gap-1.5">
                    {ticket.attachments.map((att, idx) => (
                      <li
                        key={`${att.url}-${idx}`}
                        className={`
                          bg-muted/40 flex items-center gap-2 rounded-md border
                          px-3 py-1.5 text-sm
                        `}
                      >
                        <Paperclip
                          className={`text-muted-foreground size-3.5 shrink-0`}
                        />
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`
                            min-w-0 flex-1 truncate
                            hover:underline
                          `}
                        >
                          {att.name}
                        </a>
                        {att.size ? (
                          <span
                            className={`text-muted-foreground shrink-0 text-xs`}
                          >
                            {formatBytes(att.size)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="flex flex-col gap-2">
                <Label>Comments ({comments.length})</Label>
                {commentsLoading ? (
                  <div
                    className={`
                      text-muted-foreground flex items-center gap-2 text-xs
                    `}
                  >
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading comments…
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No comments yet. Start the conversation with the IT team.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {comments.map((c) => (
                      <li
                        key={c.id}
                        className={`
                          bg-muted/30 flex flex-col gap-1 rounded-md border px-3
                          py-2 text-sm
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5">
                            <AvatarImage
                              src={c.author.avatarUrl ?? undefined}
                            />
                            <AvatarFallback>
                              {c.author.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">
                            {c.author.name}
                            {c.author.id === ticket.createdBy.id ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · requester
                              </span>
                            ) : c.author.id === ticket.assignee?.id ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · assignee
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`
                              text-muted-foreground ml-auto text-[11px]
                            `}
                            title={format(new Date(c.createdAt), "PPp")}
                          >
                            {formatDistanceToNow(new Date(c.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">
                          {c.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <Textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Reply to the IT team…"
                  rows={3}
                  maxLength={5000}
                  disabled={commentSubmitting}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="self-start"
                  disabled={commentSubmitting || !commentDraft.trim()}
                  onClick={() => void handleSubmitComment()}
                >
                  {commentSubmitting && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  Post comment
                </Button>
              </section>

              <section className="flex flex-col gap-2">
                <Label>Resolution note</Label>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Brief summary of what was done (visible to the requester)."
                  rows={4}
                  maxLength={5000}
                  disabled={!canResolve}
                />
                {canResolve && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="self-start"
                    disabled={
                      saving || resolutionNote === (ticket.resolutionNote ?? "")
                    }
                    onClick={() =>
                      void applyPatch({
                        resolutionNote: resolutionNote || null,
                      })
                    }
                  >
                    Save note
                  </Button>
                )}
              </section>

              <section className="flex flex-col gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Label className="w-24">Requester</Label>
                  <Avatar className="size-6">
                    <AvatarImage
                      src={ticket.createdBy.avatarUrl ?? undefined}
                    />
                    <AvatarFallback>
                      {ticket.createdBy.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{ticket.createdBy.name}</span>
                  <span className="text-muted-foreground">
                    {ticket.createdBy.department ?? ticket.createdBy.email}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-24">Priority</Label>
                  <Badge variant={priorityBadgeVariant(ticket.priority)}>
                    {TICKET_PRIORITY_LABELS[ticket.priority]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-24">Resolved</Label>
                  <span className="text-muted-foreground">
                    {ticket.resolvedAt
                      ? format(new Date(ticket.resolvedAt), "PPp")
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-24">Closed</Label>
                  <span className="text-muted-foreground">
                    {ticket.closedAt
                      ? format(new Date(ticket.closedAt), "PPp")
                      : "—"}
                  </span>
                </div>
              </section>
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 border-t px-4 py-3">
          <div className="flex w-full items-center justify-between">
            {(canDelete || isAuthor) && ticket ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={saving}
              >
                <Trash2 className="mr-1 size-3.5" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
          {canSeeAll ? null : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
