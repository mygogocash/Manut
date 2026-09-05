import type { AnswerMap } from "@/components/survey-forms/survey-form-renderer";

// Per-form, per-user autosave of in-progress survey answers, persisted to
// localStorage so a browser tab-switch, page refresh, or an AuthProvider
// visibility-return remount does not wipe what the respondent has typed.
// Mirrors the SSR-safe read/write pattern used by notification-bell.tsx
// (`seen-ids`): module-level namespaced key, `typeof window` guard, and a
// try/catch so quota / private-mode / malformed-data failures never break the
// form. The user id is part of the key to avoid leaking a draft to another
// account on a shared browser; anonymous is keyed under "anon".
const DRAFT_PREFIX = "nexora:survey:draft-v1:";

function draftKey(formId: string, userId: string | null): string {
  return `${DRAFT_PREFIX}${formId}:${userId ?? "anon"}`;
}

export function readSurveyDraft(
  formId: string,
  userId: string | null,
): AnswerMap | null {
  if (typeof window === "undefined") return null;
  if (!formId) return null;
  try {
    const raw = window.localStorage.getItem(draftKey(formId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    // Only a plain object is a valid answer map; anything else is discarded.
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return parsed as AnswerMap;
  } catch {
    return null;
  }
}

export function writeSurveyDraft(
  formId: string,
  userId: string | null,
  values: AnswerMap,
): void {
  if (typeof window === "undefined") return;
  if (!formId) return;
  try {
    window.localStorage.setItem(
      draftKey(formId, userId),
      JSON.stringify(values),
    );
  } catch {
    // Quota / private-mode write failures must not break the form.
  }
}

export function clearSurveyDraft(formId: string, userId: string | null): void {
  if (typeof window === "undefined") return;
  if (!formId) return;
  try {
    window.localStorage.removeItem(draftKey(formId, userId));
  } catch {
    // Ignore — a failed clear is harmless (the draft is overwritten on resubmit).
  }
}
