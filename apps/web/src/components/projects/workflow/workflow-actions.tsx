"use client";

import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Send,
  Undo2,
  X,
} from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  escalateRequest,
  runWorkflowAction,
  type WorkflowAction,
} from "@/services/workflow.service";

// Workflow actions, as one menu rather than a row of buttons.
//
// A request can offer up to four actions at once. Rendered as buttons they wrap
// onto two lines inside a table cell, so every row is a different height and the
// destructive action sits as prominently as the routine one. One trigger per row
// fixes both.
//
// ── Two layouts ──
//
// `menu` (default) — a single trigger. Used in the queue, where the win is a
// predictable row height and a scannable table.
//
// `split` — the primary action stays a real button, with the rest behind "More".
// Used on the detail page: somebody who opened a request to approve it should not
// have to hunt for Approve in a menu. Same actions, same authority, one click
// fewer on the common path.
//
// ── Getting out ──
//
// The menu closes on Escape, on click-outside, and on re-clicking the trigger —
// all from the primitive, none re-implemented. Actions needing input open a
// dialog with an explicit Cancel, and the dialog also closes on Escape. Nothing
// here can leave a reviewer stuck inside a control.

const LABEL: Record<WorkflowAction, string> = {
  submit: "Submit",
  approve: "Approve",
  complete: "Mark Complete",
  reject: "Reject",
  return: "Return for changes",
  reopen: "Reopen",
  escalate: "Escalate",
};

// Actions that must carry a written note. Rejecting and sending a request back
// both leave the requester needing to know why, so both open the dialog.
const NEEDS_NOTE: WorkflowAction[] = ["reject", "return"];

/** Escalation needs a PERSON, not just a note, so it gets its own dialog. */
const NEEDS_TARGET: WorkflowAction[] = ["escalate"];

const DONE_MESSAGE: Record<WorkflowAction, string> = {
  submit: "Request submitted",
  approve: "Request approved",
  complete: "Request marked complete",
  reject: "Request rejected",
  return: "Request returned to the requester",
  reopen: "Request reopened",
  escalate: "Request escalated for approval",
};

/**
 * Menu order, most routine first. Fixed rather than following whatever order the
 * API returned, so the same action sits in the same place on every row and the
 * destructive one is never where "approve" was a moment ago.
 */
export const ACTION_ORDER: WorkflowAction[] = [
  "approve",
  "complete",
  "submit",
  "escalate",
  "return",
  "reopen",
  "reject",
];

/** Rendered apart from the rest, below a separator, in the destructive colour. */
export const DESTRUCTIVE: WorkflowAction[] = ["reject"];

/**
 * The menu's contents for a given set of available actions.
 *
 * Pulled out of the component so the two rules that matter can be tested without
 * a DOM: the order never depends on what the API happened to return, and the
 * destructive action is always last, behind a separator.
 */
export function buildActionMenu(
  actions: WorkflowAction[],
  layout: "menu" | "split" = "menu",
): {
  promoted?: WorkflowAction;
  routine: WorkflowAction[];
  destructive: WorkflowAction[];
} {
  const ordered = ACTION_ORDER.filter((a) => actions.includes(a));
  const promoted =
    layout === "split"
      ? ordered.find((a) => !DESTRUCTIVE.includes(a))
      : undefined;
  const inMenu = ordered.filter((a) => a !== promoted);
  return {
    promoted,
    routine: inMenu.filter((a) => !DESTRUCTIVE.includes(a)),
    destructive: inMenu.filter((a) => DESTRUCTIVE.includes(a)),
  };
}

/** One line of plain English per action, so a menu item is not a bare verb. */
const HINT: Record<WorkflowAction, string> = {
  submit: "Send this into the approval chain",
  approve: "Approve the stage waiting on you",
  complete: "Mark the delivered work finished",
  reject: "Decline it, with a reason",
  return: "Send it back to the requester for changes",
  reopen: "Revive a rejected request",
  escalate: "Refer it to somebody you name",
};

const ICON: Record<WorkflowAction, typeof Check> = {
  submit: Send,
  approve: Check,
  complete: Check,
  reject: X,
  return: Undo2,
  reopen: RotateCcw,
  escalate: ArrowUpRight,
};

/** The promoted action's icon. A component so the JSX stays declarative. */
function PromotedIcon({ action }: { action: WorkflowAction }) {
  const Icon = ICON[action];
  return <Icon className="mr-1 size-3.5" />;
}

/**
 * Whether a failure means "what you were looking at is out of date".
 *
 * Two people can hold the same pending request open. When one decides it, the
 * other's next click fails — 409 from the chain's conditional update ("somebody
 * else has already decided this stage"), 400 from the state machine ("cannot
 * approve a project that is Approved"), 403 when the chain has moved on to
 * somebody else, 404 when the row has gone. All four mean the same thing: this
 * view is stale.
 *
 * Showing the message and leaving the row untouched invites the same click
 * again, against the same stale actions, for the same error. So these refetch.
 * A network failure or a 500 deliberately does not — nothing suggests the
 * record moved, and refetching on every transport blip is how you get a loop.
 */
export function isStaleViewError(err: unknown): boolean {
  return err instanceof ApiError && [400, 403, 404, 409].includes(err.status);
}

function WorkflowActionsImpl({
  projectId,
  actions,
  size = "sm",
  layout = "menu",
  onDone,
}: {
  projectId: string;
  actions: WorkflowAction[];
  size?: "sm" | "default";
  /** See the note at the top of this file. */
  layout?: "menu" | "split";
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState<WorkflowAction | null>(null);
  // Which note-requiring action the dialog is currently collecting a note for.
  const [noteFor, setNoteFor] = useState<WorkflowAction | null>(null);
  const [reason, setReason] = useState("");
  // Escalation dialog state.
  const [escalating, setEscalating] = useState(false);
  const [people, setPeople] = useState<AssignableUser[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");

  const openEscalate = () => {
    setTargetId("");
    setPeopleQuery("");
    setReason("");
    setEscalating(true);
    // Fetched on open rather than on mount: the queue renders one action bar
    // per row, and none of them need the directory until someone escalates.
    if (people.length === 0) {
      setPeopleLoading(true);
      listAssignableUsers()
        .then((r) => setPeople(r.data ?? []))
        .catch(() => toast.error("Could not load people"))
        .finally(() => setPeopleLoading(false));
    }
  };

  if (actions.length === 0) return null;

  // Fixed order, destructive action separated. Same helper the tests cover.
  const { promoted, routine, destructive } = buildActionMenu(actions, layout);
  const inMenu = [...routine, ...destructive];

  const filteredPeople = peopleQuery.trim()
    ? people.filter((u) =>
        `${u.name} ${u.email}`
          .toLowerCase()
          .includes(peopleQuery.trim().toLowerCase()),
      )
    : people;

  /** One entry point, so every action reaches the right place from any layout. */
  function start(action: WorkflowAction) {
    if (NEEDS_TARGET.includes(action)) {
      openEscalate();
      return;
    }
    if (NEEDS_NOTE.includes(action)) {
      setReason("");
      setNoteFor(action);
      return;
    }
    void run(action);
  }

  async function runEscalate() {
    if (!targetId) {
      toast.error("Choose who to escalate this request to");
      return;
    }
    try {
      setBusy("escalate");
      await escalateRequest(projectId, targetId, reason.trim() || undefined);
      toast.success(DONE_MESSAGE.escalate);
      setEscalating(false);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
      if (isStaleViewError(err)) {
        setEscalating(false);
        onDone?.();
      }
    } finally {
      setBusy(null);
    }
  }

  async function run(action: WorkflowAction, note = "") {
    try {
      setBusy(action);
      await runWorkflowAction(action, projectId, note);
      toast.success(DONE_MESSAGE[action]);
      setNoteFor(null);
      setReason("");
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
      // Close the note dialog too: leaving it open over a request that has
      // already been decided offers a second go at the same refusal.
      if (isStaleViewError(err)) {
        setNoteFor(null);
        onDone?.();
      }
    } finally {
      setBusy(null);
    }
  }

  const running = busy !== null;

  /** One menu row: icon, label, and a line saying what it does. */
  function item(action: WorkflowAction) {
    const Icon = ICON[action];
    const isDestructive = DESTRUCTIVE.includes(action);
    return (
      <DropdownMenuItem
        key={action}
        disabled={running}
        // The menu closes itself on select. Actions that open a dialog set state
        // here and the dialog mounts after; letting the menu close first is what
        // keeps focus from being fought over between the two.
        onSelect={() => start(action)}
        className={
          isDestructive
            ? `
              text-destructive
              focus:text-destructive
            `
            : undefined
        }
      >
        <Icon className="mt-0.5 size-3.5 shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span>{LABEL[action]}</span>
          <span className="text-muted-foreground text-xs">{HINT[action]}</span>
        </span>
      </DropdownMenuItem>
    );
  }

  return (
    <>
      <div
        className={`
          flex items-center gap-2
          ${layout === "split" ? "justify-end" : "justify-center"}
        `}
      >
        {/* Split layout keeps the routine action one click away. */}
        {promoted && (
          <Button
            size={size}
            onClick={() => start(promoted)}
            disabled={running}
            /* `size="sm"` is 28px tall, under the 44px WCAG 2.5.5 / Apple HIG
               minimum. Raised below 768px only, so the desktop queue and detail
               page render exactly as they do today. A real height rather than
               the `.touch-target` pseudo-element, because these two controls sit
               8px apart and two overlapping 44px hit areas would let "More"
               swallow part of Approve. */
            className="max-md:h-11"
          >
            {busy === promoted ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <PromotedIcon action={promoted} />
            )}
            {LABEL[promoted]}
          </Button>
        )}

        {inMenu.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size={size}
                variant="outline"
                disabled={running}
                className="max-md:h-11"
                // Named for screen readers: a lone chevron says nothing about
                // what it opens, and there is one of these per table row.
                aria-label={
                  promoted ? "More actions for this request" : "Request actions"
                }
              >
                {running ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : promoted ? (
                  <MoreHorizontal className="size-3.5" />
                ) : (
                  <>
                    Actions
                    <ChevronDown className="ml-1 size-3.5" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {inMenu.length === 1 ? "Available action" : "Available actions"}
              </DropdownMenuLabel>
              {routine.map(item)}
              {/* Below a separator so it is never adjacent to Approve. */}
              {destructive.length > 0 && routine.length > 0 && (
                <DropdownMenuSeparator />
              )}
              {destructive.map(item)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog
        open={noteFor !== null}
        onOpenChange={(o) => !o && setNoteFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {noteFor === "return" ? "Return for changes" : "Reject request"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="workflow-note">Reason (required)</Label>
            <Textarea
              id="workflow-note"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                noteFor === "return"
                  ? "What needs to change before this can move forward?"
                  : "Why is this request being rejected?"
              }
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteFor(null)}>
              Cancel
            </Button>
            <Button
              className={
                noteFor === "reject"
                  ? "bg-destructive text-destructive-foreground"
                  : undefined
              }
              onClick={() => {
                if (!noteFor) return;
                if (reason.trim().length < 5) {
                  toast.error("Please give a reason of at least 5 characters");
                  return;
                }
                void run(noteFor, reason.trim());
              }}
              disabled={busy !== null}
            >
              {busy === noteFor && (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              )}
              {noteFor === "return" ? "Return request" : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={escalating}
        onOpenChange={(o) => !o && setEscalating(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate for approval</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="escalate-search">Who should sign this off?</Label>
              <Input
                id="escalate-search"
                value={peopleQuery}
                onChange={(e) => setPeopleQuery(e.target.value)}
                placeholder="Search by name or email…"
                autoFocus
              />
              <div className="max-h-52 overflow-y-auto rounded-md border p-1">
                {peopleLoading ? (
                  <p className="text-muted-foreground p-2 text-sm">Loading…</p>
                ) : filteredPeople.length === 0 ? (
                  <p className="text-muted-foreground p-2 text-sm">
                    No one matches that search
                  </p>
                ) : (
                  filteredPeople.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setTargetId(u.id)}
                      className={`
                        hover:bg-accent
                        flex w-full items-center gap-2 rounded-sm px-2 py-1.5
                        text-left text-sm
                        ${targetId === u.id ? "bg-accent" : ""}
                      `}
                    >
                      <Check
                        className={`
                          size-3.5 shrink-0
                          ${targetId === u.id ? "opacity-100" : "opacity-0"}
                        `}
                      />
                      <span className="truncate">
                        {u.name}
                        <span className="text-muted-foreground ml-1 text-xs">
                          {u.jobTitle ?? u.email}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="escalate-note">Why (optional)</Label>
              <Textarea
                id="escalate-note"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What do you need them to decide?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalating(false)}>
              Cancel
            </Button>
            <Button onClick={runEscalate} disabled={busy !== null || !targetId}>
              {busy === "escalate" && (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              )}
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// The queue re-renders on every search keystroke; row actions do not change
// with it. Memoized so a 25-row page does not rebuild 25 action bars per key.
export const WorkflowActions = memo(WorkflowActionsImpl);
