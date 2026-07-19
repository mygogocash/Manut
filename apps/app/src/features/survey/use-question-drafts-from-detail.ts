import { useState, type Dispatch, type SetStateAction } from "react";

import {
  draftsFromQuestions,
  type QuestionDraft,
} from "./survey-question-list-editor";

type DetailWithQuestions = {
  questions: Parameters<typeof draftsFromQuestions>[0];
};

/** Align question drafts with loaded detail via render-time state adjust (not useEffect). */
export function useQuestionDraftsFromDetail(
  detail: DetailWithQuestions | undefined,
): [QuestionDraft[], Dispatch<SetStateAction<QuestionDraft[]>>] {
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [draftSource, setDraftSource] = useState<
    DetailWithQuestions | undefined
  >(undefined);

  if (detail !== undefined && detail !== draftSource) {
    setDraftSource(detail);
    setDrafts(draftsFromQuestions(detail.questions));
  }

  return [drafts, setDrafts];
}
