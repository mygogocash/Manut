import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvestorTagsManagerDialog } from "@/components/investor-crm/investor-tags-manager-dialog";
import { listInvestorTags } from "@/services/investor-tag.service";

vi.mock("@/services/investor-tag.service", () => ({
  listInvestorTags: vi.fn(),
  createInvestorTag: vi.fn(),
  updateInvestorTag: vi.fn(),
  deleteInvestorTag: vi.fn(),
  investorTagUsage: vi.fn(),
  reorderInvestorTags: vi.fn(),
  INVESTOR_TAG_COLORS: ["grey", "green", "gold", "teal"],
}));

const mockList = vi.mocked(listInvestorTags);

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({
    data: [
      {
        id: "tag-1",
        code: "seed-checks",
        label: "Seed checks",
        color: "gold",
        isSystem: false,
        isActive: true,
        sortOrder: 10,
      },
    ],
  } as Awaited<ReturnType<typeof listInvestorTags>>);
});

describe("InvestorTagsManagerDialog width", () => {
  /**
   * The bug this pins: `DialogContent`'s base class ends in `sm:max-w-sm`, so
   * at >=640px a BARE `max-w-2xl` on the caller loses to that variant and is
   * dead CSS. The dialog then rendered at 384px while one tag row needs
   * ~630px, pushing the colour select and the delete button behind a
   * horizontal scrollbar.
   *
   * Asserted on the breakpoint prefix rather than on a specific size, because
   * the failure mode is "the override silently does nothing", not "the number
   * is wrong". Any `sm:max-w-*` beats the base; no bare `max-w-*` does.
   */
  it("overrides the base width at the sm breakpoint, not with a bare utility", async () => {
    render(<InvestorTagsManagerDialog open onOpenChange={() => {}} />);

    const title = await screen.findByText("Tag management");
    const content = title.closest("[data-slot='dialog-content']");
    expect(content).not.toBeNull();

    const classes = content!.className;

    /*
     * Asserted as the ABSENCE of the base clamp, not the presence of an
     * `sm:max-w-*` class. `cn()` is tailwind-merge: given a bare `max-w-2xl`
     * it keeps BOTH that and the base `sm:max-w-sm` (different variant, so no
     * conflict to resolve), and a "contains sm:max-w-" assertion then matches
     * the base and passes on the broken code. Only a same-variant override
     * makes twMerge drop `sm:max-w-sm`, so its absence is the real signal.
     */
    expect(
      classes,
      `bare max-w-* loses to the base sm:max-w-sm at >=640px; use sm:max-w-*. Got: ${classes}`,
    ).not.toMatch(/(?:^|\s)sm:max-w-sm(?:\s|$)/);
  });

  it("renders the catalog rows it was opened to manage", async () => {
    render(<InvestorTagsManagerDialog open onOpenChange={() => {}} />);

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(await screen.findByText("Seed checks")).toBeDefined();
    expect(await screen.findByText("seed-checks")).toBeDefined();
  });
});
