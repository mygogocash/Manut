import { describe, expect, it } from "vitest";
import { chunkHandbookText, rankHandbookChunks } from "../src/lib/handbook";

describe("handbook chunking and fallback ranking", () => {
  it("splits long prose into passages", () => {
    const chunks = chunkHandbookText("First sentence. Second sentence. Third sentence.", 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ")).toContain("First sentence.");
  });

  it("returns an empty list for blank text", () => {
    expect(chunkHandbookText("   ")).toEqual([]);
  });

  it("ranks title and excerpt matches without Vectorize", () => {
    const ranked = rankHandbookChunks("leave policy", [
      { id: "1", sourceType: "policy", sourceId: "a", title: "Leave policy", excerpt: "How to request leave." },
      { id: "2", sourceType: "article", sourceId: "b", title: "Parking", excerpt: "Visitor parking rules." },
    ]);
    expect(ranked.map((row) => row.id)).toEqual(["1"]);
  });
});
