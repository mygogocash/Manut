"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

import { BottomSheet } from "@/components/shared/responsive/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { ProjectColumn, Task } from "@/services/project.service";

// Moving a task, by tapping rather than dragging.
//
// This is not a mobile feature bolted beside the board — it is the board's own
// move, reached a different way. It calls `applyTaskMove`, the same function the
// desktop drag handler calls, which calls the same `reorderTasks` endpoint with
// the same payload. There is no mobile move endpoint and no second status
// registry: the destinations ARE the board's columns, passed straight in.
//
// A drag carries a drop point; a tap does not, so an explicit move appends to
// the end of the destination — the same thing the drag does when a card is
// dropped on a column rather than on another card.

export interface MoveToSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The task being moved. Null while the sheet is closed. */
  task: Task | null;
  /** The board's columns, in board order. The only source of destinations. */
  columns: ProjectColumn[];
  /**
   * Performs the move. Resolves `true` when the write landed, so the sheet can
   * stay open on failure rather than implying a move that did not happen.
   */
  onMove: (task: Task, targetStatus: string) => Promise<boolean>;
}

export function MoveToSheet({
  open,
  onOpenChange,
  task,
  columns,
  onMove,
}: MoveToSheetProps) {
  // Which destination is in flight. Doubles as the disabled guard, so a second
  // tap during the request cannot start a second move.
  const [movingTo, setMovingTo] = useState<string | null>(null);

  async function handleSelect(targetStatus: string) {
    if (!task || movingTo) return;
    setMovingTo(targetStatus);
    try {
      const ok = await onMove(task, targetStatus);
      // Only close on success. A failed move has already rolled the board back
      // and shown its error; closing here would read as "done".
      if (ok) onOpenChange(false);
    } finally {
      setMovingTo(null);
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        // Never dismiss mid-write: the row is mid-rollback-or-commit.
        if (movingTo) return;
        onOpenChange(next);
      }}
      title="Move task"
      description={task ? task.title : undefined}
      footer={
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onOpenChange(false)}
          disabled={movingTo !== null}
        >
          Cancel
        </Button>
      }
    >
      <ul className="flex flex-col gap-1">
        {columns.map((col) => {
          const isCurrent = task?.status === col.key;
          const isMoving = movingTo === col.key;
          return (
            <li key={col.id}>
              <button
                type="button"
                onClick={() => void handleSelect(col.key)}
                /* The task's own status is not a destination. Disabled rather
                   than hidden, so the list still reads as the whole board and
                   the current position is visible in it. */
                disabled={isCurrent || movingTo !== null}
                aria-current={isCurrent ? "true" : undefined}
                className={`
                  hover:bg-accent
                  flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2
                  text-left text-sm
                  disabled:pointer-events-none disabled:opacity-60
                  focus-visible:ring-ring focus-visible:ring-2
                  focus-visible:outline-none
                `}
              >
                <span
                  aria-hidden
                  className={`size-2.5 shrink-0 rounded-full ${col.color}`}
                />
                <span className="min-w-0 flex-1 break-anywhere">
                  {col.label}
                </span>
                {isMoving ? (
                  <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
                ) : isCurrent ? (
                  <span
                    className={`text-muted-foreground shrink-0 text-xs`}
                  >
                    <Check aria-hidden className="mr-1 inline size-3.5" />
                    Current
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
