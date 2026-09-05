import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateBusinessUnitCache,
  labelForBusinessUnitCode,
  useBusinessUnits,
  variantForBusinessUnitCode,
} from "@/hooks/use-business-units";
import { listBusinessUnits } from "@/services/crm-business-unit.service";

vi.mock("@/services/crm-business-unit.service", () => ({
  listBusinessUnits: vi.fn(),
  // The hook special-cases this sentinel, so the mock has to carry it — a
  // partial factory would hand the hook `undefined` and the comparison would
  // silently never match.
  BUSINESS_UNIT_UNASSIGNED: "__none__",
}));

const mockList = vi.mocked(listBusinessUnits);

const UNITS = [
  {
    id: "bu-1",
    code: "onewave",
    label: "Onewave",
    color: "blue",
    isSystem: false,
    isActive: true,
    sortOrder: 10,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "bu-2",
    code: "aria",
    label: "ARIA",
    // Not a Badge variant — an admin could have hand-written anything, or a
    // future variant could be removed from the palette.
    color: "chartreuse",
    isSystem: false,
    isActive: true,
    sortOrder: 20,
    createdAt: "",
    updatedAt: "",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  invalidateBusinessUnitCache();
  mockList.mockResolvedValue({ data: UNITS } as Awaited<
    ReturnType<typeof listBusinessUnits>
  >);
});

describe("resolvers before the cache loads", () => {
  it("falls back to the raw code for a label", () => {
    expect(labelForBusinessUnitCode("onewave")).toBe("onewave");
  });

  it("falls back to grey for a colour", () => {
    expect(variantForBusinessUnitCode("onewave")).toBe("grey");
  });
});

describe("resolvers after the cache loads", () => {
  it("resolves labels and colours, and keeps raw codes for deleted units", async () => {
    const { result } = renderHook(() => useBusinessUnits());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(labelForBusinessUnitCode("onewave")).toBe("Onewave");
    expect(variantForBusinessUnitCode("onewave")).toBe("blue");
    // A record can outlive its unit — render the code rather than nothing.
    expect(labelForBusinessUnitCode("retired-unit")).toBe("retired-unit");
    expect(variantForBusinessUnitCode("retired-unit")).toBe("grey");
  });

  it("clamps an unrecognised stored colour to grey", async () => {
    const { result } = renderHook(() => useBusinessUnits());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(variantForBusinessUnitCode("aria")).toBe("grey");
  });
});

describe("the Unassigned sentinel", () => {
  // Verified on staging: every untagged deal's card rendered the chip
  // "__none__" verbatim. The per-business-unit board gives an untagged deal
  // one card carrying this sentinel, and the sentinel has no catalog row, so
  // the raw-code fallback surfaced it.
  it("resolves to a readable label before the cache loads", () => {
    expect(labelForBusinessUnitCode("__none__")).toBe("Unassigned");
  });

  it("resolves to a readable label after the cache loads", async () => {
    const { result } = renderHook(() => useBusinessUnits());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(labelForBusinessUnitCode("__none__")).toBe("Unassigned");
  });

  it("still shows a DELETED unit's raw code", () => {
    // The sentinel is special-cased; a real code whose unit an admin removed
    // must keep rendering as itself rather than vanishing or being relabelled.
    expect(labelForBusinessUnitCode("retired-unit")).toBe("retired-unit");
  });
});

describe("caching", () => {
  it("fetches once for many consumers", async () => {
    const first = renderHook(() => useBusinessUnits());
    const second = renderHook(() => useBusinessUnits());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after an admin edit invalidates the cache", async () => {
    const { result, unmount } = renderHook(() => useBusinessUnits());
    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();

    invalidateBusinessUnitCache();
    const next = renderHook(() => useBusinessUnits());
    await waitFor(() => expect(next.result.current.loading).toBe(false));

    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it("survives a failed fetch with an empty list instead of throwing", async () => {
    invalidateBusinessUnitCache();
    mockList.mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useBusinessUnits());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.units).toEqual([]);
  });

  it("asks for inactive rows too when the manager dialog needs them", async () => {
    const { result } = renderHook(() =>
      useBusinessUnits({ includeInactive: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockList).toHaveBeenCalledWith({ includeInactive: true });
  });
});
