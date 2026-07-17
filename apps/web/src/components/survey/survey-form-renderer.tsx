"use client";

import { Star } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SurveyQuestion } from "@/services/survey.service";

export type AnswerMap = Record<string, unknown>;

interface SurveyRendererProps {
  questions: SurveyQuestion[];
  values: AnswerMap;
  onChange: (next: AnswerMap) => void;
  disabled?: boolean;
}

export function SurveyRenderer({
  questions,
  values,
  onChange,
  disabled,
}: SurveyRendererProps) {
  function set(qid: string, value: unknown) {
    onChange({ ...values, [qid]: value });
  }

  let questionNumber = 0;

  return (
    <div className="flex flex-col gap-5">
      {questions.map((q) => {
        if (q.type === "info") {
          return (
            <div
              key={q.id}
              className="border-border bg-muted/20 rounded-md border px-4 py-3"
            >
              <p className="text-foreground text-sm font-semibold">
                {q.prompt}
              </p>
              {q.helperText && (
                <p
                  className={`
                    text-muted-foreground mt-1 text-xs whitespace-pre-line
                  `}
                >
                  {q.helperText}
                </p>
              )}
            </div>
          );
        }

        questionNumber += 1;

        return (
          <div key={q.id} className="bg-card rounded-md border p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground text-xs">
                {questionNumber}.
              </span>
              <Label className="text-sm font-medium">
                {q.prompt}
                {q.required && <span className="text-destructive"> *</span>}
              </Label>
            </div>
            {q.helperText && (
              <p className="text-muted-foreground mt-1 text-xs">
                {q.helperText}
              </p>
            )}
            <div className="mt-3">
              {q.type === "short_text" && (
                <Input
                  value={String(values[q.id] ?? "")}
                  onChange={(e) => set(q.id, e.target.value)}
                  disabled={disabled}
                />
              )}
              {q.type === "long_text" && (
                <Textarea
                  rows={6}
                  value={String(values[q.id] ?? "")}
                  onChange={(e) => set(q.id, e.target.value)}
                  disabled={disabled}
                  placeholder="Write your answer here…"
                />
              )}
              {q.type === "single_choice" && (
                <div className="flex flex-col gap-2">
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      className={`
                        hover:bg-muted/50
                        flex cursor-pointer items-center gap-2 rounded-md p-2
                        text-sm
                      `}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={values[q.id] === opt}
                        onChange={() => set(q.id, opt)}
                        disabled={disabled}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
              {q.type === "multi_choice" && (
                <div className="flex flex-col gap-2">
                  {q.options.map((opt) => {
                    const arr = Array.isArray(values[q.id])
                      ? (values[q.id] as string[])
                      : [];
                    const checked = arr.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={`
                          hover:bg-muted/50
                          flex cursor-pointer items-center gap-2 rounded-md p-2
                          text-sm
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            set(
                              q.id,
                              checked
                                ? arr.filter((v) => v !== opt)
                                : [...arr, opt],
                            )
                          }
                          disabled={disabled}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              )}
              {q.type === "rating" && (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active =
                      typeof values[q.id] === "number" &&
                      (values[q.id] as number) >= n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => set(q.id, n)}
                        disabled={disabled}
                        aria-label={`Rate ${n}`}
                        className={`
                          hover:bg-muted/50
                          rounded p-1
                        `}
                      >
                        <Star
                          className={`
                            size-5
                            ${
                              active
                                ? `fill-amber-400 text-amber-400`
                                : `text-muted-foreground`
                            }
                          `}
                        />
                      </button>
                    );
                  })}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {typeof values[q.id] === "number"
                      ? `${values[q.id] as number}/5`
                      : "—"}
                  </span>
                </div>
              )}
              {q.type === "date" && (
                <Input
                  type="date"
                  value={String(values[q.id] ?? "")}
                  onChange={(e) => set(q.id, e.target.value)}
                  disabled={disabled}
                />
              )}
              {q.type === "number" && (
                <Input
                  type="number"
                  value={
                    typeof values[q.id] === "number" ? String(values[q.id]) : ""
                  }
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    set(q.id, Number.isFinite(n) ? n : null);
                  }}
                  disabled={disabled}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
