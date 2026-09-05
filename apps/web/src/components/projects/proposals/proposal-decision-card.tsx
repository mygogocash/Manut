"use client";

import { CircleHelp, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { UserMultiSelect } from "@/components/shared/user-multi-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";
import {
  askProposalQuestion,
  declineProposal,
  passProposal,
  type ProposalChoice,
  type ProposalStatus,
} from "@/services/proposal.service";

// The reviewer's decision: one control, three mutually exclusive options, one
// free-text box.
//
// Pass and Decline move the proposal. Question does not: it records what is
// missing and asks named people for it, leaving the proposal exactly where it is
// so the queue keeps saying who owns it. That asymmetry is the whole reason the
// three live in one control rather than three buttons.

/** Matches the API's floor for text that exists to explain something. */
const MIN_EXPLANATION = 5;

interface Option {
  value: ProposalChoice;
  label: string;
  hint: string;
  icon: typeof ThumbsUp;
  /** Selected-state ring and text. Full literals for Tailwind's static scan. */
  tone: string;
}

/** Passing the LAST stage approves outright, so the label has to say so. */
function passLabel(isFinalStage: boolean): string {
  return isFinalStage ? "Approve" : "Pass";
}
function passHint(isFinalStage: boolean): string {
  return isFinalStage
    ? "Final approval. The proposal is approved and the requester is told."
    : "Send it on to the next stage of the approval chain.";
}

export interface ProposalDecisionCardProps {
  proposalId: string;
  status: ProposalStatus;
  /** Which of pass / decline this caller may take, decided server-side. */
  availableActions: Array<"pass" | "decline">;
  canAskForInformation: boolean;
  /**
   * Is this the last stage of the chain? Passing it approves the proposal rather
   * than moving it on, which the button has to say. Decided from the chain rather
   * than from the status, because the status no longer counts the stages.
   */
  isFinalStage: boolean;
  onDone: () => void;
}

export function ProposalDecisionCard({
  proposalId,
  status,
  availableActions,
  canAskForInformation,
  isFinalStage,
  onDone,
}: ProposalDecisionCardProps) {
  const options = useMemo<Option[]>(() => {
    const out: Option[] = [];
    if (availableActions.includes("pass")) {
      out.push({
        value: "pass",
        label: passLabel(isFinalStage),
        hint: passHint(isFinalStage),
        icon: ThumbsUp,
        tone: "border-emerald-500 bg-emerald-500/5",
      });
    }
    if (canAskForInformation) {
      out.push({
        value: "question",
        label: "Question",
        hint: "Ask named people for more detail. The proposal stays with you.",
        icon: CircleHelp,
        tone: "border-amber-500 bg-amber-500/5",
      });
    }
    if (availableActions.includes("decline")) {
      out.push({
        value: "decline",
        label: "Decline",
        hint: "Final. The requester raises a fresh proposal if they want another look.",
        icon: ThumbsDown,
        tone: "border-red-500 bg-red-500/5",
      });
    }
    return out;
  }, [availableActions, canAskForInformation, isFinalStage]);

  const [choice, setChoice] = useState<ProposalChoice | null>(null);
  const [text, setText] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [saving, setSaving] = useState(false);

  // Only loaded once Question is picked, so the common path costs nothing.
  useEffect(() => {
    if (choice !== "question" || users.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await listAssignableUsers({ limit: 500 });
        if (!cancelled) setUsers(res.data);
      } catch {
        if (!cancelled) toast.error("Could not load the people list");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [choice, users.length]);

  const trimmed = text.trim();
  // A decline needs its reason and a question needs both its text and someone to
  // answer it. A pass may carry a note or nothing. The five-character floor
  // mirrors the API schema, so the button disables instead of round-tripping to
  // a 400.
  const needsExplanation = choice === "decline" || choice === "question";
  const blocked =
    choice === null ||
    (needsExplanation && trimmed.length < MIN_EXPLANATION) ||
    (choice === "question" && assignees.length === 0);

  const submit = useCallback(async () => {
    if (choice === null || blocked) return;
    try {
      setSaving(true);
      if (choice === "pass") {
        await passProposal(proposalId, trimmed || undefined);
        toast.success(
          isFinalStage ? "Proposal approved" : "Passed to the next stage",
        );
      } else if (choice === "decline") {
        await declineProposal(proposalId, trimmed);
        toast.success("Proposal declined");
      } else {
        await askProposalQuestion(proposalId, assignees, trimmed);
        toast.success(
          assignees.length === 1
            ? "Question sent"
            : `Question sent to ${assignees.length} people`,
        );
      }
      setChoice(null);
      setText("");
      setAssignees([]);
      onDone();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not record that",
      );
      // 409 means somebody else decided first, so what is on screen is already
      // stale. Reload rather than leaving the reviewer looking at controls for a
      // decision that is no longer theirs to make.
      if (err instanceof ApiError && err.status === 409) onDone();
    } finally {
      setSaving(false);
    }
  }, [assignees, blocked, choice, isFinalStage, onDone, proposalId, trimmed]);

  // Nothing to offer: not a reviewer at this stage, or the proposal is closed.
  if (options.length === 0) return null;

  const textLabel =
    choice === "decline"
      ? "Reason for declining"
      : choice === "question"
        ? "What do you need to know?"
        : "Note (optional)";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Your decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={choice ?? ""}
          onValueChange={(v) => setChoice(v as ProposalChoice)}
          className={`
            grid gap-2
            sm:grid-cols-3
          `}
        >
          {options.map((o) => {
            const Icon = o.icon;
            const active = choice === o.value;
            const id = `proposal-choice-${o.value}`;
            return (
              <Label
                key={o.value}
                htmlFor={id}
                className={`
                  flex cursor-pointer items-start gap-2 rounded-lg border p-3
                  transition-colors
                  ${active ? o.tone : "border-border hover:bg-accent/50"}
                `}
              >
                <RadioGroupItem id={id} value={o.value} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Icon className="size-3.5" />
                    {o.label}
                  </span>
                  <span
                    className={`
                      text-muted-foreground mt-0.5 block text-xs font-normal
                    `}
                  >
                    {o.hint}
                  </span>
                </span>
              </Label>
            );
          })}
        </RadioGroup>

        {choice !== null && (
          <div className="space-y-3">
            {choice === "question" && (
              <div>
                <Label className="mb-1.5 block text-xs">
                  Who should answer?
                </Label>
                <UserMultiSelect
                  users={users}
                  value={assignees}
                  onChange={setAssignees}
                  placeholder="Search by name or email…"
                  disabled={saving}
                />
              </div>
            )}

            <div>
              <Label
                htmlFor="proposal-decision-text"
                className="mb-1.5 block text-xs"
              >
                {textLabel}
              </Label>
              <Textarea
                id="proposal-decision-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={saving}
                rows={3}
                placeholder={
                  choice === "question"
                    ? "Describe what is missing, so the answer comes back useful."
                    : "Add context for the record."
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => void submit()}
                disabled={blocked || saving}
              >
                {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                {choice === "question"
                  ? "Send question"
                  : choice === "decline"
                    ? "Decline"
                    : passLabel(isFinalStage)}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setChoice(null);
                  setText("");
                  setAssignees([]);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
