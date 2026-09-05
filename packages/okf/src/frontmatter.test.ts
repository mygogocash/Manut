import { describe, expect, it } from "vitest";

import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("extracts a frontmatter block and the body after it", () => {
    const source = [
      "---",
      "type: Pitfall",
      "title: Express route order",
      "---",
      "",
      "# Body heading",
      "",
      "Prose.",
      "",
    ].join("\n");

    const result = parseFrontmatter(source);

    expect(result.frontmatter).toEqual({
      type: "Pitfall",
      title: "Express route order",
    });
    expect(result.body).toContain("# Body heading");
    expect(result.body).not.toContain("type: Pitfall");
  });

  it("returns null frontmatter when the document has no block", () => {
    const result = parseFrontmatter("# Just a heading\n\nProse.\n");

    expect(result.frontmatter).toBeNull();
    expect(result.body).toContain("# Just a heading");
  });

  it("returns null frontmatter when --- appears but not at position 0", () => {
    const result = parseFrontmatter("Intro paragraph.\n\n---\n\nA horizontal rule.\n");

    expect(result.frontmatter).toBeNull();
  });

  it("parses nested objects and lists", () => {
    const source = [
      "---",
      "type: Prisma Model",
      "tags: [comms, aria]",
      "generated:",
      "  by: okf-gen/schema",
      "  at: 2026-08-17T00:00:00Z",
      "---",
      "body",
      "",
    ].join("\n");

    const result = parseFrontmatter(source);

    expect(result.frontmatter).toMatchObject({
      tags: ["comms", "aria"],
      generated: { by: "okf-gen/schema" },
    });
  });

  it("throws a descriptive error on malformed YAML", () => {
    const source = ["---", "type: [unclosed", "---", "body", ""].join("\n");

    expect(() => parseFrontmatter(source)).toThrow(/frontmatter/i);
  });
});
