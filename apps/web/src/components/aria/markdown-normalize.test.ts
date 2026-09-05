import { describe, expect, it } from "vitest";

import { normalizeAssistantMarkdown } from "@/components/aria/markdown-normalize";

describe("normalizeAssistantMarkdown", () => {
  it("inserts blank line before heading glued to previous sentence", () => {
    const input =
      "I will query the Sales CRM to examine accounts.## Executive Summary";
    const out = normalizeAssistantMarkdown(input);
    expect(out).toBe(
      "I will query the Sales CRM to examine accounts.\n\n## Executive Summary",
    );
  });

  it("promotes single newline before heading to blank line", () => {
    const input = "intro text\n## Heading";
    const out = normalizeAssistantMarkdown(input);
    expect(out).toBe("intro text\n\n## Heading");
  });

  it("leaves already-correct markdown untouched (idempotent)", () => {
    const input = "intro\n\n## Heading\n\nbody";
    expect(normalizeAssistantMarkdown(input)).toBe(input);
    // Double-pass returns the same string.
    expect(normalizeAssistantMarkdown(normalizeAssistantMarkdown(input))).toBe(
      input,
    );
  });

  it("handles every heading depth (# through ######)", () => {
    for (let depth = 1; depth <= 6; depth += 1) {
      const marker = "#".repeat(depth);
      const input = `text.${marker} Heading ${depth}`;
      const out = normalizeAssistantMarkdown(input);
      expect(out).toBe(`text.\n\n${marker} Heading ${depth}`);
    }
  });

  it("splits bullet list glued to text", () => {
    const input = "Findings:- one- two";
    const out = normalizeAssistantMarkdown(input);
    expect(out).toContain("Findings:\n- one");
  });

  it("does not split URL hashes (no space after #)", () => {
    const input = "see https://example.com/page#anchor for details";
    expect(normalizeAssistantMarkdown(input)).toBe(input);
  });

  it("returns empty string unchanged", () => {
    expect(normalizeAssistantMarkdown("")).toBe("");
  });
});
