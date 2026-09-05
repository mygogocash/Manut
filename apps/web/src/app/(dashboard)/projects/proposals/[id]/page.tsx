"use client";

import { ArrowLeft, Check, CircleHelp, Loader2, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ProposalDecisionCard } from "@/components/projects/proposals/proposal-decision-card";
import { ProposalFormDialog } from "@/components/projects/proposals/proposal-form-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getProposal,
  PROPOSAL_PRIORITY_LABELS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_TONE,
  PROPOSAL_TYPE_LABELS,
  type ProposalDetail,
  type ProposalPriority,
  type ProposalQuestion,
  type ProposalStage,
  type ProposalStatus,
  type ProposalType,
  respondToProposalQuestion,
} from "@/services/proposal.service";

// Proposal detail: one screen, no tabs.
//
// Everything a reviewer needs in order to decide is above the fold, with the
// decision control directly beneath the details. Questions sit next to the
// details rather than behind a tab, because an open question is usually the
// reason a decision is being deferred.

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission("proposals:read", "projects:manage");

  const [data, setData] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await getProposal(id);
      setData(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [canView, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Proposal" />
        <p className="text-muted-foreground text-sm">No access.</p>
      </div>
    );
  }

  const proposal = data?.proposal;
  const perms = data?.permissions;
  // Tolerated as absent on purpose. An API that predates the chain field, or one
  // mid-deploy behind the web, must not white-screen the page — the proposal is
  // still readable and still decidable without its rail.
  const chain = data?.chain ?? {
    currentStage: null,
    totalStages: 0,
    stages: [],
  };

  return (
    <div className="px-6 py-6">
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects/proposals">
            <ArrowLeft className="mr-1 size-3.5" />
            Proposals
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Couldn&apos;t load this proposal</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        data &&
        proposal &&
        perms && (
          <>
            <div
              className={`
                mb-5 flex flex-col gap-3
                lg:flex-row lg:items-start lg:justify-between
              `}
            >
              <div className="min-w-0">
                <PageHeader
                  title={proposal.title}
                  subtitle={`${PROPOSAL_TYPE_LABELS[proposal.type as ProposalType] ?? proposal.type} · raised by ${proposal.raisedBy} on ${fmtDateTime(proposal.createdAt)}`}
                />
                <span
                  className={`
                    mt-1 inline-flex rounded-full px-2.5 py-1 text-xs
                    font-medium
                    ${PROPOSAL_STATUS_TONE[proposal.status] ?? ""}
                  `}
                >
                  {proposal.label}
                </span>
              </div>
              {perms.canEdit && (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-1 size-3.5" />
                  Edit
                </Button>
              )}
            </div>

            <Card className="mb-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <ProposalProgress
                  stages={chain.stages}
                  status={proposal.status}
                />
              </CardContent>
            </Card>

            <div
              className={`
                grid gap-5
                lg:grid-cols-[1fr_380px]
              `}
            >
              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    <div
                      className={`
                        grid grid-cols-1 gap-3
                        sm:grid-cols-3
                      `}
                    >
                      <Field
                        label="Type"
                        value={
                          PROPOSAL_TYPE_LABELS[proposal.type as ProposalType] ??
                          proposal.type
                        }
                      />
                      <Field
                        label="Priority"
                        value={
                          proposal.priority
                            ? (PROPOSAL_PRIORITY_LABELS[
                                proposal.priority as ProposalPriority
                              ] ?? proposal.priority)
                            : null
                        }
                      />
                      <div>
                        <p className="text-muted-foreground text-xs uppercase">
                          Related project
                        </p>
                        {proposal.project ? (
                          <Link
                            href={`/projects/${proposal.project.id}`}
                            className="hover:underline"
                          >
                            {proposal.project.name}
                          </Link>
                        ) : (
                          <p>—</p>
                        )}
                      </div>
                    </div>
                    <Field
                      label="What is proposed"
                      value={proposal.description}
                    />
                  </CardContent>
                </Card>

                <ProposalDecisionCard
                  proposalId={proposal.id}
                  status={proposal.status}
                  availableActions={perms.availableActions}
                  canAskForInformation={perms.canAskForInformation}
                  /* No chain means a pass finalises, same as the last stage. */
                  isFinalStage={
                    chain.totalStages === 0 ||
                    chain.currentStage === chain.totalStages
                  }
                  onDone={load}
                />

                <Card>
                  <CardHeader>
                    <CardTitle
                      className={`flex items-center gap-2 text-sm font-medium`}
                    >
                      <CircleHelp className="size-4" />
                      Questions ({data.questions.length})
                      {data.openQuestionCount > 0 && (
                        <span
                          className={`
                            rounded-full bg-amber-500/10 px-2 py-0.5 text-xs
                            font-medium text-amber-600
                          `}
                        >
                          {data.openQuestionCount} open
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.questions.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Nobody has asked for more information.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {data.questions.map((q) => (
                          <QuestionItem key={q.id} q={q} onAnswered={load} />
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Decision history
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.history.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Nothing recorded yet.
                    </p>
                  ) : (
                    <ol className="space-y-3">
                      {data.history.map((h) => (
                        <li key={h.id} className="flex gap-2.5 text-sm">
                          <span
                            className={`
                              mt-1 size-1.5 shrink-0 rounded-full
                              ${
                                h.toStatus === "declined"
                                  ? "bg-red-500"
                                  : h.toStatus === "approved"
                                    ? "bg-emerald-500"
                                    : "bg-muted-foreground"
                              }
                            `}
                          />
                          <div className="min-w-0">
                            <p className="font-medium">
                              {PROPOSAL_STATUS_LABELS[
                                h.toStatus as ProposalStatus
                              ] ?? h.toStatus}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {h.actor} · {fmtDateTime(h.at)}
                            </p>
                            {h.comment && (
                              <p className="mt-1 text-xs whitespace-pre-wrap">
                                {h.comment}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>

            <ProposalFormDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              proposal={proposal}
              onSaved={() => void load()}
            />
          </>
        )
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs uppercase">{label}</p>
      <p className="whitespace-pre-wrap">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

/**
 * Where the proposal is in its configured chain.
 *
 * Built from the record's snapshotted stages rather than a fixed list of
 * statuses: how many stages there are, and what they are called, is an
 * administrator's choice. A proposal following no chain shows its status alone.
 */
function ProposalProgress({
  stages,
  status,
}: {
  stages: ProposalStage[];
  status: string;
}) {
  if (status === "declined") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`
            flex size-6 items-center justify-center rounded-full bg-red-500/10
            text-red-600
          `}
        >
          <X className="size-3.5" />
        </span>
        <span className="font-medium">Declined</span>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This proposal is not following a configured approval chain.
      </p>
    );
  }

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {stages.map((stage, i) => {
        const done = stage.status === "approved";
        const active =
          stage.status === "pending" &&
          !stages.slice(0, i).some((s) => s.status === "pending");
        return (
          <li key={stage.id} className="flex items-center gap-2">
            <span
              className={`
                flex size-6 items-center justify-center rounded-full text-xs
                ${
                  done
                    ? "bg-emerald-500/10 text-emerald-600"
                    : active
                      ? "bg-primary/10 text-primary font-medium"
                      : "bg-muted text-muted-foreground"
                }
              `}
            >
              {done ? <Check className="size-3.5" /> : stage.order}
            </span>
            <span
              className={`
                text-sm
                ${active ? "font-medium" : "text-muted-foreground"}
              `}
            >
              {stage.name}
              {stage.approver && (
                <span className="text-muted-foreground block text-xs">
                  {stage.approver.name}
                </span>
              )}
            </span>
            {i < stages.length - 1 && <span className="bg-border h-px w-6" />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One question. The answer box appears only for the person it was assigned to,
 * which the API decides via `isMine` rather than this page comparing ids.
 */
function QuestionItem({
  q,
  onAnswered,
}: {
  q: ProposalQuestion;
  onAnswered: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const answered = q.respondedAt !== null;

  async function submit() {
    const trimmed = answer.trim();
    if (trimmed.length === 0) return;
    try {
      setSaving(true);
      await respondToProposalQuestion(q.id, trimmed);
      toast.success("Answer sent");
      setAnswer("");
      onAnswered();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not send that answer",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="border-border rounded-lg border p-3">
      <p className="text-sm whitespace-pre-wrap">{q.question}</p>
      <p className="text-muted-foreground mt-1 text-xs">
        {q.askedBy} asked {q.assignedTo} · {fmtDateTime(q.createdAt)}
      </p>

      {answered ? (
        <div className="border-border mt-2 border-l-2 pl-3">
          <p className="text-sm whitespace-pre-wrap">{q.response}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Answered {q.respondedAt ? fmtDateTime(q.respondedAt) : ""}
          </p>
        </div>
      ) : q.isMine ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            disabled={saving}
            placeholder="Write your answer…"
            aria-label="Your answer"
          />
          <Button
            size="sm"
            onClick={() => void submit()}
            disabled={saving || answer.trim().length === 0}
          >
            {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            Send answer
          </Button>
        </div>
      ) : (
        <p
          className={`
            mt-2 inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-xs
            font-medium text-amber-600
          `}
        >
          Awaiting an answer
        </p>
      )}
    </li>
  );
}
