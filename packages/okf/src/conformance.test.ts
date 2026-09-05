import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import {
  BUNDLE_ROOT,
  listConceptDocuments,
  listMarkdownFiles,
  readDocument,
} from "./bundle";
import { ALLOWED_STATUSES, ALLOWED_TYPES, OKF_VERSION } from "./vocabulary";

describe("OKF bundle conformance", () => {
  it("the bundle root exists", () => {
    expect(fs.existsSync(BUNDLE_ROOT)).toBe(true);
  });

  it("every concept document has parseable frontmatter with a non-empty type", () => {
    const offenders: string[] = [];
    for (const doc of listConceptDocuments()) {
      const type = doc.frontmatter?.type;
      if (typeof type !== "string" || type.trim() === "") {
        offenders.push(doc.conceptId);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every concept type is in the pinned vocabulary", () => {
    const offenders: string[] = [];
    for (const doc of listConceptDocuments()) {
      const type = doc.frontmatter?.type;
      if (typeof type === "string" && !(ALLOWED_TYPES as readonly string[]).includes(type)) {
        offenders.push(`${doc.conceptId}: ${type}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every declared status is in the pinned vocabulary", () => {
    const offenders: string[] = [];
    for (const doc of listConceptDocuments()) {
      const status = doc.frontmatter?.status;
      if (status !== undefined && !(ALLOWED_STATUSES as readonly string[]).includes(String(status))) {
        offenders.push(`${doc.conceptId}: ${String(status)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("curated documents never carry a `generated` key", () => {
    const offenders = listConceptDocuments()
      .filter((doc) => doc.frontmatter?.generated !== undefined)
      .filter((doc) => doc.conceptId.startsWith("/patterns/") || doc.conceptId.startsWith("/pitfalls/"))
      .map((doc) => doc.conceptId);
    expect(offenders).toEqual([]);
  });

  it("only the bundle-root index.md carries frontmatter", () => {
    const offenders: string[] = [];
    for (const file of listMarkdownFiles(BUNDLE_ROOT)) {
      if (path.basename(file) !== "index.md") continue;
      const isRoot = path.dirname(file) === BUNDLE_ROOT;
      const doc = readDocument(file);
      if (!isRoot && doc.frontmatter !== null) offenders.push(doc.conceptId);
    }
    expect(offenders).toEqual([]);
  });

  it("the bundle-root index declares the targeted okf_version", () => {
    const doc = readDocument(path.join(BUNDLE_ROOT, "index.md"));
    expect(doc.frontmatter?.okf_version).toBe(OKF_VERSION);
  });

  it("every log.md uses ISO date headings, newest first", () => {
    for (const file of listMarkdownFiles(BUNDLE_ROOT)) {
      if (path.basename(file) !== "log.md") continue;
      const { body } = readDocument(file);
      const dates = [...body.matchAll(/^##\s+(\S+)/gm)].map((m) => m[1]);
      expect(dates.length, `${file} has no date headings`).toBeGreaterThan(0);
      for (const date of dates) {
        expect(date, `${file} heading "${date}" is not ISO YYYY-MM-DD`).toMatch(
          /^\d{4}-\d{2}-\d{2}$/,
        );
      }
      const sortedDesc = [...dates].sort().reverse();
      expect(dates, `${file} date headings are not newest-first`).toEqual(sortedDesc);
    }
  });
});
