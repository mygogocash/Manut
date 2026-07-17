"use client";

import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import {
  clearSurveyDraft,
  readSurveyDraft,
  writeSurveyDraft,
} from "@/components/survey/survey-draft";
import {
  type AnswerMap,
  SurveyRenderer,
} from "@/components/survey/survey-form-renderer";
import { buildSurveyRespondentPrefill } from "@/components/survey/survey-form-templates";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getMySurveyResponse,
  getSurvey,
  submitSurveyResponse,
  type SurveyDetail,
} from "@/services/survey.service";

export default function RespondSurveyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const userId = user?.id ?? null;

  const [form, setForm] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // The prefill needs `user`, but a new `user` object reference on tab-return
  // (AuthProvider reloads /me on visibility-return) must NOT re-trigger the
  // fetch and overwrite typed answers. Read `user` through a ref, keep the
  // fetch keyed on `id` only, and seed the answer map once per form id.
  const userRef = useRef(user);
  userRef.current = user;
  const hydratedForRef = useRef<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getSurvey(id);
      setForm(res.data);

      let answered = false;
      if (!res.data.isAnonymous) {
        const my = await getMySurveyResponse(id);
        if (my.data) {
          answered = true;
          setDone(true);
        }
      }

      // Seed answers once per form id: prefill identity fields, then overlay
      // any saved draft. Guarding on the hydrated id keeps a background auth
      // refresh (or a param change without remount) from clobbering input.
      if (hydratedForRef.current !== id) {
        hydratedForRef.current = id;
        const uid = userRef.current?.id ?? null;
        if (answered) {
          clearSurveyDraft(id, uid);
        } else {
          const u = userRef.current;
          const prefill = buildSurveyRespondentPrefill(
            res.data.questions,
            u
              ? {
                  name: u.name,
                  email: u.email,
                  department: u.department,
                  jobTitle: u.jobTitle,
                }
              : null,
          );
          const draft = readSurveyDraft(id, uid);
          setValues(draft ? { ...prefill, ...draft } : prefill);
        }
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load survey";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  // Autosave the in-progress answers so a tab-switch, refresh, or auth-refresh
  // remount does not lose them. Debounced to avoid a write per keystroke, and
  // only once the form is loaded, hydrated for this id, and not yet completed.
  const debouncedValues = useDebounce(values, 400);
  useEffect(() => {
    if (!form || done) return;
    if (hydratedForRef.current !== id) return;
    writeSurveyDraft(id, userId, debouncedValues);
  }, [debouncedValues, form, done, id, userId]);

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
  const survey = form;

  if (survey.status !== "published") {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <p className="text-muted-foreground text-sm">
          This survey is {survey.status} and not accepting responses.
        </p>
        <Button variant="outline" onClick={() => router.push("/survey")}>
          <ArrowLeft className="mr-1 size-3.5" /> Back
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <CheckCircle2 className="size-10 text-emerald-500" />
        <p className="text-sm font-medium">Thanks — response recorded.</p>
        <Button variant="outline" onClick={() => router.push("/survey")}>
          <ArrowLeft className="mr-1 size-3.5" /> Back to surveys
        </Button>
      </div>
    );
  }

  async function handleSubmit() {
    const missing = survey.questions
      .filter((q) => q.type !== "info" && q.required)
      .find((q) => {
        const v = values[q.id];
        if (v === undefined || v === null) return true;
        if (typeof v === "string" && v.trim() === "") return true;
        if (Array.isArray(v) && v.length === 0) return true;
        return false;
      });
    if (missing) {
      toast.error(`Question "${missing.prompt}" is required`);
      return;
    }

    try {
      setSubmitting(true);
      const answers = survey.questions
        .filter((q) => q.type !== "info")
        .map((q) => ({
          questionId: q.id,
          value: values[q.id] ?? null,
        }))
        .filter((a) => a.value !== null);
      await submitSurveyResponse(survey.id, answers);
      toast.success("Response submitted");
      clearSurveyDraft(survey.id, userId);
      setDone(true);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Submit failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={survey.title}
        subtitle={survey.description ?? undefined}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/survey")}>
            <ArrowLeft className="mr-1 size-3.5" /> Cancel
          </Button>
          {survey.isAnonymous && <Badge variant="grey">Anonymous</Badge>}
        </div>
      </PageHeader>

      <SurveyRenderer
        questions={survey.questions}
        values={values}
        onChange={setValues}
        disabled={submitting}
      />

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Send className="mr-1 size-3.5" />
          )}
          Submit
        </Button>
      </div>
    </div>
  );
}
