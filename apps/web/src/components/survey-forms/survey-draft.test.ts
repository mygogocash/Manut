import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSurveyDraft,
  readSurveyDraft,
  writeSurveyDraft,
} from "@/components/survey-forms/survey-draft";

const FORM = "form-1";
const USER = "user-1";
const KEY = `manut:survey:draft-v1:${FORM}:${USER}`;

// The global test setup (src/test/setup.ts) stubs window.localStorage with
// no-op vi.fn() mocks. Back them with a real in-memory Map so these tests
// exercise the helper's actual read/parse/write/clear behavior.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.mocked(window.localStorage.getItem).mockImplementation((k: string) =>
    store.has(k) ? (store.get(k) as string) : null,
  );
  vi.mocked(window.localStorage.setItem).mockImplementation(
    (k: string, v: string) => {
      store.set(k, String(v));
    },
  );
  vi.mocked(window.localStorage.removeItem).mockImplementation((k: string) => {
    store.delete(k);
  });
});

describe("survey-draft", () => {
  it("round-trips a written draft", () => {
    writeSurveyDraft(FORM, USER, { q1: "hello", q2: 4, q3: ["a", "b"] });
    expect(readSurveyDraft(FORM, USER)).toEqual({
      q1: "hello",
      q2: 4,
      q3: ["a", "b"],
    });
  });

  it("returns null when no draft is stored", () => {
    expect(readSurveyDraft(FORM, USER)).toBeNull();
  });

  it("returns null on malformed JSON instead of throwing", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(readSurveyDraft(FORM, USER)).toBeNull();
  });

  it("rejects a non-object payload (array / primitive)", () => {
    window.localStorage.setItem(KEY, JSON.stringify(["a", "b"]));
    expect(readSurveyDraft(FORM, USER)).toBeNull();
    window.localStorage.setItem(KEY, JSON.stringify(42));
    expect(readSurveyDraft(FORM, USER)).toBeNull();
  });

  it("clears a stored draft", () => {
    writeSurveyDraft(FORM, USER, { q1: "x" });
    expect(readSurveyDraft(FORM, USER)).not.toBeNull();
    clearSurveyDraft(FORM, USER);
    expect(readSurveyDraft(FORM, USER)).toBeNull();
  });

  it("isolates drafts per user so one account cannot read another's", () => {
    writeSurveyDraft(FORM, USER, { q1: "mine" });
    expect(readSurveyDraft(FORM, "user-2")).toBeNull();
  });

  it("keys an anonymous respondent under 'anon'", () => {
    writeSurveyDraft(FORM, null, { q1: "anon-answer" });
    expect(
      window.localStorage.getItem(`manut:survey:draft-v1:${FORM}:anon`),
    ).toBe(JSON.stringify({ q1: "anon-answer" }));
    expect(readSurveyDraft(FORM, null)).toEqual({ q1: "anon-answer" });
  });

  it("no-ops when the form id is empty", () => {
    writeSurveyDraft("", USER, { q1: "x" });
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
    expect(readSurveyDraft("", USER)).toBeNull();
  });
});
