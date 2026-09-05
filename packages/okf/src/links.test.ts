import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

import {
  extractBundleLinks,
  extractRelativeLinks,
  findBrokenLinks,
  findRelativeLinks,
  findUnreachableDocuments,
} from "./links";

describe("extractBundleLinks", () => {
  it("returns bundle-absolute link targets", () => {
    const body = "See [route order](/pitfalls/express-route-order.md) for detail.";
    expect(extractBundleLinks(body)).toEqual(["/pitfalls/express-route-order.md"]);
  });

  it("ignores external links, mailto links, bare anchors, and relative links", () => {
    const body = [
      "[external](https://example.com/x.md)",
      "[mailto](mailto:someone@example.com)",
      "[relative](../other/doc.md)",
      "[anchor](#section)",
    ].join("\n");
    expect(extractBundleLinks(body)).toEqual([]);
  });

  it("ignores links inside fenced code blocks", () => {
    const body = ["```md", "[fake](/patterns/does-not-exist.md)", "```", ""].join("\n");
    expect(extractBundleLinks(body)).toEqual([]);
  });
});

describe("extractRelativeLinks", () => {
  it("returns dot- and dot-dot-relative link targets", () => {
    const body = [
      "[sibling](./sibling.md)",
      "[parent](../patterns/foo.md)",
      "[absolute](/patterns/bar.md)",
      "[external](https://example.com/x.md)",
      "[anchor](#section)",
    ].join("\n");
    expect(extractRelativeLinks(body)).toEqual(["./sibling.md", "../patterns/foo.md"]);
  });

  it("returns the bare sibling-relative form (no leading ./ or ../)", () => {
    // The most idiomatic relative link — [x](approval-chain.md) — carries
    // neither a leading "./" nor "../", and GitHub renders it correctly. It
    // must be flagged exactly like the "./" and "../" spellings: it is not
    // bundle-absolute, not a bare anchor, and carries no URL scheme.
    const body = [
      "[bare-sibling](approval-chain.md)",
      "[bare-sibling-nested](patterns/approval-chain.md)",
      "[absolute](/patterns/bar.md)",
      "[external](https://example.com/x.md)",
      "[mailto](mailto:someone@example.com)",
      "[tel](tel:+15555550100)",
      "[data](data:text/plain,hello)",
      "[anchor](#section)",
    ].join("\n");
    expect(extractRelativeLinks(body)).toEqual(["approval-chain.md", "patterns/approval-chain.md"]);
  });

  it("ignores relative links inside fenced code blocks", () => {
    const body = ["```md", "[fake](../does-not-exist.md)", "```", ""].join("\n");
    expect(extractRelativeLinks(body)).toEqual([]);
  });
});

describe("bundle link integrity", () => {
  it("every bundle-absolute link resolves to a file in the bundle", () => {
    expect(findBrokenLinks()).toEqual([]);
  });

  it("the bundle has zero relative links (the plan requires bundle-absolute)", () => {
    expect(findRelativeLinks()).toEqual([]);
  });

  it("every pitfall and pattern document is reachable from its section index", () => {
    expect(findUnreachableDocuments()).toEqual([]);
  });

  it("rejects path traversal attempts that escape the bundle root", () => {
    // Create a temp directory with a subdirectory for the bundle, and a file outside it.
    // Under the old path.join() code, the outside file would be found and NOT reported as broken.
    // Under the containment check, it will be reported as broken.
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "okf-"));
    const bundleRoot = path.join(tmpRoot, "bundle");
    fs.mkdirSync(bundleRoot);

    try {
      // Write a file outside the bundle root (but inside tmpRoot) so it actually exists on disk.
      const outsideFile = path.join(tmpRoot, "outside.md");
      fs.writeFileSync(outsideFile, "# Outside the bundle");

      // Write a document inside the bundle with an escaping link.
      const indexPath = path.join(bundleRoot, "index.md");
      fs.writeFileSync(indexPath, "[escape](/../outside.md)");

      // Check for broken links within the bundle.
      const broken = findBrokenLinks(bundleRoot);

      // The escape attempt must be reported as broken.
      // If not, either the containment check is missing or the code reverted to path.join.
      expect(broken).toContainEqual({
        from: "/index",
        to: "/../outside.md",
      });
    } finally {
      // Clean up the temp directory.
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
