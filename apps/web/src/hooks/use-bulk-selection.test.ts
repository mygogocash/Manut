import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useBulkSelection } from "@/hooks/use-bulk-selection";

describe("useBulkSelection", () => {
  it("starts inactive", () => {
    const { result } = renderHook(() => useBulkSelection(214));
    expect(result.current.active).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("toggles individual rows", () => {
    const { result } = renderHook(() => useBulkSelection(214));
    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("b"));
    expect(result.current.ids).toEqual(["a", "b"]);
    expect(result.current.count).toBe(2);
    act(() => result.current.toggle("a"));
    expect(result.current.ids).toEqual(["b"]);
    expect(result.current.isSelected("a")).toBe(false);
  });

  it("counts the SERVER total for allMatching, not the loaded rows", () => {
    // The pitfall this guards: a kanban column holds one page, so deriving the
    // count from memory would understate it.
    const { result } = renderHook(() => useBulkSelection(214));
    act(() => result.current.toggle("a"));
    act(() => result.current.selectAllMatching());
    expect(result.current.allMatching).toBe(true);
    expect(result.current.count).toBe(214);
    // Exactly one mode travels to the API.
    expect(result.current.ids).toEqual([]);
  });

  it("drops back to explicit ids when a row is ticked after allMatching", () => {
    const { result } = renderHook(() => useBulkSelection(214));
    act(() => result.current.selectAllMatching());
    act(() => result.current.toggle("a"));
    expect(result.current.allMatching).toBe(false);
    expect(result.current.count).toBe(1);
  });

  it("toggles a whole visible group without duplicating", () => {
    const { result } = renderHook(() => useBulkSelection(10));
    act(() => result.current.toggle("a"));
    act(() => result.current.toggleMany(["a", "b", "c"], true));
    expect(result.current.ids.sort()).toEqual(["a", "b", "c"]);
    act(() => result.current.toggleMany(["a", "b"], false));
    expect(result.current.ids).toEqual(["c"]);
  });

  it("clears everything", () => {
    const { result } = renderHook(() => useBulkSelection(10));
    act(() => result.current.selectAllMatching());
    act(() => result.current.clear());
    expect(result.current.active).toBe(false);
    expect(result.current.allMatching).toBe(false);
    expect(result.current.ids).toEqual([]);
  });
});
