"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Download,
  Loader2,
  Send,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { AnswerCell } from "@/components/survey/answer-cell";
import { SurveyFormBuilder } from "@/components/survey-forms/survey-form-builder";
import { exportSurveyFormResponsesCsv } from "@/components/survey-forms/survey-form-export";
import { SurveyFormPublishDialog } from "@/components/survey-forms/survey-form-publish-dialog";
import { SurveyFormTargets } from "@/components/survey-forms/survey-form-targets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { type Entity, listEntities } from "@/services/entity.service";
import {
  announceSurveyForm,
  archiveSurveyForm,
  closeSurveyForm,
  deleteSurveyForm,
  getSurveyForm,
  getSurveyFormAnalytics,
  listSurveyFormResponses,
  publishSurveyForm,
  QUESTION_TYPE_LABELS,
  type QuestionInput,
  reopenSurveyForm,
  replaceSurveyFormQuestions,
  scheduleSurveyForm,
  type SurveyAnnounceOptions,
  type SurveyFormAnalytics,
  type SurveyFormDetail,
  type SurveyFormResponseRow,
  unarchiveSurveyForm,
  updateSurveyForm,
} from "@/services/survey-form.service";
import { listUsers, type UserListItem } from "@/services/user.service";

export default function SurveyFormDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("survey:manage-wave");

  const [form, setForm] = useState<SurveyFormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "edit" | "responses" | "analytics"
  >("edit");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);

  // Edit state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [targetAll, setTargetAll] = useState(true);
  const [targetEntityIds, setTargetEntityIds] = useState<string[]>([]);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [responses, setResponses] = useState<SurveyFormResponseRow[]>([]);
  const [analytics, setAnalytics] = useState<SurveyFormAnalytics | null>(null);

  const fetchForm = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getSurveyForm(id);
      setForm(res.data);
      setTitle(res.data.title);
      setDescription(res.data.description ?? "");
      setIsAnonymous(res.data.isAnonymous);
      setTargetAll(res.data.targetAll);
      setTargetEntityIds(res.data.targetEntityIds);
      setTargetDepartments(res.data.targetDepartments);
      setTargetUserIds(res.data.targetUserIds);
      setQuestions(
        res.data.questions.map((q) => ({
          type: q.type,
          prompt: q.prompt,
          helperText: q.helperText,
          required: q.required,
          options: q.options,
          settings: q.settings,
        })),
      );
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load award";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchForm();
  }, [fetchForm]);

  useEffect(() => {
    if (!canManage) return;
    void Promise.all([
      listEntities()
        .then((res) => setEntities(res.data))
        .catch(() => {}),
      listUsers({ limit: 500, isActive: true })
        .then((res) => setUsers(res.data))
        .catch(() => {}),
    ]);
  }, [canManage]);

  useEffect(() => {
    if (activeTab === "responses" && form && canManage) {
      void listSurveyFormResponses(form.id)
        .then((res) => setResponses(res.data))
        .catch(() => toast.error("Failed to load responses"));
    }
    if (activeTab === "analytics" && form && canManage) {
      void getSurveyFormAnalytics(form.id)
        .then((res) => setAnalytics(res.data))
        .catch(() => toast.error("Failed to load analytics"));
    }
  }, [activeTab, form, canManage]);

  if (loading || !form) {
    return (
      <div
        className={`
          text-muted-foreground flex items-center justify-center gap-2 py-24
          text-sm
        `}
      >
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  // Capture into a const so closures below stay narrowed.
  const survey = form;

  const isOwner = survey.createdBy?.id === user?.id;
  const editable = isOwner && survey.status === "draft" && canManage;

  async function handleSaveDraft() {
    try {
      setSaving(true);
      await updateSurveyForm(survey.id, {
        title,
        description: description || null,
        isAnonymous,
        targetAll,
        targetEntityIds,
        targetDepartments,
        targetUserIds,
      });
      await replaceSurveyFormQuestions(survey.id, questions);
      toast.success("Draft saved");
      await fetchForm();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function handlePublish() {
    setPublishOpen(true);
  }

  async function doPublish(announce: SurveyAnnounceOptions) {
    try {
      setPublishing(true);
      await handleSaveDraft();
      await publishSurveyForm(survey.id, announce);
      toast.success("Award published");
      setPublishOpen(false);
      await fetchForm();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Publish failed";
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }

  async function handleClose() {
    try {
      setClosing(true);
      await closeSurveyForm(survey.id);
      toast.success("Award closed");
      await fetchForm();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Close failed";
      toast.error(msg);
    } finally {
      setClosing(false);
    }
  }

  async function handleReopen() {
    try {
      setReopening(true);
      await reopenSurveyForm(survey.id);
      toast.success("Award reopened");
      await fetchForm();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Reopen failed";
      toast.error(msg);
    } finally {
      setReopening(false);
    }
  }

  async function doAnnounce(announce: SurveyAnnounceOptions) {
    try {
      setAnnouncing(true);
      const res = await announceSurveyForm(survey.id, announce);
      const posted = res.data.posted;
      toast.success(
        posted.length > 0
          ? `Announced to ${posted.join(", ")}`
          : "Nothing posted — check the toggles and your permissions",
      );
      setAnnounceOpen(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Announce failed";
      toast.error(msg);
    } finally {
      setAnnouncing(false);
    }
  }

  async function handleToggleArchive() {
    const archived = Boolean(survey.archivedAt);
    try {
      setArchiving(true);
      if (archived) {
        await unarchiveSurveyForm(survey.id);
        toast.success("Award restored");
      } else {
        await archiveSurveyForm(survey.id);
        toast.success("Survey archived");
      }
      await fetchForm();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Action failed";
      toast.error(msg);
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await deleteSurveyForm(survey.id);
      toast.success("Survey deleted");
      router.push("/survey-forms");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Delete failed";
      toast.error(msg);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const tabs: Array<{ id: "edit" | "responses" | "analytics"; label: string }> =
    [{ id: "edit", label: editable ? "Edit" : "Overview" }];
  if (canManage && survey.status !== "draft") {
    tabs.push({
      id: "responses",
      label: `Responses (${survey._count.responses})`,
    });
    tabs.push({ id: "analytics", label: "Analytics" });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={survey.title}
        subtitle={survey.description ?? undefined}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/survey-forms")}
          >
            <ArrowLeft className="mr-1 size-3.5" /> All awards
          </Button>
          {canManage && isOwner && survey.status !== "draft" && (
            <Button
              variant="outline"
              onClick={() => setAnnounceOpen(true)}
              disabled={announcing}
            >
              <Send className="mr-1 size-3.5" />
              Announce
            </Button>
          )}
          {/* Status controls — any survey manager (admin / HR), not just the
              creator. Hidden while archived (unarchive first). */}
          {canManage && !survey.archivedAt && survey.status === "published" && (
            <Button variant="outline" onClick={handleClose} disabled={closing}>
              {closing ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <X className="mr-1 size-3.5" />
              )}
              Close
            </Button>
          )}
          {canManage && !survey.archivedAt && survey.status === "closed" && (
            <Button
              variant="outline"
              onClick={handleReopen}
              disabled={reopening}
            >
              {reopening ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Unlock className="mr-1 size-3.5" />
              )}
              Open
            </Button>
          )}
          {canManage && isOwner && (
            <Button
              variant="outline"
              onClick={handleToggleArchive}
              disabled={archiving}
            >
              {survey.archivedAt ? (
                <ArchiveRestore className="mr-1 size-3.5" />
              ) : (
                <Archive className="mr-1 size-3.5" />
              )}
              {survey.archivedAt ? "Unarchive" : "Archive"}
            </Button>
          )}
          {survey.archivedAt && <Badge variant="grey">Archived</Badge>}
          <Badge>{survey.status}</Badge>
        </div>
      </PageHeader>

      {canManage && isOwner && survey.status !== "closed" && (
        <ScheduleEditor form={survey} onSaved={fetchForm} />
      )}

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={(v) => setActiveTab(v as typeof activeTab)}
      >
        <TabsContent value="edit">
          {editable ? (
            <div className="flex flex-col gap-4">
              <div className="bg-card flex flex-col gap-3 rounded-md border p-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div
                  className={`
                    flex items-center justify-between rounded-md border p-3
                  `}
                >
                  <Label className="text-sm">Anonymous responses</Label>
                  <Switch
                    checked={isAnonymous}
                    onCheckedChange={setIsAnonymous}
                  />
                </div>
              </div>

              <SurveyFormTargets
                targetAll={targetAll}
                targetEntityIds={targetEntityIds}
                targetDepartments={targetDepartments}
                targetUserIds={targetUserIds}
                onChange={(next) => {
                  setTargetAll(next.targetAll);
                  setTargetEntityIds(next.targetEntityIds);
                  setTargetDepartments(next.targetDepartments);
                  setTargetUserIds(next.targetUserIds);
                }}
                entities={entities}
                users={users}
              />

              <SurveyFormBuilder
                questions={questions}
                onChange={setQuestions}
                disabled={saving || publishing}
              />

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving || publishing || deleting}
                >
                  <Trash2 className="text-destructive mr-1 size-3.5" />
                  Delete draft
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={saving || publishing}
                >
                  {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                  Save draft
                </Button>
                <Button onClick={handlePublish} disabled={saving || publishing}>
                  {publishing ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1 size-3.5" />
                  )}
                  Publish
                </Button>
              </div>
            </div>
          ) : (
            <ReadonlyOverview form={survey} />
          )}
        </TabsContent>

        {canManage && survey.status !== "draft" && (
          <TabsContent value="responses">
            <ResponsesTable
              responses={responses}
              questions={survey.questions}
              isAnonymous={survey.isAnonymous}
              title={survey.title}
            />
          </TabsContent>
        )}

        {canManage && survey.status !== "draft" && (
          <TabsContent value="analytics">
            <AnalyticsView analytics={analytics} />
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          if (!deleting) setConfirmDelete(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The questions and configuration are gone for good. This is only
              available while the survey is still a draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SurveyFormPublishDialog
        open={publishOpen}
        onOpenChange={(next) => {
          if (!publishing) setPublishOpen(next);
        }}
        formTitle={survey.title}
        publishing={publishing}
        onConfirm={doPublish}
      />

      <SurveyFormPublishDialog
        open={announceOpen}
        onOpenChange={(next) => {
          if (!announcing) setAnnounceOpen(next);
        }}
        formTitle={survey.title}
        publishing={announcing}
        onConfirm={doAnnounce}
        heading="Announce to company"
        description="Re-broadcast this survey across the intranet. Targeted members already see it in their notification bell."
        confirmLabel="Announce"
        confirmingLabel="Announcing…"
      />
    </div>
  );
}

function ReadonlyOverview({ form }: { form: SurveyFormDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card rounded-md border p-4">
        <div
          className={`
            grid gap-2 text-sm
            sm:grid-cols-3
          `}
        >
          <Stat label="Status" value={form.status} />
          <Stat label="Questions" value={String(form._count.questions)} />
          <Stat label="Responses" value={String(form._count.responses)} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {form.questions.map((q, idx) => (
          <div key={q.id} className="bg-card rounded-md border p-3 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground text-xs">{idx + 1}.</span>
              <span className="font-medium">{q.prompt}</span>
              {q.required && <span className="text-destructive">*</span>}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {QUESTION_TYPE_LABELS[q.type]}
              {q.options.length > 0 && ` · ${q.options.length} options`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function ResponsesTable({
  responses,
  questions,
  isAnonymous,
  title,
}: {
  responses: SurveyFormResponseRow[];
  questions: SurveyFormDetail["questions"];
  isAnonymous: boolean;
  title: string;
}) {
  if (responses.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No responses yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {responses.length} response{responses.length === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportSurveyFormResponsesCsv(
              { title, isAnonymous, questions },
              responses,
            )
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-2 py-1.5 font-medium">Submitted</th>
              {!isAnonymous && (
                <th className="px-2 py-1.5 font-medium">Respondent</th>
              )}
              {questions.map((q) => (
                <th key={q.id} className="px-2 py-1.5 font-medium">
                  {q.prompt}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="text-muted-foreground px-2 py-1.5">
                  {new Date(r.submittedAt).toLocaleString()}
                </td>
                {!isAnonymous && (
                  <td className="px-2 py-1.5">
                    {r.respondent?.name ?? "—"}
                    <div className="text-muted-foreground text-[11px]">
                      {r.respondent?.email ?? ""}
                    </div>
                  </td>
                )}
                {questions.map((q) => {
                  const a = r.answers.find((x) => x.questionId === q.id);
                  const val = a?.value;
                  return (
                    <td key={q.id} className="px-2 py-1.5 align-top">
                      <AnswerCell value={val} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScheduleEditor({
  form,
  onSaved,
}: {
  form: SurveyFormDetail;
  onSaved: () => void;
}) {
  const initialStart = form.startDate?.slice(0, 10) ?? "";
  const initialEnd = form.endDate?.slice(0, 10) ?? "";
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [saving, setSaving] = useState(false);
  const dirty = start !== initialStart || end !== initialEnd;

  async function save() {
    try {
      setSaving(true);
      await scheduleSurveyForm(form.id, {
        startDate: start || null,
        endDate: end || null,
      });
      toast.success("Schedule updated");
      onSaved();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update schedule";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-md border p-4">
      <div>
        <p className="text-sm font-medium">Schedule</p>
        <p className="text-muted-foreground text-xs">
          Optional open/close window. Responses are only accepted between these
          dates; extend the end date to keep the survey open.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="sched-start">Start date</Label>
          <Input
            id="sched-start"
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sched-end">End date</Label>
          <Input
            id="sched-end"
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={saving || !dirty}>
          {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
          Save schedule
        </Button>
      </div>
    </div>
  );
}

function AnalyticsView({
  analytics,
}: {
  analytics: SurveyFormAnalytics | null;
}) {
  if (!analytics) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Loading analytics…
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card rounded-md border p-3 text-sm">
        <span className="text-muted-foreground text-xs">Total responses</span>{" "}
        <span className="text-lg font-semibold tabular-nums">
          {analytics.totalResponses}
        </span>
      </div>
      {analytics.questions.map((q) => (
        <div key={q.id} className="bg-card rounded-md border p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{q.prompt}</span>
            <span className="text-muted-foreground text-xs">
              {q.responses} responses
            </span>
          </div>
          {q.kind === "choice" && (
            <div className="mt-3 flex flex-col gap-1.5">
              {Object.entries(q.counts).map(([opt, count]) => {
                const pct =
                  q.responses > 0 ? Math.round((count / q.responses) * 100) : 0;
                return (
                  <div key={opt} className="flex items-center gap-3 text-xs">
                    <div className="w-32 truncate">{opt}</div>
                    <div className="bg-muted flex-1 rounded">
                      <div
                        className="bg-primary h-2 rounded"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-20 text-right tabular-nums">
                      {count} · {pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {q.kind === "numeric" && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <Stat label="Average" value={q.average?.toFixed(2) ?? "—"} />
              <Stat label="Min" value={q.min?.toString() ?? "—"} />
              <Stat label="Max" value={q.max?.toString() ?? "—"} />
            </div>
          )}
          {q.kind === "text" && (
            <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs">
              {q.samples.length === 0 ? (
                <li className="text-muted-foreground list-none">
                  No answers yet.
                </li>
              ) : (
                q.samples.map((s, i) => <li key={`${i}-${s}`}>{s}</li>)
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
