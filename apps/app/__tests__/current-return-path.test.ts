import { buildReturnPath } from "@/navigation/current-return-path";

describe("buildReturnPath", () => {
  it("retains query values while excluding dynamic route parameters", () => {
    expect(
      buildReturnPath(
        "/survey-forms/abc/respond",
        { id: "abc", tab: "answers", filter: ["open", "mine"] },
        ["survey-forms", "[id]", "respond"],
      ),
    ).toBe("/survey-forms/abc/respond?tab=answers&filter=open&filter=mine");
  });

  it("preserves a browser hash after the query string", () => {
    expect(
      buildReturnPath("/directory", { view: "teams" }, [], "#operations"),
    ).toBe("/directory?view=teams#operations");
  });
});
