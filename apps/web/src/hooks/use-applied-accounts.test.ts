import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppliedAccounts } from "@/hooks/use-applied-accounts";

const ALL = ["gopay", "dialog", "okara"];

describe("useAppliedAccounts", () => {
  it("starts as every account, so the API picks the membership", () => {
    const { result } = renderHook(() => useAppliedAccounts());
    expect(result.current.applied).toBeNull();
    expect(result.current.isAll).toBe(true);
    expect(result.current.dirty).toBe(false);
  });

  // The whole point of the draft/applied split: unticking five boxes should
  // cost one request, not five.
  it("ticking boxes does not move the applied selection", () => {
    const { result } = renderHook(() => useAppliedAccounts());
    act(() => result.current.toggle("okara", ALL));
    expect(result.current.draft).toEqual(["gopay", "dialog"]);
    expect(result.current.applied).toBeNull();
    expect(result.current.dirty).toBe(true);

    act(() => result.current.apply());
    expect(result.current.applied).toEqual(["gopay", "dialog"]);
    expect(result.current.dirty).toBe(false);
  });

  // Re-checking everything must return the "all" shape, or the request would
  // enumerate every account and the label would read as a narrowed selection.
  it("collapses back to all when the selection becomes complete", () => {
    const { result } = renderHook(() => useAppliedAccounts());
    act(() => result.current.toggle("okara", ALL));
    expect(result.current.isAll).toBe(false);
    act(() => result.current.toggle("okara", ALL));
    expect(result.current.draft).toBeNull();
    expect(result.current.isAll).toBe(true);
  });

  // A total over no accounts is not a number, and the API rejects an empty list.
  it("refuses to remove the last remaining account", () => {
    const { result } = renderHook(() => useAppliedAccounts());
    act(() => result.current.selectOnly("gopay"));
    act(() => result.current.toggle("gopay", ALL));
    expect(result.current.draft).toEqual(["gopay"]);
  });

  it("selectOnly narrows to one account, still behind Apply", () => {
    const { result } = renderHook(() => useAppliedAccounts());
    act(() => result.current.selectOnly("dialog"));
    expect(result.current.draft).toEqual(["dialog"]);
    expect(result.current.applied).toBeNull();
  });

  it("dirty ignores order — the request is a set, not a sequence", () => {
    const { result } = renderHook(() => useAppliedAccounts());
    act(() => result.current.selectOnly("gopay"));
    act(() => result.current.toggle("dialog", ALL));
    act(() => result.current.apply());
    expect(result.current.applied).toEqual(["gopay", "dialog"]);

    // Uncheck then re-check gopay: same two accounts, opposite order.
    act(() => result.current.toggle("gopay", ALL));
    act(() => result.current.toggle("gopay", ALL));
    expect(result.current.draft).toEqual(["dialog", "gopay"]);
    expect(result.current.dirty).toBe(false);
  });

  // Reset is an explicit action, so leaving it unapplied would read as failure.
  it("reset returns to all and applies itself", () => {
    const { result } = renderHook(() => useAppliedAccounts());
    act(() => result.current.selectOnly("gopay"));
    act(() => result.current.apply());
    act(() => result.current.reset());
    expect(result.current.draft).toBeNull();
    expect(result.current.applied).toBeNull();
    expect(result.current.dirty).toBe(false);
  });
});

// ── Remembering the applied selection between visits ────────────

/** Per-method so the mock helpers (mockReturnValue) are visible to the types. */
const store = () => ({
  getItem: vi.mocked(window.localStorage.getItem),
  setItem: vi.mocked(window.localStorage.setItem),
  removeItem: vi.mocked(window.localStorage.removeItem),
});

describe("useAppliedAccounts persistence", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/dau-mau");
    store().getItem.mockReturnValue(null);
  });

  it("is hydrated immediately when nothing is being persisted", () => {
    const { result } = renderHook(() => useAppliedAccounts());
    expect(result.current.hydrated).toBe(true);
  });

  it("restores a remembered selection into the draft and the applied set", () => {
    store().getItem.mockReturnValue("gopay,dialog");
    const { result } = renderHook(() => useAppliedAccounts("k"));
    expect(result.current.applied).toEqual(["gopay", "dialog"]);
    expect(result.current.draft).toEqual(["gopay", "dialog"]);
    expect(result.current.isAll).toBe(false);
    expect(result.current.dirty).toBe(false);
    expect(result.current.hydrated).toBe(true);
  });

  it("stays on every account when nothing was remembered", () => {
    const { result } = renderHook(() => useAppliedAccounts("k"));
    expect(result.current.isAll).toBe(true);
    expect(result.current.applied).toBeNull();
  });

  it("remembers on apply, not on every checkbox", () => {
    const { result } = renderHook(() => useAppliedAccounts("k"));
    act(() => result.current.toggle("okara", ALL));
    expect(store().setItem).not.toHaveBeenCalled();

    act(() => result.current.apply());
    expect(store().setItem).toHaveBeenCalledWith("k", "gopay,dialog");
  });

  // "All" is the default, so it is stored as absence rather than an enumeration.
  it("clears storage when the selection returns to every account", () => {
    const { result } = renderHook(() => useAppliedAccounts("k"));
    act(() => result.current.selectOnly("gopay"));
    act(() => result.current.apply());
    act(() => result.current.selectAll());
    act(() => result.current.apply());
    expect(store().removeItem).toHaveBeenCalledWith("k");
  });

  it("forgets the selection on reset", () => {
    const { result } = renderHook(() => useAppliedAccounts("k"));
    act(() => result.current.selectOnly("gopay"));
    act(() => result.current.apply());
    act(() => result.current.reset());
    expect(store().removeItem).toHaveBeenCalledWith("k");
  });
});
