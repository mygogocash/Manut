"use client";

import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/shared/badge";
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
import {
  QUESTION_TYPE_LABELS,
  type QuestionInput,
  type QuestionType,
} from "@/services/survey.service";

interface SurveyBuilderProps {
  questions: QuestionInput[];
  onChange: (next: QuestionInput[]) => void;
  disabled?: boolean;
}

const TYPE_OPTIONS: QuestionType[] = [
  "info",
  "short_text",
  "long_text",
  "single_choice",
  "multi_choice",
  "rating",
  "date",
  "number",
];

const CHOICE_TYPES: ReadonlyArray<QuestionType> = [
  "single_choice",
  "multi_choice",
];

function blankQuestion(): QuestionInput {
  return {
    type: "short_text",
    prompt: "",
    helperText: null,
    required: false,
    options: [],
    settings: {},
  };
}

export function SurveyBuilder({
  questions,
  onChange,
  disabled,
}: SurveyBuilderProps) {
  function update(idx: number, patch: Partial<QuestionInput>) {
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= questions.length) return;
    const copy = [...questions];
    [copy[idx], copy[next]] = [copy[next]!, copy[idx]!];
    onChange(copy);
  }

  function remove(idx: number) {
    onChange(questions.filter((_, i) => i !== idx));
  }

  function add() {
    onChange([...questions, blankQuestion()]);
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.length === 0 && (
        <div
          className={`
            text-muted-foreground rounded-md border border-dashed py-8
            text-center text-sm
          `}
        >
          No questions yet — click <strong>Add question</strong> to start.
        </div>
      )}

      {questions.map((q, idx) => (
        <QuestionRow
          key={idx}
          index={idx}
          total={questions.length}
          question={q}
          disabled={disabled}
          onChange={(patch) => update(idx, patch)}
          onMoveUp={() => move(idx, -1)}
          onMoveDown={() => move(idx, 1)}
          onRemove={() => remove(idx)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={add}
        disabled={disabled}
        className="self-start"
      >
        <Plus className="mr-1 size-3.5" /> Add question
      </Button>
    </div>
  );
}

function QuestionRow({
  index,
  total,
  question,
  disabled,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  total: number;
  question: QuestionInput;
  disabled?: boolean;
  onChange: (patch: Partial<QuestionInput>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const [draftOption, setDraftOption] = useState("");
  const isChoice = CHOICE_TYPES.includes(question.type);
  const isInfo = question.type === "info";

  function addOption() {
    const t = draftOption.trim();
    if (!t) return;
    if (question.options.includes(t)) return;
    onChange({ options: [...question.options, t] });
    setDraftOption("");
  }

  function removeOption(opt: string) {
    onChange({ options: question.options.filter((o) => o !== opt) });
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <Badge variant="grey" className="mt-1">
          {index + 1}
        </Badge>
        <div className="flex flex-1 flex-col gap-2">
          <Input
            placeholder={isInfo ? "Section title" : "Question prompt"}
            value={question.prompt}
            disabled={disabled}
            onChange={(e) => onChange({ prompt: e.target.value })}
          />
          <Textarea
            placeholder={
              isInfo ? "Instructions (optional)" : "Helper text (optional)"
            }
            rows={isInfo ? 2 : 1}
            value={question.helperText ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ helperText: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onMoveUp}
            disabled={disabled || index === 0}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onMoveDown}
            disabled={disabled || index === total - 1}
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRemove}
            disabled={disabled}
          >
            <Trash2 className="text-destructive size-3.5" />
          </Button>
        </div>
      </div>

      <div
        className={`
          grid grid-cols-2 gap-2
          sm:grid-cols-3
        `}
      >
        <div>
          <Label className="text-xs">Answer type</Label>
          <Select
            value={question.type}
            onValueChange={(v) => {
              const next = v as QuestionType;
              onChange({
                type: next,
                options: CHOICE_TYPES.includes(next) ? question.options : [],
                required: next === "info" ? false : question.required,
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!isInfo && (
          <div className="flex items-end gap-2">
            <Switch
              checked={question.required}
              onCheckedChange={(v) => onChange({ required: v })}
              disabled={disabled}
            />
            <Label className="text-xs">Required</Label>
          </div>
        )}
      </div>

      {isChoice && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Options</Label>
          <div className="flex flex-wrap gap-1.5">
            {question.options.map((o) => (
              <span
                key={o}
                className={`
                  bg-primary/10 inline-flex items-center gap-1 rounded-md px-2
                  py-0.5 text-xs
                `}
              >
                {o}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeOption(o)}
                    className="hover:text-destructive"
                    aria-label={`Remove ${o}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={draftOption}
              placeholder="New option…"
              disabled={disabled}
              onChange={(e) => setDraftOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOption}
              disabled={disabled || draftOption.trim().length === 0}
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {question.type === "rating" && (
        <Textarea
          rows={1}
          disabled
          value="Respondents pick a rating from 1 to 5."
          className="text-muted-foreground bg-muted/30 cursor-default text-xs"
        />
      )}
    </div>
  );
}
