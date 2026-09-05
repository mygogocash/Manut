import { describe, expect, it } from "vitest";

import { mergeStoredColumnOrder } from "@/components/shared/use-column-order";

// The Project CRM default order, which regained "revGoLive" on 2026-08-14
// after it was dropped two weeks earlier. Layouts stored while the column
// was absent are the case that matters here.
const PROJECT_ORDER = [
  "project",
  "status",
  "productionLive",
  "goLive",
  "revGoLive",
  "agreement",
  "dependency",
  "comment",
  "owner",
] as const;

const WITHOUT_REV = PROJECT_ORDER.filter((k) => k !== "revGoLive");

describe("mergeStoredColumnOrder", () => {
  it("returns the default order when nothing was stored", () => {
    expect(mergeStoredColumnOrder([], PROJECT_ORDER)).toEqual([
      ...PROJECT_ORDER,
    ]);
  });

  it("keeps a stored layout untouched when it already has every key", () => {
    const order = [
      "owner",
      "project",
      "status",
      "goLive",
      "revGoLive",
    ] as const;
    expect(mergeStoredColumnOrder([...order], order)).toEqual([...order]);
  });

  it("drops keys the table no longer defines", () => {
    expect(
      mergeStoredColumnOrder(
        ["project", "department", "status"],
        ["project", "status"] as const,
      ),
    ).toEqual(["project", "status"]);
  });

  it("splices a restored column into its default slot, not the end", () => {
    const merged = mergeStoredColumnOrder([...WITHOUT_REV], PROJECT_ORDER);
    expect(merged).toEqual([...PROJECT_ORDER]);
    // The point of the exercise: between GoLive and Agreement, never past Owner.
    expect(merged.indexOf("revGoLive")).toBe(merged.indexOf("goLive") + 1);
    expect(merged.at(-1)).toBe("owner");
  });

  it("anchors on the nearest predecessor when a follower was dragged forward", () => {
    // Owner dragged to the front. Anchoring on the first *following* key
    // would put revGoLive at index 0, right off the user's dragged column.
    const stored = ["owner", ...WITHOUT_REV.filter((k) => k !== "owner")];
    expect(mergeStoredColumnOrder(stored, PROJECT_ORDER)).toEqual([
      "owner",
      "project",
      "status",
      "productionLive",
      "goLive",
      "revGoLive",
      "agreement",
      "dependency",
      "comment",
    ]);
  });

  it("stays put when a predecessor was dragged to the back", () => {
    // Comment pulled to the front, Status pushed to the back. Anchoring on
    // the *last* preceding key would make revGoLive chase Status to the end.
    const stored = [
      "comment",
      "project",
      "productionLive",
      "goLive",
      "agreement",
      "dependency",
      "owner",
      "status",
    ];
    const merged = mergeStoredColumnOrder(stored, PROJECT_ORDER);
    expect(merged.filter((k) => k !== "revGoLive")).toEqual(stored);
    expect(merged.indexOf("revGoLive")).toBe(merged.indexOf("goLive") + 1);
  });

  it("inserts a leading newcomer at the front", () => {
    expect(
      mergeStoredColumnOrder(
        ["status", "goLive"],
        ["project", "status", "goLive"] as const,
      ),
    ).toEqual(["project", "status", "goLive"]);
  });

  it("ignores non-string junk in storage", () => {
    expect(
      mergeStoredColumnOrder(
        [null, "status", 42, "project"],
        ["project", "status"] as const,
      ),
    ).toEqual(["status", "project"]);
  });
});
