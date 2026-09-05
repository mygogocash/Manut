"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

import { BottomSheet } from "@/components/shared/responsive/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/services/crm-opportunity.service";

// Changing an opportunity's stage by choosing, rather than by dragging.
//
// The board's only direct move is HTML5 native drag (`draggable` +
// `dataTransfer`). That has no touch implementation in mobile Safari or Chrome,
// and it is not keyboard-operable at all. The capability was never missing — a
// stage can be changed through the card's Edit dialog — but that is four steps
// and a full form for what a mouse does in one gesture, and a keyboard user has
// no direct path whatsoever.
//
// This is not a second move. It calls the board's own `moveOpportunity`, which
// performs the same optimistic update, the same `updateOpportunity` mutation,
// the same `fetchPipeline()` refresh and the same rollback-plus-toast on
// failure. There is no mobile move endpoint and no second stage registry: the
// destinations ARE `OPPORTUNITY_STAGES`, in board order.
//
// A drag carries a drop point and can order within a column; a choice cannot.
// The board's own column-drop handler already appends in that case, so this
// matches it. Within-column ordering stays drag-only, deliberately.

export interface PipelineMoveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The opportunity being moved. Null while the sheet is closed. */
  opportunity: { id: string; name: string; stage: string } | null;
  /**
   * Performs the move. Resolves `true` when the write landed, so the sheet can
   * stay open on failure rather than implying a move that did not happen.
   */
  onMove: (id: string, stage: OpportunityStage) => Promise<boolean>;
}

export function PipelineMoveSheet({
  open,
  onOpenChange,
  opportunity,
  onMove,
}: PipelineMoveSheetProps) {
  // Which destination is in flight. Doubles as the disabled guard, so a second
  // tap during the request cannot start a second move.
  const [movingTo, setMovingTo] = useState<OpportunityStage | null>(null);

  async function handleSelect(stage: OpportunityStage) {
    if (!opportunity || movingTo) return;
    setMovingTo(stage);
    try {
      const ok = await onMove(opportunity.id, stage);
      // Only close on success. A failed move has already rolled the board back
      // and shown its own toast; closing would imply it worked.
      if (ok) onOpenChange(false);
    } finally {
      setMovingTo(null);
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Move to stage"
      description={opportunity?.name}
    >
      <div className="flex flex-col gap-1.5 px-4 pb-4">
        {OPPORTUNITY_STAGES.map((stage) => {
          const isCurrent = opportunity?.stage === stage;
          const inFlight = movingTo === stage;
          return (
            <Button
              key={stage}
              type="button"
              variant={isCurrent ? "secondary" : "outline"}
              // The current stage is shown and disabled rather than hidden, so
              // the list always reads as the whole pipeline and the card's
              // position in it is obvious.
              disabled={isCurrent || movingTo !== null}
              onClick={() => handleSelect(stage)}
              className="min-h-11 justify-between text-sm"
            >
              <span>{OPPORTUNITY_STAGE_LABELS[stage] ?? stage}</span>
              {isCurrent ? (
                <span
                  className={`
                    text-muted-foreground inline-flex items-center gap-1 text-xs
                  `}
                >
                  <Check className="size-3.5" />
                  Current
                </span>
              ) : inFlight ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
            </Button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
