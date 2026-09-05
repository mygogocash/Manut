import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateInvestorTagCache,
  labelForInvestorTag,
  useInvestorTags,
  variantForInvestorTag,
} from "@/hooks/use-investor-tags";
import { listInvestorTags } from "@/services/investor-tag.service";

vi.mock("@/services/investor-tag.service", () => ({
  listInvestorTags: vi.fn(),
  // The hook special-cases this sentinel; a partial factory would hand it
  // `undefined` and the "Untagged" comparison would silently never match.
  INVESTOR_TAG_UNTAGGED: "__none__",
}));

const mockList = vi.mocked(listInvestorTags);

const TAGS = [
  {
    id: "tag-1",
    code: "seed-checks",
    label: "Seed checks",
    color: "green",
    isSystem: false,
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "tag-2",
    code: "pre-seed",
    label: "Pre-seed",
    // Not a Badge variant — an admin can type anything into the manager.
    color: "chartreuse",
    isSystem: false,
    isActive: true,
    sortOrder: 20,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  invalidateInvestorTagCache();
  mockList.mockResolvedValue({ data: TAGS } as Awaited<
    ReturnType<typeof listInvestorTags>
  >);
});

describe("the module-level cache", () => {
  it("serves a second consumer without a second request", async () => {
    const first = renderHook(() => useInvestorTags());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(mockList).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useInvestorTags());
    await waitFor(() => expect(second.result.current.tags).toHaveLength(2));
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  /**
   * The trap this test exists for: a tag created from the manager dialog is
   * invisible in every picker until the cache is dropped, because
   * `fetchActiveTags` returns `cachedTags` before it ever hits the network.
   * That reads to a user as "the save did not work".
   */
  it("refresh() drops the cache and refetches, picking up a new tag", async () => {
    const { result } = renderHook(() => useInvestorTags());
    await waitFor(() => expect(result.current.tags).toHaveLength(2));

    const withNewTag = [
      ...TAGS,
      {
        id: "tag-3",
        code: "series-a",
        label: "Series A",
        color: "blue",
        isSystem: false,
        isActive: true,
        sortOrder: 30,
      },
    ];
    mockList.mockResolvedValue({ data: withNewTag } as Awaited<
      ReturnType<typeof listInvestorTags>
    >);

    await result.current.refresh();

    await waitFor(() => expect(result.current.tags).toHaveLength(3));
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(labelForInvestorTag("series-a")).toBe("Series A");
  });

  it("without refresh, a stale cache keeps hiding the new tag", async () => {
    // The negative half of the pair: this is what the UI does when a caller
    // forgets to wire `onChanged`, and it is why the manager dialog's callback
    // is not optional in practice.
    const { result } = renderHook(() => useInvestorTags());
    await waitFor(() => expect(result.current.tags).toHaveLength(2));

    mockList.mockResolvedValue({
      data: [...TAGS, { ...TAGS[0], id: "tag-3", code: "series-a" }],
    } as Awaited<ReturnType<typeof listInvestorTags>>);

    const second = renderHook(() => useInvestorTags());
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.tags).toHaveLength(2);
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});

describe("resolvers", () => {
  it("falls back to the raw code before the cache loads", () => {
    expect(labelForInvestorTag("seed-checks")).toBe("seed-checks");
    expect(variantForInvestorTag("seed-checks")).toBe("grey");
  });

  it("resolves label and Badge variant once loaded", async () => {
    const { result } = renderHook(() => useInvestorTags());
    await waitFor(() => expect(result.current.tags).toHaveLength(2));

    expect(labelForInvestorTag("seed-checks")).toBe("Seed checks");
    expect(variantForInvestorTag("seed-checks")).toBe("green");
  });

  it("falls back to grey for a colour outside the Badge palette", async () => {
    // Stored colours are Badge variant NAMES so the classes survive Tailwind's
    // static scan; anything else must not reach a class string.
    const { result } = renderHook(() => useInvestorTags());
    await waitFor(() => expect(result.current.tags).toHaveLength(2));

    expect(variantForInvestorTag("pre-seed")).toBe("grey");
  });

  it("names the reserved sentinel Untagged", () => {
    expect(labelForInvestorTag("__none__")).toBe("Untagged");
  });
});
