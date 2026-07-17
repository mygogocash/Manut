"use client";

import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SurveyBuilder } from "@/components/survey/survey-form-builder";
import { SurveyTargets } from "@/components/survey/survey-form-targets";
import {
  getSurveyTemplate,
  SURVEY_TEMPLATES,
} from "@/components/survey/survey-form-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { type Entity, listEntities } from "@/services/entity.service";
import { createSurvey, type QuestionInput } from "@/services/survey.service";
import { listUsers, type UserListItem } from "@/services/user.service";

export default function NewSurveyPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [questions, setQuestions] = useState<QuestionInput[]>([]);
  const [targetAll, setTargetAll] = useState(true);
  const [targetEntityIds, setTargetEntityIds] = useState<string[]>([]);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [templateId, setTemplateId] = useState<string>("blank");

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (id === "blank") return;
    const template = getSurveyTemplate(id);
    if (!template) return;
    setTitle(template.title);
    setDescription(template.formDescription);
    setIsAnonymous(template.isAnonymous);
    setQuestions(template.questions.map((q) => ({ ...q })));
    toast.success(`Loaded “${template.label}” template`);
  }

  useEffect(() => {
    void Promise.all([
      listEntities()
        .then((res) => setEntities(res.data))
        .catch(() => {}),
      listUsers({ limit: 500, isActive: true })
        .then((res) => setUsers(res.data))
        .catch(() => {}),
    ]);
  }, []);

  async function handleSave(publish: boolean) {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (questions.length === 0) {
      toast.error("Add at least one question");
      return;
    }
    try {
      setSubmitting(true);
      const created = await createSurvey({
        title: title.trim(),
        description: description.trim() || null,
        isAnonymous,
        targetAll,
        targetEntityIds,
        targetDepartments,
        targetUserIds,
        questions,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      toast.success("Survey saved as draft");
      if (publish) {
        const { publishSurvey } = await import("@/services/survey.service");
        await publishSurvey(created.data.id);
        toast.success("Survey published");
      }
      router.push(`/survey/${created.data.id}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New survey"
        subtitle="Build the questions, pick the audience, then publish."
      >
        <Button variant="outline" onClick={() => router.push("/survey")}>
          <ArrowLeft className="mr-1 size-3.5" /> Cancel
        </Button>
      </PageHeader>

      <div className="bg-card flex flex-col gap-4 rounded-md border p-4">
        <div>
          <Label>Start from template</Label>
          <Select value={templateId} onValueChange={applyTemplate}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Blank survey" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blank">Blank survey</SelectItem>
              {SURVEY_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {templateId !== "blank" && (
            <p
              className={`
                text-muted-foreground mt-1.5 flex items-start gap-1.5 text-xs
              `}
            >
              <Sparkles className="mt-0.5 size-3 shrink-0" />
              {getSurveyTemplate(templateId)?.description}
            </p>
          )}
        </div>
        <div>
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Q3 engagement pulse"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short context for respondents."
          />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-sm">Anonymous responses</Label>
            <p className="text-muted-foreground text-xs">
              Names aren&apos;t recorded. Each person can submit more than once.
            </p>
          </div>
          <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start-date">Start date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Optional — opens for responses on this day.
            </p>
          </div>
          <div>
            <Label htmlFor="end-date">End date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Optional — closes after this day. HR can extend it later.
            </p>
          </div>
        </div>
      </div>

      <SurveyTargets
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

      <SurveyBuilder
        questions={questions}
        onChange={setQuestions}
        disabled={submitting}
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={submitting}
        >
          {submitting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
          <Save className="mr-1 size-3.5" /> Save draft
        </Button>
        <Button onClick={() => handleSave(true)} disabled={submitting}>
          {submitting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
          Save & publish
        </Button>
      </div>
    </div>
  );
}
