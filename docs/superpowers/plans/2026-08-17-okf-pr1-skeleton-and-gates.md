# OKF PR1 — Bundle Skeleton, 28 Curated Concepts, and CI Gates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `docs/okf/` bundle with the 28 curated pattern/pitfall concept files and three CI gates (conformance, link integrity, coverage), without deleting or modifying any existing documentation.

**Architecture:** A new `packages/okf` workspace holds the bundle checker library and its vitest suite; it will also host the generators in PR2. The bundle itself lives at `docs/okf/`. Gates run both inside `turbo test` (for mixed PRs) and in a dedicated GitHub workflow whose trigger is *not* path-ignored (for docs-only PRs). `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`, and everything under `docs/` other than the new bundle are left untouched — PR1 adds a safety net, it does not move knowledge.

**Tech Stack:** TypeScript 5.8, vitest 4.1.5, pnpm 10 workspaces, Turborepo, `yaml` for frontmatter parsing, GitHub Actions.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-17-okf-knowledge-base-design.md`. OKF version targeted: **v0.2**.
- Conformance rule (spec §3): every non-reserved `.md` under `docs/okf/` MUST have a parseable YAML frontmatter block with a non-empty `type`.
- `index.md` and `log.md` are **reserved** — never concept documents. The bundle-root `index.md` is the **only** `index.md` permitted a frontmatter block, and it carries `okf_version: "0.2"`.
- Cross-links MUST use the bundle-absolute form (`/patterns/foo.md`), never relative paths — the spec calls absolute "stable when documents are moved".
- `log.md` date headings MUST be ISO `YYYY-MM-DD`, newest first.
- `generated` is an **object** (`by`, `at`), never a boolean. Curated documents omit it entirely.
- `status` is one of `draft | stable | deprecated`.
- Fixed `type` vocabulary for this repo (spec §9 item 3), asserted by the conformance gate: `Pitfall`, `Playbook`, `Reference`, `Runbook`, `Decision`, `Module`, `Prisma Model`, `API Endpoint`, `Permission`.
- **PR1 deletes nothing and edits no existing doc.** The only pre-existing files touched are `.github/workflows/` (new file) and `pnpm-lock.yaml` (new dependency).
- Conventional-commit titles (`feat(okf):`, `test(okf):`, `ci(okf):`). Branch already exists: `claude/knowledge-base-google-okf-3b4be4`.
- Do not run `pnpm test` at repo root during development unless you want the full 153-file suite; use `pnpm --filter @nexora/okf test`.

## Execution order

**Execute in the order 1, 2, 4, 5, 3, 6, 7** — tasks are numbered by subject, not by sequence.

Task 3 (link gate) runs *after* Tasks 4 and 5 so that the 28 concept documents already exist when the two section indexes are created. Every commit on the branch then has a green suite. Tasks 4 and 5 have no dependency on Task 3, so this costs nothing.

Consequence for implementers: while working Tasks 4 and 5, `src/links.ts` does not exist yet. Verify those tasks with the conformance suite only — do not expect a link gate to run.

## Standing rulings

Recorded before execution; a reviewer raising either of these gets parked with the ruling, not a fix.

- **Transitional duplication is intended.** PR1 leaves all 28 knowledge bullets in *both* `CLAUDE.md` and the bundle. The bundle must prove itself green before PR3 is permitted to delete anything, and the coverage gate asserts against `CLAUDE.md` staying byte-identical. Not a two-sources-of-truth defect in PR1.
- **`CLAUDE.md` is not to be edited in this PR**, not even to add a pointer to the bundle. "No existing documentation modified" is the review invariant that makes PR1 trivially revertable.

---

## File Structure

**New workspace — `packages/okf/`**

| File | Responsibility |
|---|---|
| `package.json` | Workspace manifest, name `@nexora/okf`, `test` + `type-check` scripts so Turbo picks it up |
| `tsconfig.json` | Extends root config, same shape as `packages/utils/tsconfig.json` |
| `vitest.config.ts` | Node environment, includes `src/**/*.test.ts`. No dotenv loading — this suite touches no env |
| `src/frontmatter.ts` | Parse a `---`-delimited YAML frontmatter block out of a markdown string |
| `src/bundle.ts` | Walk the bundle, classify reserved vs concept files, expose concept ids |
| `src/vocabulary.ts` | The allowed `type` values and `status` values |
| `src/coverage-manifest.ts` | Frozen list of the 28 CLAUDE.md knowledge bullets and the concept file each must land in |
| `src/links.ts` | Extract markdown links from a body and resolve bundle-absolute ones |
| `src/frontmatter.test.ts` | Unit tests for the parser |
| `src/conformance.test.ts` | Gate 1 |
| `src/links.test.ts` | Gate 2 |
| `src/coverage.test.ts` | Gate 3 |

**New bundle — `docs/okf/`**

| File | Responsibility |
|---|---|
| `index.md` | Bundle root router; the only index with frontmatter (`okf_version: "0.2"`); injected by the PR5 SessionStart hook |
| `log.md` | Repo-wide decision history |
| `pitfalls/index.md` | Progressive-disclosure list of the 11 pitfalls |
| `pitfalls/<slug>.md` | 11 concept files, `type: Pitfall` |
| `patterns/index.md` | Progressive-disclosure list of the 17 patterns |
| `patterns/<slug>.md` | 17 concept files, `type: Playbook` |

**New CI — `.github/workflows/okf-checks.yml`**: runs the gates on PRs that touch `docs/okf/**`, `CLAUDE.md`, or `packages/okf/**`, with no `paths-ignore`.

### The 28 slugs (frozen contract)

Pitfalls → `docs/okf/pitfalls/`:

| # | CLAUDE.md bullet | Slug |
|---|---|---|
| 1 | Permissions cache | `permissions-cache.md` |
| 2 | Form-dialog reopen | `form-dialog-reopen.md` |
| 3 | Express route order | `express-route-order.md` |
| 4 | System Admin role | `system-admin-role.md` |
| 5 | Migration consolidation | `migration-consolidation.md` |
| 6 | Singapore region | `singapore-region.md` |
| 7 | Paginated aggregates | `paginated-aggregates.md` |
| 8 | Email HTML injection | `email-html-injection.md` |
| 9 | Tailwind static scan | `tailwind-static-scan.md` |
| 10 | Generated Prisma client is gitignored | `generated-prisma-client-gitignored.md` |
| 11 | Notification bell is (mostly) a server read-model, not a table. | `notification-bell-read-model.md` |

Patterns → `docs/okf/patterns/`:

| # | CLAUDE.md bullet | Slug |
|---|---|---|
| 1 | Per-entity scoping | `per-entity-scoping.md` |
| 2 | Signed-URL downloads | `signed-url-downloads.md` |
| 3 | xlsx imports | `xlsx-imports.md` |
| 4 | Two-row header xlsx | `two-row-header-xlsx.md` |
| 5 | Login redirect | `login-redirect.md` |
| 6 | Branding | `branding.md` |
| 7 | ARIA evals | `aria-evals.md` |
| 8 | Configurable list (admin-editable enum) | `configurable-list.md` |
| 9 | Approval chain | `approval-chain.md` |
| 10 | Bulk select-and-act | `bulk-select-and-act.md` |
| 11 | Native-table / shared-board mirror | `native-table-shared-board-mirror.md` |
| 12 | Dashboard intelligence (flow metrics + SLA) | `dashboard-intelligence.md` |
| 13 | Soft delete + restore/remove (and the IDOR trap) | `soft-delete-restore.md` |
| 14 | ESOP sheet-aligned KPIs | `esop-sheet-aligned-kpis.md` |
| 15 | Announce a record to the dashboard surfaces | `announce-to-dashboard-surfaces.md` |
| 16 | Timezone-correct daily records | `timezone-correct-daily-records.md` |
| 17 | Global config block on a generated document | `global-config-block.md` |

---

## Task 1: Workspace scaffold + frontmatter parser

**Files:**
- Create: `packages/okf/package.json`
- Create: `packages/okf/tsconfig.json`
- Create: `packages/okf/vitest.config.ts`
- Create: `packages/okf/src/frontmatter.ts`
- Test: `packages/okf/src/frontmatter.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseFrontmatter(source: string): { frontmatter: Record<string, unknown> | null; body: string }` — returns `frontmatter: null` when the source has no `---` block at position 0. Used by Tasks 2, 3, 4, 5.

- [ ] **Step 1: Create the workspace manifest**

`packages/okf/package.json`:

```json
{
  "name": "@nexora/okf",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "echo 'okf is source-only, no build needed'",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create the tsconfig**

`packages/okf/tsconfig.json` (mirrors `packages/utils/tsconfig.json`):

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create the vitest config**

`packages/okf/vitest.config.ts`. Note this deliberately does NOT load dotenv — unlike `apps/api/vitest.config.ts`, these tests read committed files only and must never depend on env.

```ts
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Install dependencies**

`vitest` and `yaml` are new to this workspace. Do NOT hand-write version numbers into `package.json` — let pnpm resolve them so the lockfile and manifest agree.

```bash
pnpm --filter @nexora/okf add -D vitest yaml
```

Expected: `packages/okf/package.json` gains `vitest` and `yaml` under `devDependencies`, and `pnpm-lock.yaml` updates.

- [ ] **Step 5: Write the failing parser test**

`packages/okf/src/frontmatter.test.ts`:

```ts
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
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
pnpm --filter @nexora/okf test
```

Expected: FAIL — `Failed to resolve import "./frontmatter"`.

- [ ] **Step 7: Implement the parser**

`packages/okf/src/frontmatter.ts`:

```ts
import { parse as parseYaml } from "yaml";

const DELIMITER = "---";

export interface ParsedDocument {
  frontmatter: Record<string, unknown> | null;
  body: string;
}

/**
 * Split an OKF markdown document into its YAML frontmatter block and body.
 *
 * A frontmatter block exists only when the document opens with `---` on its
 * own first line. A `---` anywhere else is a horizontal rule (docs/ is full
 * of them) and must not be mistaken for frontmatter.
 */
export function parseFrontmatter(source: string): ParsedDocument {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith(`${DELIMITER}\n`)) {
    return { frontmatter: null, body: normalized };
  }

  const closingIndex = normalized.indexOf(`\n${DELIMITER}`, DELIMITER.length);
  if (closingIndex === -1) {
    return { frontmatter: null, body: normalized };
  }

  const raw = normalized.slice(DELIMITER.length + 1, closingIndex);
  const body = normalized.slice(closingIndex + DELIMITER.length + 1).replace(/^\n/, "");

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Malformed YAML frontmatter: ${message}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Malformed YAML frontmatter: expected a mapping of keys to values");
  }

  return { frontmatter: parsed as Record<string, unknown>, body };
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
pnpm --filter @nexora/okf test
```

Expected: PASS, 5 tests.

- [ ] **Step 9: Verify type-check passes**

```bash
pnpm --filter @nexora/okf type-check
```

Expected: no output, exit 0.

- [ ] **Step 10: Commit**

```bash
git add packages/okf pnpm-lock.yaml
git commit -m "feat(okf): add @nexora/okf workspace with frontmatter parser"
```

---

## Task 2: Bundle walker + conformance gate

**Files:**
- Create: `packages/okf/src/vocabulary.ts`
- Create: `packages/okf/src/bundle.ts`
- Create: `docs/okf/index.md`
- Create: `docs/okf/log.md`
- Test: `packages/okf/src/conformance.test.ts`

**Interfaces:**
- Consumes: `parseFrontmatter` from Task 1.
- Produces:
  - `BUNDLE_ROOT: string` — absolute path to `docs/okf`.
  - `RESERVED_FILENAMES: readonly ["index.md", "log.md"]`
  - `ALLOWED_TYPES: readonly string[]`, `ALLOWED_STATUSES: readonly string[]`
  - `listMarkdownFiles(root: string): string[]` — absolute paths, recursive, sorted.
  - `toConceptId(absolutePath: string, root: string): string` — bundle-relative path minus `.md`, always `/`-prefixed and POSIX-separated.
  - `isReserved(absolutePath: string): boolean`
  - `readDocument(absolutePath: string): { conceptId: string; frontmatter: Record<string, unknown> | null; body: string }`
  - Used by Tasks 3, 4, 5.

- [ ] **Step 1: Write the vocabulary module**

`packages/okf/src/vocabulary.ts`:

```ts
/**
 * OKF v0.2 leaves `type` free-form ("Type values are not registered
 * centrally"). We pin a closed vocabulary for THIS bundle so a typo becomes
 * a test failure instead of a silently-unroutable concept.
 */
export const ALLOWED_TYPES = [
  "Pitfall",
  "Playbook",
  "Reference",
  "Runbook",
  "Decision",
  "Module",
  "Prisma Model",
  "API Endpoint",
  "Permission",
] as const;

export const ALLOWED_STATUSES = ["draft", "stable", "deprecated"] as const;

export const OKF_VERSION = "0.2";
```

- [ ] **Step 2: Write the bundle walker**

`packages/okf/src/bundle.ts`:

```ts
import fs from "fs";
import path from "path";

import { parseFrontmatter } from "./frontmatter";

/** `packages/okf/src` -> repo root -> `docs/okf`. */
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const BUNDLE_ROOT = path.join(REPO_ROOT, "docs", "okf");

export const RESERVED_FILENAMES = ["index.md", "log.md"] as const;

export function listMarkdownFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out.sort();
}

export function isReserved(absolutePath: string): boolean {
  return (RESERVED_FILENAMES as readonly string[]).includes(path.basename(absolutePath));
}

/** Concept id = bundle-relative path minus `.md`, POSIX separators, leading slash. */
export function toConceptId(absolutePath: string, root: string = BUNDLE_ROOT): string {
  const rel = path.relative(root, absolutePath).split(path.sep).join("/");
  return `/${rel.replace(/\.md$/, "")}`;
}

export interface BundleDocument {
  absolutePath: string;
  conceptId: string;
  frontmatter: Record<string, unknown> | null;
  body: string;
}

export function readDocument(absolutePath: string): BundleDocument {
  const source = fs.readFileSync(absolutePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(source);
  return {
    absolutePath,
    conceptId: toConceptId(absolutePath),
    frontmatter,
    body,
  };
}

export function listConceptDocuments(root: string = BUNDLE_ROOT): BundleDocument[] {
  return listMarkdownFiles(root)
    .filter((file) => !isReserved(file))
    .map(readDocument);
}
```

- [ ] **Step 3: Write the failing conformance test**

`packages/okf/src/conformance.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
pnpm --filter @nexora/okf test
```

Expected: FAIL — the bundle root does not exist yet (`ENOENT` from `listMarkdownFiles`, and the first assertion reports `false`).

- [ ] **Step 5: Create the bundle root router**

`docs/okf/index.md`. This is the only `index.md` with frontmatter, and it is what the PR5 `SessionStart` hook injects — keep it short.

```markdown
---
okf_version: "0.2"
---

# Intranet developer knowledge bundle

Open Knowledge Format v0.2 bundle. Concept identity is the file path minus
`.md`. Cross-links are bundle-absolute (`/pitfalls/express-route-order.md`).

Generated documents carry a `generated` key and are rewritten by
`pnpm okf:generate` — never hand-edit them. Curated documents omit
`generated` and carry `verified` / `stale_after` instead.

## Sections

- [Pitfalls](/pitfalls/index.md) — mistakes this codebase has actually made. Read before editing an unfamiliar module.
- [Patterns](/patterns/index.md) — reusable module shapes. Read before building something that resembles an existing module.

## Conventions

- Reserved filenames: `index.md` (progressive disclosure) and `log.md`
  (chronological history). Neither is ever a concept document.
- `status` is one of `draft`, `stable`, `deprecated`.
- Full design and roadmap: `docs/superpowers/specs/2026-08-17-okf-knowledge-base-design.md`.
```

- [ ] **Step 6: Create the bundle log**

`docs/okf/log.md`:

```markdown
# Bundle log

## 2026-08-17

**Creation.** Bundle established with the 17 patterns and 11 pitfalls lifted
from `CLAUDE.md`, plus conformance, link-integrity, and coverage gates. No
existing documentation was moved or deleted — `CLAUDE.md`, `AGENTS.md`,
`CONTEXT.md`, and `docs/` are unchanged. Root de-duplication and the monolith
split land in later PRs per the design spec.
```

- [ ] **Step 7: Run the test to verify conformance passes on the two-file bundle**

```bash
pnpm --filter @nexora/okf test
```

Expected: PASS. `listConceptDocuments()` is empty (both files are reserved), so the per-concept assertions pass trivially; the root-index and log-structure assertions do real work.

- [ ] **Step 8: Prove the gate actually catches a violation**

Create a deliberately bad concept file, confirm the suite goes red, then delete it.

```bash
mkdir -p docs/okf/patterns
printf '# No frontmatter here\n' > docs/okf/patterns/tmp-bad.md
pnpm --filter @nexora/okf test
```

Expected: FAIL, naming `/patterns/tmp-bad` in the offenders array. Then:

```bash
rm docs/okf/patterns/tmp-bad.md
pnpm --filter @nexora/okf test
```

Expected: PASS again. A gate never observed failing is not known to work.

- [ ] **Step 9: Commit**

```bash
git add packages/okf docs/okf
git commit -m "feat(okf): add bundle walker and conformance gate with root index and log"
```

---

## Task 3: Link-integrity gate

**Files:**
- Create: `packages/okf/src/links.ts`
- Test: `packages/okf/src/links.test.ts`

**Interfaces:**
- Consumes: `listMarkdownFiles`, `readDocument`, `toConceptId`, `BUNDLE_ROOT` from Task 2.
- Produces: `extractBundleLinks(body: string): string[]` — every markdown link target starting with `/`. `findBrokenLinks(): Array<{ from: string; to: string }>`. Used by Task 5's CI wiring only.

- [ ] **Step 1: Write the failing link test**

`packages/okf/src/links.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { extractBundleLinks, findBrokenLinks } from "./links";

describe("extractBundleLinks", () => {
  it("returns bundle-absolute link targets", () => {
    const body = "See [route order](/pitfalls/express-route-order.md) for detail.";
    expect(extractBundleLinks(body)).toEqual(["/pitfalls/express-route-order.md"]);
  });

  it("ignores external and relative links", () => {
    const body = [
      "[external](https://example.com/x.md)",
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

describe("bundle link integrity", () => {
  it("every bundle-absolute link resolves to a file in the bundle", () => {
    expect(findBrokenLinks()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @nexora/okf test
```

Expected: FAIL — `Failed to resolve import "./links"`.

- [ ] **Step 3: Implement the link checker**

`packages/okf/src/links.ts`:

```ts
import fs from "fs";
import path from "path";

import { BUNDLE_ROOT, listMarkdownFiles, readDocument, toConceptId } from "./bundle";

const FENCE = /^```/;
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

/**
 * Bundle-absolute link targets (`/patterns/foo.md`) found in a body.
 *
 * Fenced code blocks are skipped: the bundle documents its own link syntax in
 * examples, and those illustrative links point at concepts that do not exist.
 */
export function extractBundleLinks(body: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (FENCE.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const match of line.matchAll(MARKDOWN_LINK)) {
      const target = match[1];
      if (target.startsWith("/")) out.push(target);
    }
  }
  return out;
}

export interface BrokenLink {
  from: string;
  to: string;
}

export function findBrokenLinks(root: string = BUNDLE_ROOT): BrokenLink[] {
  const broken: BrokenLink[] = [];
  for (const file of listMarkdownFiles(root)) {
    const doc = readDocument(file);
    const from = toConceptId(file, root);
    for (const target of extractBundleLinks(doc.body)) {
      const withoutAnchor = target.split("#")[0];
      if (withoutAnchor === "") continue;
      const resolved = path.join(root, withoutAnchor);
      if (!fs.existsSync(resolved)) broken.push({ from, to: target });
    }
  }
  return broken;
}
```

- [ ] **Step 4: Run the test — the three unit tests pass, the integrity assertion fails**

```bash
pnpm --filter @nexora/okf test
```

Expected: the three `extractBundleLinks` unit tests PASS; the `bundle link integrity` test FAILS with two broken links — `/pitfalls/index.md` and `/patterns/index.md`, which `docs/okf/index.md` already references but which do not exist yet. That failure is the checker working. Step 5 creates them.

- [ ] **Step 5: Create the two section indexes**

`docs/okf/pitfalls/index.md` (no frontmatter — reserved filename):

```markdown
# Pitfalls

Mistakes this codebase has actually made, one concept per file. Read the
relevant entry before editing an unfamiliar module.

- [Permissions cache](/pitfalls/permissions-cache.md) — stale `useAuth()` state after a role change
- [Form-dialog reopen](/pitfalls/form-dialog-reopen.md) — slim list items silently overwrite real data
- [Express route order](/pitfalls/express-route-order.md) — literal paths must precede `:param` routes
- [System Admin role](/pitfalls/system-admin-role.md) — the bypass key is `isSystem && name === "Admin"`
- [Migration consolidation](/pitfalls/migration-consolidation.md) — squashing leaves later migrations to re-fail
- [Singapore region](/pitfalls/singapore-region.md) — Supabase is `aws-1-ap-southeast-1`; expect transient P1001s
- [Paginated aggregates](/pitfalls/paginated-aggregates.md) — never total from the loaded page
- [Email HTML injection](/pitfalls/email-html-injection.md) — `escapeHtml()` every interpolated free-text field
- [Tailwind static scan](/pitfalls/tailwind-static-scan.md) — dynamic class strings get purged
- [Generated Prisma client is gitignored](/pitfalls/generated-prisma-client-gitignored.md) — run `pnpm db:generate`
- [Notification bell read-model](/pitfalls/notification-bell-read-model.md) — recompute server-side; seen-set governs the badge
```

`docs/okf/patterns/index.md` (no frontmatter — reserved filename):

```markdown
# Patterns

Reusable module shapes with a proven reference implementation. Read the
relevant entry before building something that resembles an existing module.

- [Per-entity scoping](/patterns/per-entity-scoping.md) — `entityId` + `__all__` filter
- [Signed-URL downloads](/patterns/signed-url-downloads.md) — private `documents` bucket
- [xlsx imports](/patterns/xlsx-imports.md) — `coerceNumber` for HR's comma numbers
- [Two-row header xlsx](/patterns/two-row-header-xlsx.md) — composite header keys
- [Login redirect](/patterns/login-redirect.md) — `/dashboard` for staff, `/my-portal` for employee-only
- [Branding](/patterns/branding.md) — user-visible name is "Intranet"; `@nexora/*` stays
- [ARIA evals](/patterns/aria-evals.md) — three suites gate assistant changes
- [Configurable list](/patterns/configurable-list.md) — admin-editable enum with two-phase reorder
- [Approval chain](/patterns/approval-chain.md) — config steps + per-request decision snapshot
- [Bulk select-and-act](/patterns/bulk-select-and-act.md) — ids OR `allMatching` + filter
- [Native-table / shared-board mirror](/patterns/native-table-shared-board-mirror.md) — lazy heal on first open
- [Dashboard intelligence](/patterns/dashboard-intelligence.md) — transition-stamped lifecycle columns + SLA constants
- [Soft delete + restore](/patterns/soft-delete-restore.md) — `deletedAt` and the IDOR trap
- [ESOP sheet-aligned KPIs](/patterns/esop-sheet-aligned-kpis.md) — `rollupGrants()` definitions
- [Announce to dashboard surfaces](/patterns/announce-to-dashboard-surfaces.md) — wall + news + company date
- [Timezone-correct daily records](/patterns/timezone-correct-daily-records.md) — store the IANA zone on the row
- [Global config block](/patterns/global-config-block.md) — one `SystemSetting` row + `DEFAULT_X` fallback
```

- [ ] **Step 6: Run the tests to verify link integrity passes**

```bash
pnpm --filter @nexora/okf test
```

Expected: PASS, all suites. Because this task runs after Tasks 4 and 5 (see Execution order), all 28 concept documents already exist, so every link in both section indexes resolves and `findBrokenLinks()` returns `[]`.

If any link is reported broken, the cause is a slug mismatch between a section-index link and the actual filename — fix the link or the filename so they agree with the slug tables in the File Structure section. Do not weaken the assertion.

- [ ] **Step 7: Prove the gate catches a broken link**

```bash
mv docs/okf/pitfalls/singapore-region.md /tmp/okf-link-rehearsal.md
pnpm --filter @nexora/okf test
```

Expected: FAIL, reporting `/pitfalls/singapore-region.md` as broken from `/pitfalls/index`. Restore:

```bash
mv /tmp/okf-link-rehearsal.md docs/okf/pitfalls/singapore-region.md
pnpm --filter @nexora/okf test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/okf/src/links.ts packages/okf/src/links.test.ts docs/okf/pitfalls/index.md docs/okf/patterns/index.md
git commit -m "test(okf): add link-integrity gate and section indexes"
```

---

## Task 4: The 11 pitfall concept files

**Files:**
- Create: `docs/okf/pitfalls/<slug>.md` × 11 (slugs in the File Structure table)

**Interfaces:**
- Consumes: the conformance gate from Task 2 (`type: Pitfall` must be in the vocabulary).
- Produces: 11 concept ids under `/pitfalls/`, consumed by Task 6's coverage manifest.

- [ ] **Step 1: Write all 11 pitfall files**

Source content: `CLAUDE.md` → `## Common pitfalls`, the 11 `- **`-prefixed bullets. **Copy the substance verbatim** — do not paraphrase, summarize, or "improve" it. This content is the reason the project exists; rewording it is how knowledge gets lost. Expand each bullet into a document with a `## Rule`, `## Why` and, where the bullet names one, a `## Reference` section.

Frontmatter template for every file in this task:

```yaml
---
type: Pitfall
title: <bullet title, verbatim>
description: <one sentence, present tense, stating the rule>
tags: [<area>, <subsystem>]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---
```

Worked example — `docs/okf/pitfalls/express-route-order.md`:

```markdown
---
type: Pitfall
title: Express route order
description: Literal paths must register before `:param` routes or they are shadowed.
tags: [backend, express, routing]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Express route order

## Rule

Routes register on the `Router()` at the bottom of the controller. **Literal
paths must come before `:param` routes.** Express matches in order, so
`/import-template` is eaten by `/:id` if listed second.

## Why

This has been hit twice. The failure is silent at build time and at type-check
time: the literal route simply never receives a request, and the `:id` handler
gets called with `id === "import-template"`.

## Reference

`apps/api/src/modules/<module>/<module>.controller.ts` — the route block at the
bottom of any controller. Once `/patterns/` documents exist for a module, its
`apis.md` (generated in PR2) lists routes in registration order, which makes a
violation visible on inspection.
```

Apply the same shape to the remaining 10, drawing each one's `## Rule` and
`## Why` from its CLAUDE.md bullet:

| Slug | `tags` |
|---|---|
| `permissions-cache.md` | `[frontend, auth, caching]` |
| `form-dialog-reopen.md` | `[frontend, forms]` |
| `system-admin-role.md` | `[backend, rbac]` |
| `migration-consolidation.md` | `[database, migrations]` |
| `singapore-region.md` | `[infra, database]` |
| `paginated-aggregates.md` | `[backend, frontend, pagination]` |
| `email-html-injection.md` | `[backend, email, security]` |
| `tailwind-static-scan.md` | `[frontend, tailwind]` |
| `generated-prisma-client-gitignored.md` | `[database, tooling]` |
| `notification-bell-read-model.md` | `[backend, dashboard, notifications]` |

- [ ] **Step 2: Verify conformance passes for the new files**

```bash
pnpm --filter @nexora/okf test -- conformance
```

Expected: PASS — all 11 documents have frontmatter, `type: Pitfall` is in the vocabulary, none carries `generated`.

- [ ] **Step 3: Confirm the file count**

```bash
ls docs/okf/pitfalls/*.md | wc -l
```

Expected: `11`. The section index (`pitfalls/index.md`) is created later, in Task 3 — `src/links.ts` does not exist yet, so there is no link gate to run at this point.

- [ ] **Step 4: Commit**

```bash
git add docs/okf/pitfalls
git commit -m "docs(okf): add the 11 pitfall concept documents"
```

---

## Task 5: The 17 pattern concept files

**Files:**
- Create: `docs/okf/patterns/<slug>.md` × 17 (slugs in the File Structure table)

**Interfaces:**
- Consumes: the conformance gate from Task 2 (`type: Playbook`).
- Produces: 17 concept ids under `/patterns/`, consumed by Task 6's coverage manifest.

- [ ] **Step 1: Write all 17 pattern files**

Source content: `CLAUDE.md` → `## Module-specific patterns to reuse`, the 17 `- **`-prefixed bullets. **Copy the substance verbatim.** These bullets are dense — several carry numbered sub-steps (`configurable-list`, `soft-delete-restore`, `global-config-block`); preserve every numbered step and every named file. Sections: `## Shape`, `## Steps` (where the bullet is numbered), `## Reference` (the modules the bullet names).

Frontmatter template for every file in this task:

```yaml
---
type: Playbook
title: <bullet title, verbatim>
description: <one sentence stating what the pattern is for>
tags: [<area>, <subsystem>]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---
```

Worked example — `docs/okf/patterns/soft-delete-restore.md`:

```markdown
---
type: Playbook
title: Soft delete + restore/remove (and the IDOR trap)
description: Add `deletedAt`, expose restore/permanent routes, and enforce owner-or-HR in the service, not the route.
tags: [backend, rbac, security]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Soft delete + restore/remove (and the IDOR trap)

Used by users, accounting, leave, travel, expenses, cash-advance, visa.

## Steps

1. Add a `deletedAt DateTime?` column (`@@index([deletedAt])` on hot tables);
   filter every list/count with `excludeDeleted()` and turn the destructive
   delete into `softDeleteUpdate()` (both from
   `apps/api/src/infrastructure/soft-delete.ts`; `restoreUpdate()` nulls it back).
2. Expose `POST /<resource>/:id/restore` + `DELETE /<resource>/:id/permanent`.
3. **The default `findById` excludes deleted rows**, so restore/remove MUST
   re-fetch via a dedicated `find*ByIdIncludingDeleted` repo method — otherwise
   restore always 404s.
4. **Enforce owner-or-HR in the service, not at the route.**
   `requirePermission("<x>:create")` lets *any* employee hit restore; the
   service then checks `existing.employeeId === actorId ||
   permissions.includes(<hr-perm>)` and throws `ForbiddenException` otherwise
   (leave→`leave:hr-read`, travel→`travel:hr-read`,
   expenses→`expense:hr-delete`, cash-advance→`cash-advance:approve`; users
   guard cross-admin edits via `assertActorMayManageAdminUser`). Skipping that
   service check is an IDOR — a user could restore or destroy another user's
   record by guessing an id.

## Known deviation

The `visa` restore/permanent path is gated only by `visa:manage` and does not
carry the owner check. `visa:manage` is already HR-only, but do not copy that
shape into an owner-scoped module.

## Reference

`cash-advance.service.ts` / `leave.service.ts` `restore*`.
```

Apply the same shape to the remaining 16:

| Slug | `tags` |
|---|---|
| `per-entity-scoping.md` | `[backend, hr, scoping]` |
| `signed-url-downloads.md` | `[backend, storage, security]` |
| `xlsx-imports.md` | `[backend, import, xlsx]` |
| `two-row-header-xlsx.md` | `[backend, import, xlsx]` |
| `login-redirect.md` | `[frontend, auth]` |
| `branding.md` | `[frontend, branding]` |
| `aria-evals.md` | `[backend, aria, testing]` |
| `configurable-list.md` | `[backend, frontend, config]` |
| `approval-chain.md` | `[backend, workflow]` |
| `bulk-select-and-act.md` | `[backend, rbac]` |
| `native-table-shared-board-mirror.md` | `[backend, crm, database]` |
| `dashboard-intelligence.md` | `[backend, dashboard, metrics]` |
| `esop-sheet-aligned-kpis.md` | `[backend, hr, esop]` |
| `announce-to-dashboard-surfaces.md` | `[backend, dashboard, notifications]` |
| `timezone-correct-daily-records.md` | `[backend, attendance, timezone]` |
| `global-config-block.md` | `[backend, config, documents]` |

- [ ] **Step 2: Run the full suite**

```bash
pnpm --filter @nexora/okf test
```

Expected: PASS — conformance green on all 28 concept documents (11 pitfalls from Task 4, 17 patterns from this task). There is no link gate yet; `src/links.ts` arrives in Task 3, which runs next.

- [ ] **Step 3: Confirm the file count**

```bash
ls docs/okf/pitfalls/*.md | wc -l   # expect 11 (index.md comes in Task 3)
ls docs/okf/patterns/*.md | wc -l   # expect 17 (index.md comes in Task 3)
```

- [ ] **Step 4: Commit**

```bash
git add docs/okf/patterns
git commit -m "docs(okf): add the 17 pattern concept documents"
```

---

## Task 6: Coverage gate

**Files:**
- Create: `packages/okf/src/coverage-manifest.ts`
- Test: `packages/okf/src/coverage.test.ts`

**Interfaces:**
- Consumes: `REPO_ROOT`, `BUNDLE_ROOT` from Task 2; the 28 files from Tasks 4 and 5.
- Produces: `COVERAGE_MANIFEST: ReadonlyArray<{ bullet: string; conceptFile: string }>` — the frozen 28-entry contract; `extractClaudeMdBullets(): string[]`.

**Why this gate exists:** PR3 deletes `CONTEXT.md` and `AGENTS.md` and trims `CLAUDE.md`. A conflict-free edit can drop content while type-check and lint stay green. This assertion is the only mechanism that proves all 28 pieces of knowledge survived, and it must be green *before* PR3 is written.

- [ ] **Step 1: Write the frozen manifest**

`packages/okf/src/coverage-manifest.ts`:

```ts
/**
 * The 28 knowledge bullets that lived in CLAUDE.md's "Common pitfalls" and
 * "Module-specific patterns to reuse" sections as of 2026-08-17, and the
 * concept document each one must land in.
 *
 * This list is FROZEN. It is the contract that PR3 (which trims CLAUDE.md and
 * deletes AGENTS.md / CONTEXT.md) cannot violate without turning the build
 * red. Adding a new bullet to CLAUDE.md means adding an entry here AND the
 * concept file it points at.
 *
 * `bullet` is matched as a prefix of the bold label in CLAUDE.md, so it must
 * stay byte-identical to the source text.
 */
export interface CoverageEntry {
  bullet: string;
  conceptFile: string;
}

export const COVERAGE_MANIFEST: ReadonlyArray<CoverageEntry> = [
  // ## Common pitfalls — 11 bullets
  { bullet: "Permissions cache", conceptFile: "pitfalls/permissions-cache.md" },
  { bullet: "Form-dialog reopen", conceptFile: "pitfalls/form-dialog-reopen.md" },
  { bullet: "Express route order", conceptFile: "pitfalls/express-route-order.md" },
  { bullet: "System Admin role", conceptFile: "pitfalls/system-admin-role.md" },
  { bullet: "Migration consolidation", conceptFile: "pitfalls/migration-consolidation.md" },
  { bullet: "Singapore region", conceptFile: "pitfalls/singapore-region.md" },
  { bullet: "Paginated aggregates", conceptFile: "pitfalls/paginated-aggregates.md" },
  { bullet: "Email HTML injection", conceptFile: "pitfalls/email-html-injection.md" },
  { bullet: "Tailwind static scan", conceptFile: "pitfalls/tailwind-static-scan.md" },
  {
    bullet: "Generated Prisma client is gitignored",
    conceptFile: "pitfalls/generated-prisma-client-gitignored.md",
  },
  {
    bullet: "Notification bell is (mostly) a server read-model, not a table.",
    conceptFile: "pitfalls/notification-bell-read-model.md",
  },

  // ## Module-specific patterns to reuse — 17 bullets
  { bullet: "Per-entity scoping", conceptFile: "patterns/per-entity-scoping.md" },
  { bullet: "Signed-URL downloads", conceptFile: "patterns/signed-url-downloads.md" },
  { bullet: "xlsx imports", conceptFile: "patterns/xlsx-imports.md" },
  { bullet: "Two-row header xlsx", conceptFile: "patterns/two-row-header-xlsx.md" },
  { bullet: "Login redirect", conceptFile: "patterns/login-redirect.md" },
  { bullet: "Branding", conceptFile: "patterns/branding.md" },
  { bullet: "ARIA evals", conceptFile: "patterns/aria-evals.md" },
  {
    bullet: "Configurable list (admin-editable enum)",
    conceptFile: "patterns/configurable-list.md",
  },
  { bullet: "Approval chain", conceptFile: "patterns/approval-chain.md" },
  { bullet: "Bulk select-and-act", conceptFile: "patterns/bulk-select-and-act.md" },
  {
    bullet: "Native-table / shared-board mirror",
    conceptFile: "patterns/native-table-shared-board-mirror.md",
  },
  {
    bullet: "Dashboard intelligence (flow metrics + SLA)",
    conceptFile: "patterns/dashboard-intelligence.md",
  },
  {
    bullet: "Soft delete + restore/remove (and the IDOR trap)",
    conceptFile: "patterns/soft-delete-restore.md",
  },
  { bullet: "ESOP sheet-aligned KPIs", conceptFile: "patterns/esop-sheet-aligned-kpis.md" },
  {
    bullet: "Announce a record to the dashboard surfaces",
    conceptFile: "patterns/announce-to-dashboard-surfaces.md",
  },
  {
    bullet: "Timezone-correct daily records",
    conceptFile: "patterns/timezone-correct-daily-records.md",
  },
  {
    bullet: "Global config block on a generated document",
    conceptFile: "patterns/global-config-block.md",
  },
];
```

- [ ] **Step 2: Write the failing coverage test**

`packages/okf/src/coverage.test.ts`. Note the asymmetry in the third assertion: it checks that every bullet *currently in* `CLAUDE.md` is in the manifest, **not** that the manifest equals the extraction. PR3 replaces the full bullets with one-line links, shrinking the extraction — an equality assertion would break then and tempt someone to weaken the gate.

```ts
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { BUNDLE_ROOT, REPO_ROOT } from "./bundle";
import { COVERAGE_MANIFEST } from "./coverage-manifest";

const SECTIONS = ["## Common pitfalls", "## Module-specific patterns to reuse"];

/**
 * Bold labels of the `- **…**` bullets in the two knowledge sections.
 *
 * Pure so the missing-heading guard can be exercised with fabricated input —
 * a guard tested only against the real CLAUDE.md can never fail, and so is
 * not known to work.
 *
 * THROWS on a heading it cannot find. Skipping a missing section silently
 * would let the gate pass with an empty label list: green while verifying
 * nothing, which is the exact failure this gate exists to prevent. Any
 * realistic drift — a rename, a changed heading level, altered punctuation,
 * a trailing space — stops matching the exact string and therefore throws
 * loudly instead of degrading to a no-op.
 */
export function extractBulletLabels(source: string): string[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const labels: string[] = [];

  for (const heading of SECTIONS) {
    const start = lines.indexOf(heading);
    if (start === -1) {
      throw new Error(
        `CLAUDE.md heading not found: "${heading}". The coverage gate cannot ` +
          `verify a section it cannot locate. If the heading was renamed, ` +
          `update SECTIONS in this file to match.`,
      );
    }
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (line.startsWith("## ")) break;
      const match = /^- \*\*(.+?)\*\*/.exec(line);
      if (match) labels.push(match[1]!);
    }
  }
  return labels;
}

/** Thin wrapper: reads the real CLAUDE.md so the assertions below check real content. */
function extractClaudeMdBullets(): string[] {
  return extractBulletLabels(fs.readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8"));
}

describe("CLAUDE.md knowledge coverage", () => {
  it("the manifest holds exactly 28 entries", () => {
    expect(COVERAGE_MANIFEST).toHaveLength(28);
  });

  it("every manifest entry maps to exactly one existing concept file", () => {
    const missing: string[] = [];
    for (const entry of COVERAGE_MANIFEST) {
      const resolved = path.join(BUNDLE_ROOT, entry.conceptFile);
      if (!fs.existsSync(resolved)) missing.push(entry.conceptFile);
    }
    expect(missing).toEqual([]);
  });

  it("no two manifest entries point at the same concept file", () => {
    const files = COVERAGE_MANIFEST.map((e) => e.conceptFile);
    expect(new Set(files).size).toBe(files.length);
  });

  it("every knowledge bullet currently in CLAUDE.md is claimed by the manifest", () => {
    const claimed = COVERAGE_MANIFEST.map((e) => e.bullet);
    const unclaimed = extractClaudeMdBullets().filter(
      (label) => !claimed.some((bullet) => label.startsWith(bullet)),
    );
    expect(unclaimed).toEqual([]);
  });

  it("every concept document under patterns/ and pitfalls/ is claimed by the manifest", () => {
    const claimed = new Set(COVERAGE_MANIFEST.map((e) => e.conceptFile));
    const orphans: string[] = [];
    for (const dir of ["pitfalls", "patterns"]) {
      for (const name of fs.readdirSync(path.join(BUNDLE_ROOT, dir))) {
        if (!name.endsWith(".md") || name === "index.md") continue;
        const rel = `${dir}/${name}`;
        if (!claimed.has(rel)) orphans.push(rel);
      }
    }
    expect(orphans).toEqual([]);
  });
});

describe("extractBulletLabels", () => {
  const BOTH_SECTIONS = [
    "# CLAUDE.md",
    "",
    "## Common pitfalls",
    "",
    "- **First pitfall**: something.",
    "",
    "## Module-specific patterns to reuse",
    "",
    "- **First pattern**: something else.",
    "",
    "## When in doubt",
    "",
    "- **Not a knowledge bullet**: out of scope.",
    "",
  ].join("\n");

  it("returns the bold labels from both sections and nothing after them", () => {
    expect(extractBulletLabels(BOTH_SECTIONS)).toEqual(["First pitfall", "First pattern"]);
  });

  it("throws naming the pitfalls heading when it is missing", () => {
    const source = BOTH_SECTIONS.replace("## Common pitfalls", "## Gotchas");
    expect(() => extractBulletLabels(source)).toThrow(/## Common pitfalls/);
  });

  it("throws naming the patterns heading when it is missing", () => {
    const source = BOTH_SECTIONS.replace(
      "## Module-specific patterns to reuse",
      "### Module-specific patterns to reuse",
    );
    expect(() => extractBulletLabels(source)).toThrow(
      /## Module-specific patterns to reuse/,
    );
  });
});
```

Note the third test changes the heading **level** rather than deleting the heading — that is the realistic drift case, and it must throw just as an outright rename does.

**Prove these tests discriminate.** Temporarily replace the `throw` with `continue`, run them, and confirm exactly the two throw-tests fail. Then restore the `throw` and confirm green. A guard nobody has watched fail is not known to work.

- [ ] **Step 3: Run the test to verify it passes**

```bash
pnpm --filter @nexora/okf test
```

Expected: PASS, all suites. If assertion 4 fails, a bullet title in `CLAUDE.md` does not byte-match its manifest entry — fix the manifest string, not the test.

- [ ] **Step 4: Prove the coverage gate catches a dropped rule**

This is the rehearsal for PR3. Temporarily delete a concept file and confirm red.

```bash
mv docs/okf/pitfalls/express-route-order.md /tmp/okf-rehearsal.md
pnpm --filter @nexora/okf test
```

Expected: FAIL, `missing` containing `pitfalls/express-route-order.md`. Restore:

```bash
mv /tmp/okf-rehearsal.md docs/okf/pitfalls/express-route-order.md
pnpm --filter @nexora/okf test
```

Expected: PASS.

- [ ] **Step 5: Prove the gate catches an unclaimed new bullet**

```bash
printf '\n- **Rehearsal bullet**: temporary.\n' >> CLAUDE.md
pnpm --filter @nexora/okf test
```

Expected: FAIL, `unclaimed` containing `Rehearsal bullet`. Note: the appended line lands after the final `## When in doubt` heading, so if the test passes here, the section-scanning logic is wrong — fix `extractClaudeMdBullets` to also scan a bullet appended inside a knowledge section, and re-run by inserting the line directly under `## Common pitfalls` instead. Then revert:

```bash
git checkout -- CLAUDE.md
pnpm --filter @nexora/okf test
```

Expected: PASS, and `git status` shows `CLAUDE.md` unmodified.

- [ ] **Step 6: Commit**

```bash
git add packages/okf/src/coverage-manifest.ts packages/okf/src/coverage.test.ts
git commit -m "test(okf): add coverage gate freezing the 28 CLAUDE.md knowledge bullets"
```

---

## Task 7: CI wiring

**Files:**
- Create: `.github/workflows/okf-checks.yml`
- Modify: `packages/okf/package.json` (already has `test`; verify Turbo picks it up)

**Interfaces:**
- Consumes: the `test` script from Task 1.
- Produces: a required status check named `OKF Checks / okf`.

**Why a separate workflow:** `.github/workflows/pr-checks.yml` carries

```yaml
paths-ignore:
  - "docs/**"
  - "**/*.md"
  - ".agents/**"
```

so a PR touching only `docs/okf/**` or only `CLAUDE.md` runs **no checks at all**. Those are precisely the PRs the gates exist for. `pnpm test` alone is therefore not sufficient — the gates need a trigger without `paths-ignore`.

- [ ] **Step 1: Confirm the gates run under the root test task**

```bash
pnpm test --filter @nexora/okf
```

Expected: Turbo runs `@nexora/okf#test` and it passes. This covers mixed PRs, where `pr-checks.yml` does fire.

- [ ] **Step 2: Create the dedicated workflow**

`.github/workflows/okf-checks.yml`:

```yaml
# =============================================================================
# Intranet - OKF bundle checks
# Runs on PRs that touch the knowledge bundle, its checker, or the CLAUDE.md
# bullets the coverage gate freezes.
#
# This exists as a SEPARATE workflow because pr-checks.yml path-ignores
# "docs/**" and "**/*.md" — a docs-only PR skips it entirely, which would skip
# exactly the changes these gates guard.
# =============================================================================

name: OKF Checks

on:
  pull_request:
    branches: [main, dev]
    paths:
      - "docs/okf/**"
      - "CLAUDE.md"
      - "AGENTS.md"
      - "CONTEXT.md"
      - "packages/okf/**"
      - ".github/workflows/okf-checks.yml"
  workflow_dispatch:

concurrency:
  group: okf-checks-${{ github.ref }}
  cancel-in-progress: true

jobs:
  okf:
    name: Bundle conformance, links, coverage
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Setup pnpm
        uses: pnpm/action-setup@v6
        with:
          version: 10.33.0

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: OKF bundle gates
        run: pnpm --filter @nexora/okf test
```

Note: no `pnpm db:generate` step — this suite reads committed markdown and never imports the Prisma client, which is why it finishes in well under the 15-minute budget `pr-checks.yml` needs.

- [ ] **Step 3: Validate the workflow YAML parses**

```bash
python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/okf-checks.yml')); print(sorted(d['jobs']['okf'].keys())); print(d[True]['pull_request']['paths'])"
```

Expected: prints the job keys and the six path patterns. A `KeyError` or parse error means the YAML is malformed — GitHub would silently never run it.

- [ ] **Step 4: Verify the new workspace did not regress the repo**

`pnpm type-check` does **not** pass on this repo as-is: `@nexora/web` has **122 pre-existing errors** (105 × TS2339 jest-dom matchers, 12 × TS2307, 3 × TS2305, 2 × TS2353), unrelated to this branch. `apps/web/tsconfig.json` has no `extends`, so it never inherited anything from the root config, and this branch touches only `docs/`, `packages/okf/`, and `pnpm-lock.yaml`. Do not try to fix those errors and do not treat them as this PR's problem.

So the check is a **baseline comparison, not a green requirement**:

```bash
pnpm db:generate
pnpm --filter @nexora/web exec tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `122`. A higher number means this branch regressed something and must be investigated. `pnpm db:generate` first is mandatory — the generated Prisma client is gitignored, and without it the count is polluted by stale-client errors.

Then confirm the workspaces this branch actually affects:

```bash
pnpm --filter @nexora/okf type-check
pnpm --filter @nexora/okf test
pnpm --filter @nexora/api type-check
pnpm --filter @nexora/api test
```

Expected: all four pass. `@nexora/api` is included because it is the largest consumer of the shared root `tsconfig.json`, so it is the best early warning that the new workspace disturbed shared config.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/okf-checks.yml
git commit -m "ci(okf): run bundle gates on docs-only PRs that pr-checks.yml ignores"
```

- [ ] **Step 6: Verify the whole tree and history before pushing**

```bash
git status --short
git log --oneline main..HEAD
git show --stat HEAD
```

Expected: clean tree, one commit per task plus its fix rounds, and no modifications to `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`, or any pre-existing file under `docs/` other than the new `docs/okf/` tree and the plan/spec documents. An explicit `git add` of paths aborts atomically on a bad pathspec, which can produce a silently incomplete commit — verify with `--stat`, not by assumption.

- [ ] **Step 7: Push and open the PR**

```bash
gh auth switch --user kunanon-ui
git push --set-upstream origin claude/knowledge-base-google-okf-3b4be4
```

PR title: `feat(okf): bundle skeleton, 28 curated concepts, and CI gates (PR1/5)`

PR body must contain a Summary section and a Test plan checklist per the repo PR rules, and must state explicitly that **no existing documentation was modified or deleted** — that is the review invariant for this PR.

---

## Self-Review

**Spec coverage.** Spec §4 bundle root, `patterns/`, `pitfalls/`, frontmatter contract → Tasks 2, 4, 5. Spec §5 conformance gate → Task 2; link integrity → Task 3; coverage → Task 6. Spec §6 PR1 scope ("skeleton, 28 curated, three gates, nothing deleted") → all tasks; the "nothing deleted" invariant is asserted in Task 7 Step 6. Spec §9 item 3 (fix the `type` vocabulary in PR1 and assert it) → Task 2 Step 1 + conformance assertion 3.

Deliberately **out of PR1 scope**, per spec §6: generators and the `--check` staleness gate (PR2), `stale_after` reporting (PR2, needs the generator's report harness), module directories and the 55 stubs (PR4), hooks (PR5). The `stale_after` values written in Tasks 4 and 5 are inert until PR2 adds the reporter — that is intentional, not an omission.

**Placeholder scan.** No TBD/TODO. Task 4 and Task 5 Step 1 give a worked example plus a per-file `tags` table rather than 28 full file bodies; the source content is `CLAUDE.md`'s bullets, quoted verbatim by instruction, so reproducing all 28 bodies here would duplicate the file the task reads from. Every other step carries runnable commands or complete code.

**Type consistency.** `parseFrontmatter` (Task 1) → used by `readDocument` (Task 2) → used by `findBrokenLinks` (Task 3) and both test suites. `BUNDLE_ROOT` / `REPO_ROOT` exported from Task 2 and imported unchanged in Tasks 3 and 6. `toConceptId` takes `(absolutePath, root = BUNDLE_ROOT)` in Task 2 and is called with two arguments in Task 3 — consistent. `COVERAGE_MANIFEST` entries use `{ bullet, conceptFile }` in both the manifest and the test. `conceptFile` values are bundle-relative without a leading slash (joined against `BUNDLE_ROOT`), while link targets and concept ids carry a leading slash — different shapes on purpose, and each is used consistently.

**No red commits.** Execution order 1, 2, 4, 5, 3, 6, 7 means the link gate is created only after the 28 concept documents exist, so every commit on the branch leaves the suite green. Tasks 2, 3 and 6 each additionally rehearse their gate failing and restore it, so all three gates are observed working rather than assumed.
