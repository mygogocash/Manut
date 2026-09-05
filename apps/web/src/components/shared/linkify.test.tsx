import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Linkify, safeHref } from "./linkify";

describe("safeHref", () => {
  it("accepts http/https and returns an absolute href", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com/");
    expect(safeHref("http://example.com/path?q=1")).toBe(
      "http://example.com/path?q=1",
    );
  });

  it("treats a bare www. host as https", () => {
    expect(safeHref("www.example.com")).toBe("https://www.example.com/");
  });

  it("passes mailto through unchanged", () => {
    expect(safeHref("mailto:person@example.com")).toBe(
      "mailto:person@example.com",
    );
  });

  it("rejects javascript:/data: and non-URLs (returns null)", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHref("not a url")).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});

describe("Linkify", () => {
  it("turns a bare https URL into a safe anchor", () => {
    const { container } = render(
      <Linkify text="Cloud Architect https://cloud.google.com/learn/certification/cloud-architect/?gclid=abc123" />,
    );
    const a = container.querySelector("a");
    expect(a).not.toBeNull();
    expect(a?.getAttribute("href")).toBe(
      "https://cloud.google.com/learn/certification/cloud-architect/?gclid=abc123",
    );
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    // Surrounding text is preserved.
    expect(container.textContent).toContain("Cloud Architect ");
  });

  it("does NOT linkify a javascript: token — renders it as text", () => {
    const { container } = render(
      <Linkify text="click javascript:alert(1) now" />,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("click javascript:alert(1) now");
  });

  it("strips trailing punctuation from the linked href", () => {
    const { container } = render(
      <Linkify text="See https://example.com/docs, then stop." />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com/docs");
    // The comma stays as text, outside the anchor.
    expect(a?.textContent).toBe("https://example.com/docs");
    expect(container.textContent).toBe(
      "See https://example.com/docs, then stop.",
    );
  });

  it("renders plain text without any anchor when there is no URL", () => {
    const { container } = render(<Linkify text="just a normal answer" />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("just a normal answer");
  });
});
