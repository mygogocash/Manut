import {
  SURVEY_QUESTION_TYPES,
  type SurveyQuestionInput,
  type SurveyQuestionType,
} from "@manut/app-core";
import { Button, colors, spacing, TextField } from "@manut/ui";
import { Pressable, Text, View } from "react-native";

/** Workable builder set: text / choice / rating (+ info/date/number for parity). */
export const BUILDER_QUESTION_TYPES: readonly SurveyQuestionType[] =
  SURVEY_QUESTION_TYPES;

const CHOICE_TYPES: ReadonlySet<SurveyQuestionType> = new Set([
  "single_choice",
  "multi_choice",
]);

export type QuestionDraft = {
  type: SurveyQuestionType;
  prompt: string;
  required: boolean;
  optionsText: string;
};

export function blankQuestionDraft(): QuestionDraft {
  return {
    type: "short_text",
    prompt: "",
    required: false,
    optionsText: "",
  };
}

export function draftsFromQuestions(
  questions: Array<{
    type: string;
    prompt: string;
    required: boolean;
    options: string[];
  }>,
): QuestionDraft[] {
  return questions.map((question) => ({
    type: (BUILDER_QUESTION_TYPES.includes(
      question.type as SurveyQuestionType,
    )
      ? question.type
      : "short_text") as SurveyQuestionType,
    prompt: question.prompt,
    required: question.required,
    optionsText: question.options.join("\n"),
  }));
}

export function draftsToQuestionInputs(
  drafts: QuestionDraft[],
): SurveyQuestionInput[] {
  return drafts.map((draft) => ({
    type: draft.type,
    prompt: draft.prompt,
    required: draft.required,
    options: CHOICE_TYPES.has(draft.type)
      ? draft.optionsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [],
    helperText: null,
    settings: {},
  }));
}

function cycleType(current: SurveyQuestionType): SurveyQuestionType {
  const index = BUILDER_QUESTION_TYPES.indexOf(current);
  const next = BUILDER_QUESTION_TYPES[(index + 1) % BUILDER_QUESTION_TYPES.length];
  return next ?? "short_text";
}

type SurveyQuestionListEditorProps = {
  drafts: QuestionDraft[];
  onChange: (next: QuestionDraft[]) => void;
  disabled?: boolean;
};

export function SurveyQuestionListEditor({
  drafts,
  onChange,
  disabled = false,
}: SurveyQuestionListEditorProps) {
  function update(index: number, patch: Partial<QuestionDraft>) {
    onChange(
      drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= drafts.length) return;
    const copy = [...drafts];
    const current = copy[index];
    const swap = copy[nextIndex];
    if (!current || !swap) return;
    copy[index] = swap;
    copy[nextIndex] = current;
    onChange(copy);
  }

  function remove(index: number) {
    onChange(drafts.filter((_, i) => i !== index));
  }

  return (
    <View style={{ gap: spacing.md }}>
      {drafts.length === 0 ? (
        <Text selectable style={{ color: colors.textMuted }}>
          No questions yet. Add a text, choice, or rating question, then save.
        </Text>
      ) : null}

      {drafts.map((draft, index) => {
        const n = index + 1;
        const isChoice = CHOICE_TYPES.has(draft.type);
        return (
          <View
            key={`question-${index}`}
            style={{
              gap: spacing.sm,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text selectable style={{ fontWeight: "600", color: colors.text }}>
              Question {n}
            </Text>
            <TextField
              label={`Question ${n} prompt`}
              value={draft.prompt}
              onChangeText={(prompt) => update(index, { prompt })}
              editable={!disabled}
              autoCapitalize="sentences"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Question ${n} type`}
              disabled={disabled}
              onPress={() => {
                const nextType = cycleType(draft.type);
                update(index, {
                  type: nextType,
                  optionsText: CHOICE_TYPES.has(nextType)
                    ? draft.optionsText
                    : "",
                });
              }}
            >
              <Text style={{ color: colors.text }}>
                Type: {draft.type} (tap to change)
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Question ${n} required`}
              accessibilityState={{ checked: draft.required }}
              disabled={disabled}
              onPress={() => update(index, { required: !draft.required })}
            >
              <Text style={{ color: colors.text }}>
                {draft.required ? "☑" : "☐"} Required
              </Text>
            </Pressable>
            {isChoice ? (
              <TextField
                label={`Question ${n} options`}
                value={draft.optionsText}
                onChangeText={(optionsText) => update(index, { optionsText })}
                editable={!disabled}
                multiline
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            ) : null}
            {isChoice ? (
              <Text selectable style={{ color: colors.textMuted }}>
                One option per line (at least two).
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Button
                label="Move up"
                pendingLabel="Working…"
                accessibilityLabel={`Question ${n} move up`}
                onPress={() => move(index, -1)}
                disabled={disabled || index === 0}
              />
              <Button
                label="Move down"
                pendingLabel="Working…"
                accessibilityLabel={`Question ${n} move down`}
                onPress={() => move(index, 1)}
                disabled={disabled || index === drafts.length - 1}
              />
              <Button
                label="Remove"
                pendingLabel="Working…"
                accessibilityLabel={`Question ${n} remove`}
                onPress={() => remove(index)}
                disabled={disabled}
              />
            </View>
          </View>
        );
      })}

      <Button
        label="Add question"
        pendingLabel="Working…"
        accessibilityLabel="Add question"
        onPress={() => onChange([...drafts, blankQuestionDraft()])}
        disabled={disabled}
      />
    </View>
  );
}
