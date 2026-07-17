import { describe, expect, it } from "vitest";

import { sanitizeRichHtml } from "@/lib/utils";

describe("sanitizeRichHtml", () => {
  it("returns empty string for falsy input", () => {
    expect(sanitizeRichHtml("")).toBe("");
  });

  it("strips <script> tags", () => {
    const out = sanitizeRichHtml("<p>hi</p><script>alert(1)</script>");
    expect(out).not.toContain("<script");
    expect(out).toContain("<p>hi</p>");
  });

  it("strips inline event handlers (the Quill HTML-export XSS vector)", () => {
    const out = sanitizeRichHtml('<img src="x" onerror="alert(1)" />');
    expect(out.toLowerCase()).not.toContain("onerror");
  });

  it("strips javascript: hrefs", () => {
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("drops disallowed tags like <iframe>", () => {
    const out = sanitizeRichHtml('<iframe src="https://evil.test"></iframe>');
    expect(out.toLowerCase()).not.toContain("<iframe");
  });

  it("keeps safe formatting + https links + images", () => {
    const out = sanitizeRichHtml(
      '<p><strong>bold</strong> <a href="https://ok.test">link</a></p>' +
        '<img src="https://ok.test/i.png" alt="i" />',
    );
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain('href="https://ok.test"');
    expect(out).toContain('src="https://ok.test/i.png"');
  });

  it("keeps Quill inline color/align styles", () => {
    const out = sanitizeRichHtml(
      '<p style="text-align:center"><span style="color:#ff0000">x</span></p>',
    );
    expect(out).toContain("text-align");
    expect(out).toContain("color");
  });
});
