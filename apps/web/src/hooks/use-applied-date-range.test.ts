import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppliedDateRange } from "@/hooks/use-applied-date-range";

describe("useAppliedDateRange", () => {
  it("starts clean and empty, so the API picks the window", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    expect(result.current.appliedFrom).toBe("");
    expect(result.current.appliedTo).toBe("");
    expect(result.current.dirty).toBe(false);
    expect(result.current.isSet).toBe(false);
  });

  it("editing the draft does not move the applied range", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => result.current.setDraftFrom("2026-08-01"));
    // The whole point: no fetch input changed, so nothing refetches.
    expect(result.current.draftFrom).toBe("2026-08-01");
    expect(result.current.appliedFrom).toBe("");
    expect(result.current.dirty).toBe(true);
  });

  it("apply promotes both ends at once", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => {
      result.current.setDraftFrom("2026-08-01");
      result.current.setDraftTo("2026-08-17");
    });
    act(() => result.current.apply());
    expect(result.current.appliedFrom).toBe("2026-08-01");
    expect(result.current.appliedTo).toBe("2026-08-17");
    expect(result.current.dirty).toBe(false);
  });

  it("a half-set range stays half-set until applied, never fetched piecemeal", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => result.current.setDraftFrom("2026-08-01"));
    expect(result.current.appliedTo).toBe("");
    expect(result.current.appliedFrom).toBe("");
    act(() => result.current.setDraftTo("2026-08-17"));
    expect(result.current.appliedFrom).toBe("");
    act(() => result.current.apply());
    expect([result.current.appliedFrom, result.current.appliedTo]).toEqual([
      "2026-08-01",
      "2026-08-17",
    ]);
  });

  it("re-applying an unchanged draft is a no-op", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => result.current.setDraftFrom("2026-08-01"));
    act(() => result.current.apply());
    const before = result.current.appliedFrom;
    act(() => result.current.apply());
    expect(result.current.appliedFrom).toBe(before);
    expect(result.current.dirty).toBe(false);
  });

  it("clearing a date is itself a change that needs applying", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => result.current.setDraftFrom("2026-08-01"));
    act(() => result.current.apply());
    act(() => result.current.setDraftFrom(""));
    expect(result.current.dirty).toBe(true);
    expect(result.current.appliedFrom).toBe("2026-08-01");
    act(() => result.current.apply());
    expect(result.current.appliedFrom).toBe("");
  });

  it("reset clears both halves and applies itself", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => {
      result.current.setDraftFrom("2026-08-01");
      result.current.setDraftTo("2026-08-17");
    });
    act(() => result.current.apply());
    act(() => result.current.reset());
    expect(result.current.draftFrom).toBe("");
    expect(result.current.appliedTo).toBe("");
    // Not left pending behind the button the user just pressed.
    expect(result.current.dirty).toBe(false);
    expect(result.current.isSet).toBe(false);
  });

  it("reset also discards an unapplied draft", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => result.current.setDraftTo("2026-08-17"));
    act(() => result.current.reset());
    expect(result.current.draftTo).toBe("");
    expect(result.current.dirty).toBe(false);
  });

  it("isSet covers a draft the user has not applied yet", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => result.current.setDraftFrom("2026-08-01"));
    // Reset must be reachable before Apply, or a mistyped date is a dead end.
    expect(result.current.isSet).toBe(true);
  });

  it("honours an initial range and treats it as already applied", () => {
    const { result } = renderHook(() =>
      useAppliedDateRange("2026-08-01", "2026-08-17"),
    );
    expect(result.current.appliedFrom).toBe("2026-08-01");
    expect(result.current.dirty).toBe(false);
    expect(result.current.isSet).toBe(true);
  });
});

describe("useAppliedDateRange — setRange (preset picks)", () => {
  it("moves draft and applied together, leaving nothing pending", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => result.current.setRange("2026-07-18", "2026-08-17"));
    expect(result.current.draftFrom).toBe("2026-07-18");
    expect(result.current.appliedFrom).toBe("2026-07-18");
    expect(result.current.appliedTo).toBe("2026-08-17");
    expect(result.current.dirty).toBe(false);
  });

  it("discards an unapplied draft rather than half-applying it", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    act(() => result.current.setDraftFrom("2026-01-01"));
    act(() => result.current.setRange("2026-07-18", "2026-08-17"));
    expect(result.current.draftFrom).toBe("2026-07-18");
    expect(result.current.dirty).toBe(false);
  });

  it("is not the stale-closure trap that setDraft-then-apply is", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    // setDraftFrom + apply in ONE act applies the previous draft, because
    // apply closes over the render's state. setRange is the fix, and this
    // pins the difference so nobody 'simplifies' it back.
    act(() => {
      result.current.setDraftFrom("2026-07-18");
      result.current.apply();
    });
    expect(result.current.appliedFrom).toBe("");
    act(() => result.current.setRange("2026-07-18", "2026-08-17"));
    expect(result.current.appliedFrom).toBe("2026-07-18");
  });
});

// ── Remembering the applied range between visits ────────────────

/** Per-method so the mock helpers (mockReturnValue) are visible to the types. */
const store = () => ({
  getItem: vi.mocked(window.localStorage.getItem),
  setItem: vi.mocked(window.localStorage.setItem),
  removeItem: vi.mocked(window.localStorage.removeItem),
});

describe("useAppliedDateRange persistence", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/dau-mau");
    // clearAllMocks keeps a mockReturnValue, so reset it per test.
    store().getItem.mockReturnValue(null);
  });

  // Existing callers pass no key and must be unaffected, including not having
  // to wait on hydration they never asked for.
  it("is hydrated immediately when nothing is being persisted", () => {
    const { result } = renderHook(() => useAppliedDateRange());
    expect(result.current.hydrated).toBe(true);
  });

  it("hydrates with the defaults when nothing was remembered", () => {
    const { result } = renderHook(() => useAppliedDateRange("", "", "k"));
    expect(result.current.hydrated).toBe(true);
    expect(result.current.appliedFrom).toBe("");
    expect(result.current.appliedTo).toBe("");
  });

  // A remembered range is already a decision, so it lands on BOTH the pickers
  // and the request — leaving it behind Apply would show one window while the
  // pickers claimed another.
  it("restores a remembered range into the draft and the applied range", () => {
    store().getItem.mockReturnValue(
      JSON.stringify({ from: "2026-08-01", to: "2026-08-31" }),
    );
    const { result } = renderHook(() => useAppliedDateRange("", "", "k"));
    expect(result.current.appliedFrom).toBe("2026-08-01");
    expect(result.current.appliedTo).toBe("2026-08-31");
    expect(result.current.draftFrom).toBe("2026-08-01");
    expect(result.current.draftTo).toBe("2026-08-31");
    // Restored, therefore already applied — not a pending change.
    expect(result.current.dirty).toBe(false);
    expect(result.current.hydrated).toBe(true);
  });

  it("remembers the range on apply, not on every keystroke", () => {
    const { result } = renderHook(() => useAppliedDateRange("", "", "k"));
    act(() => result.current.setDraftFrom("2026-08-01"));
    expect(store().setItem).not.toHaveBeenCalled();

    act(() => result.current.apply());
    expect(store().setItem).toHaveBeenCalledWith(
      "k",
      JSON.stringify({ from: "2026-08-01", to: "" }),
    );
  });

  it("forgets the range on reset, so the reset survives the next visit", () => {
    const { result } = renderHook(() => useAppliedDateRange("", "", "k"));
    act(() => result.current.setRange("2026-08-01", "2026-08-31"));
    act(() => result.current.reset());
    expect(store().removeItem).toHaveBeenCalledWith("k");
  });
});
