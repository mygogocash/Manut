"use client";

import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Lock,
  Plus,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  addChainStep,
  type Chain,
  CHAIN_SCOPE_HINTS,
  CHAIN_SCOPE_LABELS,
  type ChainScope,
  type ChainStep,
  getChain,
  removeChainStep,
  reorderChainSteps,
  updateChainStep,
} from "@/services/approval-chain.service";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";

// The approval chain editor.
//
// One screen for both Project CRM chains. Every change saves immediately rather
// than collecting into a Save button: these are small, independent edits, and a
// half-applied batch would leave a chain in a state nobody chose.
//
// Reads are open to anyone who can see the Project CRM, so a reviewer can see who
// approves next. Every WRITE is system-admin only, enforced by the API; this
// component hides the controls for the same reason rather than instead of it.

export interface ChainEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ChainScope;
  /** Whether to render the editing controls at all. */
  canEdit: boolean;
  onSaved?: () => void;
}

export function ChainEditorDialog({
  open,
  onOpenChange,
  scope,
  canEdit,
  onSaved,
}: ChainEditorDialogProps) {
  const [chain, setChain] = useState<Chain | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [res, people] = await Promise.all([
        getChain(scope),
        listAssignableUsers({ limit: 500 }),
      ]);
      setChain(res.data);
      setUsers(people.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not load the chain",
      );
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  /**
   * Every mutation goes through here so one place owns the error message, the
   * busy flag, and refreshing from the server's answer rather than guessing at
   * the new state.
   */
  const run = useCallback(
    async (label: string, fn: () => Promise<{ data: Chain }>) => {
      try {
        setBusy(true);
        const res = await fn();
        setChain(res.data);
        toast.success(label);
        onSaved?.();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not save");
      } finally {
        setBusy(false);
      }
    },
    [onSaved],
  );

  const active = useMemo(
    () => (chain?.steps ?? []).filter((s) => s.isActive),
    [chain],
  );

  async function move(step: ChainStep, direction: -1 | 1) {
    if (!chain) return;
    const ids = chain.steps.map((s) => s.id);
    const from = ids.indexOf(step.id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    await run("Order updated", () => reorderChainSteps(scope, ids));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Approval chain: {CHAIN_SCOPE_LABELS[scope]}</DialogTitle>
          <DialogDescription>{CHAIN_SCOPE_HINTS[scope]}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-muted-foreground py-6 text-sm">Loading…</div>
        ) : !chain ? (
          <p className="text-muted-foreground text-sm">
            No chain is configured for this flow.
          </p>
        ) : (
          <div className="space-y-4">
            {!canEdit && (
              <p
                className={`
                  text-muted-foreground border-border rounded-md border
                  border-dashed p-3 text-xs
                `}
              >
                Only a system administrator can change an approval chain. This
                is the chain as it stands.
              </p>
            )}

            <ol className="space-y-2">
              {chain.steps.map((step, i) => (
                <StageRow
                  key={step.id}
                  step={step}
                  position={i + 1}
                  users={users}
                  canEdit={canEdit}
                  busy={busy}
                  isFirst={i === 0}
                  isLast={i === chain.steps.length - 1}
                  /** Removing the last active stage is refused by the API. */
                  isOnlyActive={step.isActive && active.length <= 1}
                  onMove={(d) => void move(step, d)}
                  onRename={(name) =>
                    void run("Stage renamed", () =>
                      updateChainStep(scope, step.id, { name }),
                    )
                  }
                  onAssign={(approverUserId) =>
                    void run("Approver updated", () =>
                      updateChainStep(scope, step.id, { approverUserId }),
                    )
                  }
                  onRemove={() =>
                    void run("Stage removed", () =>
                      removeChainStep(scope, step.id),
                    )
                  }
                />
              ))}
            </ol>

            {canEdit && (
              <div className="border-border rounded-lg border border-dashed p-3">
                <Label htmlFor="chain-new-stage" className="text-xs">
                  Add a stage
                </Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="chain-new-stage"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="What is this stage called?"
                    disabled={busy}
                  />
                  <Button
                    onClick={() => {
                      const name = newName.trim();
                      if (!name) return;
                      void run("Stage added", async () => {
                        const res = await addChainStep(scope, { name });
                        setNewName("");
                        return res;
                      });
                    }}
                    disabled={busy || newName.trim().length === 0}
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                  </Button>
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  A new stage goes at the end, with nobody assigned. Pick a
                  person before it is used, or it falls back to system
                  administrators.
                </p>
              </div>
            )}

            {/* Editing a chain never disturbs a record already in flight. Worth
                saying, because an administrator reasonably worries about it. */}
            <p className="text-muted-foreground text-xs">
              Changes apply to records submitted from now on. Anything already
              awaiting a decision keeps the chain it was submitted against.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StageRow({
  step,
  position,
  users,
  canEdit,
  busy,
  isFirst,
  isLast,
  isOnlyActive,
  onMove,
  onRename,
  onAssign,
  onRemove,
}: {
  step: ChainStep;
  position: number;
  users: AssignableUser[];
  canEdit: boolean;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  isOnlyActive: boolean;
  onMove: (direction: -1 | 1) => void;
  onRename: (name: string) => void;
  onAssign: (approverUserId: string | null) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(step.name);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // A save elsewhere refreshes the chain, so the field must follow the server.
  useEffect(() => setName(step.name), [step.name]);

  const closePicker = useCallback(() => {
    setPicking(false);
    setQuery("");
  }, []);

  // Clicking anywhere else is the fourth way out, and the one people reach for
  // first. Bound only while the picker is open so the rest of the dialog is not
  // paying for a listener it does not use.
  useEffect(() => {
    if (!picking) return;
    function onPointerDown(event: MouseEvent) {
      const el = pickerRef.current;
      if (el && !el.contains(event.target as Node)) closePicker();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [picking, closePicker]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.slice(0, 50);
    return users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [users, query]);

  return (
    <li className="border-border rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <span
          className={`
            bg-muted text-muted-foreground mt-1 flex size-6 shrink-0
            items-center justify-center rounded-full text-xs tabular-nums
          `}
        >
          {position}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          {step.isSystem && (
            <p
              className={`
                text-muted-foreground flex items-center gap-1 text-[11px]
              `}
            >
              <Lock className="size-3" />
              Part of the approval flow. Rename it or change who approves here,
              but it cannot be removed.
            </p>
          )}

          {canEdit ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const next = name.trim();
                if (next && next !== step.name) onRename(next);
                else setName(step.name);
              }}
              disabled={busy}
              className="h-8"
              aria-label={`Stage ${position} name`}
            />
          ) : (
            <p className="text-sm font-medium">{step.name}</p>
          )}

          {/* Who decides here */}
          {step.approver ? (
            <p className="text-sm">
              {step.approver.name}{" "}
              <span className="text-muted-foreground">
                {step.approver.email}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onAssign(null)}
                  disabled={busy}
                  className={`
                    text-muted-foreground ml-2
                    hover:text-destructive
                    disabled:opacity-50
                  `}
                  aria-label={`Clear the approver for ${step.name}`}
                >
                  <X className="inline size-3" />
                </button>
              )}
            </p>
          ) : (
            <p
              className={`
                flex items-center gap-1.5 text-xs
                ${step.approverMissing ? "text-amber-600" : "text-muted-foreground"}
              `}
            >
              {step.approverMissing && <TriangleAlert className="size-3.5" />}
              {step.approverMissing
                ? "The person set here is deactivated. Choose somebody else."
                : "Nobody assigned. Falls back to system administrators."}
            </p>
          )}

          {canEdit &&
            (picking ? (
              /* Open only on purpose, and closable four ways: pick somebody,
                 press Escape, click the X, or click anywhere outside. The
                 previous version opened on focus and closed on a blur timer,
                 which left no obvious way back out once the field had focus. */
              <div ref={pickerRef} className="relative">
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    value={query}
                    placeholder="Search by name or email…"
                    disabled={busy}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        // Stop it bubbling to the Dialog, which would otherwise
                        // close the whole editor instead of just this picker.
                        e.stopPropagation();
                        closePicker();
                      }
                    }}
                    className="h-8"
                    aria-label={`Assign an approver for ${step.name}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={closePicker}
                    aria-label="Stop choosing an approver"
                    title="Cancel (Esc)"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <div
                  className={`
                    border-border bg-popover absolute top-full z-10 mt-1
                    max-h-48 w-full overflow-y-auto rounded-md border shadow-md
                  `}
                >
                  {filtered.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-2 text-xs">
                      Nobody matches “{query.trim()}”.
                    </p>
                  ) : (
                    filtered.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          onAssign(u.id);
                          closePicker();
                        }}
                        className={`
                          hover:bg-accent
                          w-full px-2 py-1.5 text-left text-xs
                        `}
                      >
                        <span className="font-medium">{u.name}</span>{" "}
                        <span className="text-muted-foreground">{u.email}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={busy}
                onClick={() => setPicking(true)}
              >
                <UserPlus className="size-3.5" />
                {step.approver ? "Change approver" : "Assign somebody"}
              </Button>
            ))}
        </div>

        {canEdit && (
          <div className="flex shrink-0 flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={busy || isFirst}
              onClick={() => onMove(-1)}
              aria-label={`Move ${step.name} earlier`}
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={busy || isLast}
              onClick={() => onMove(1)}
              aria-label={`Move ${step.name} later`}
            >
              <ArrowDown className="size-3.5" />
            </Button>
            {/* A fixed stage shows a lock rather than a disabled X: the two
                are refused for different reasons and should not look alike. */}
            {step.isSystem ? (
              <span
                className={`
                  text-muted-foreground flex size-7 items-center justify-center
                `}
                title="This stage is part of the approval flow and cannot be removed"
              >
                <Lock className="size-3.5" />
              </span>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className={`
                  size-7
                  hover:text-destructive
                `}
                /* The API refuses this too; disabling it explains why up front. */
                disabled={busy || isOnlyActive}
                title={
                  isOnlyActive
                    ? "A chain must keep at least one stage"
                    : "Remove this stage"
                }
                onClick={onRemove}
                aria-label={`Remove ${step.name}`}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
