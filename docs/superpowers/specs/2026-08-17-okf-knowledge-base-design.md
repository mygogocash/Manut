# Design — Adopt Google's Open Knowledge Format for the internal developer knowledge base

**Date**: 2026-08-17
**Status**: Approved design, not yet implemented
**Scope**: Agent-first, full corpus. Internal developer knowledge only — this design does **not** touch the ARIA end-user knowledge corpus (`aria_knowledge_articles`) or the Visa knowledge-base module.

---

## 1. Problem

The repo's developer knowledge is spread across three overlapping always-loaded root files and a set of monolithic specs that are too large to read and therefore only ever grepped.

Measured on 2026-08-17:

| Surface | Size | State |
|---|---|---|
| `CLAUDE.md` | 198 lines / 27.5K | auto-loaded every session; holds 11 pitfall + 17 pattern bullets |
| `AGENTS.md` | 12.9K | overlaps CLAUDE.md on 8 topics; cross-references it |
| `CONTEXT.md` | 27K | overlaps both on the same 8 topics |
| `README.md` | 29.8K | product + setup |
| `docs/` | 20 files, 596K, **zero** YAML frontmatter | one subdirectory (`docs/ops/`) |

Four files are half the `docs/` corpus:

| File | Size | Headings |
|---|---|---|
| `docs/MODULES_SPECIFICATION.md` | 94K | 13 h2 (12 domain groups + TOC), 36 h3, 133 h4 |
| `docs/DATABASE_SCHEMA.md` | 87K | 22 h2 (21 + TOC), 21 h3 |
| `docs/API_SPECIFICATION.md` | 70K | 33 h2 (32 endpoint groups + TOC), 247 h3 |
| `docs/AUTH_RBAC.md` | 44K | 10 h2 (9 + TOC), 27 h3, 30 h4 |

Code surface those docs are supposed to describe:

- **255** Prisma models across 20 schema files
- **91** API module directories, **97** controllers, **130** services
- **92** web dashboard routes
- **153** test files

### Three concrete failures

1. **Triplication with no marked authority.** `CLAUDE.md`, `AGENTS.md`, and `CONTEXT.md` each cover repo layout, stack, env files, daily commands, CI/deploy, module conventions, common pitfalls, and "when in doubt". `AGENTS.md` defers to CLAUDE.md in prose ("full list in CLAUDE.md → Common pitfalls"). For an agent, three overlapping sources are worse than one, because contradictions are invisible.

2. **Append-scars.** `DATABASE_SCHEMA.md` opens with clean domain groups then degrades into bolted-on sections — `Survey Forms (hr.prisma)`, `ESOP Grant — extended fields (hr.prisma)`, `Comms deep links (comms.prisma)`. Editing in place inside 87K is impractical, so knowledge gets appended instead of integrated.

3. **Undetectable rot.** Six `HANDOFF*.md` files (May–June dated) carry no status or timestamp metadata. Determining which is current requires opening each one. Markdown had no way for a document to declare itself suspect.

4. **Hidden absence.** 91 API modules exist; 36 have a spec section. **55 modules are undocumented**, and a 94K file hides that perfectly.

---

## 2. Goals / non-goals

**Goals**

- One authority per concept, reachable by both humans and agents.
- Derived knowledge (schema, routes, permissions) regenerated from source, never hand-maintained.
- Rot that announces itself and is caught in CI.
- Zero knowledge lost in the migration, proven by assertion rather than review.

**Non-goals**

- No GCP dependency, no Google Cloud Knowledge Catalog integration, no BigQuery. OKF is adopted as a **file format**, not a platform.
- No change to the ARIA retrieval stack (`text-embedding-004` + pgvector remain as-is).
- No new runtime, service, or database table.

---

## 3. What OKF is (verified facts)

Google Cloud open specification. Blog published 2026-06-13; spec at [`GoogleCloudPlatform/knowledge-catalog/okf/SPEC.md`](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf), currently **v0.2**.

Normative rules this design must satisfy:

- **Conformance** = every non-reserved `.md` in the tree has a parseable YAML frontmatter block containing a non-empty `type`. That is the entire bar.
- `type` is the only required key. It is free-form: "Type values are **not** registered centrally… consumers MUST tolerate unknown types gracefully."
- Recommended keys: `title`, `description`, `resource`, `tags`.
- Trust/provenance/lifecycle family (all optional): `generated` (**object** with `by` and `at`), `verified` (list of events), `sources` (list of derivations), `status` (`draft | stable | deprecated`), `stale_after` (`YYYY-MM-DD`).
- Producers MAY add arbitrary keys; consumers SHOULD preserve unknown keys when round-tripping.
- **Concept identity = the file path within the bundle, minus `.md`.**
- `index.md` and `log.md` are **reserved** and MUST NOT be used for concept documents. Bundle-root `index.md` is the only `index.md` permitted a frontmatter block, and may carry `okf_version: "0.2"`.
- Cross-links: bundle-absolute (`/…`) is the **recommended** form, "because it is stable when documents are moved". Relative links are also valid. A link asserts a relationship; the kind of relationship lives in the surrounding prose. Consumers MUST tolerate broken links.
- `log.md`: flat, date-grouped, newest first; date headings MUST be ISO `YYYY-MM-DD`.
- No bundle manifest is required.

Reference tooling that ships with the spec (a Python `reference_agent` with `enrich` and `visualize`) is BigQuery-shaped. Only `visualize` plausibly transfers to this repo. **We adopt the format and write our own generators.**

### Why the format risk is acceptable

v0.2, two months old, Google-authored, negligible external adoption. Lock-in is near zero: the artifacts are plain markdown files in our own git repo, and the worst-case exit is stripping frontmatter. The expensive risk in this project is organizational (a tree nobody reads), not the format bet.

---

## 4. Architecture

One bundle at `docs/okf/`. Two layers distinguished by **frontmatter, not directory**, so a module's curated and generated documents sit together where work happens.

```
docs/okf/
  index.md              okf_version: "0.2" — the router; SessionStart injects this
  log.md                repo-wide decision history
  platform/             stack, repo-layout, environments, deploy, ci-gates, commands
  conventions/          backend-module, frontend-route, database-migration, house-style
  patterns/             17 concept files — one per CLAUDE.md pattern      type: Playbook
  pitfalls/             11 concept files — one per CLAUDE.md pitfall      type: Pitfall
  modules/              91 directories, one per API module
    <module>/
      index.md          progressive disclosure for this module
      overview.md       CURATED — intent, RBAC boundary, module-specific gotchas
      log.md            CURATED — decision history for this module
      apis.md           GENERATED from <module>.controller.ts
      permissions.md    GENERATED from permissions.ts + seed grants
  schema/
    <domain>.md         20 GENERATED — one per .prisma file
    tables/<Model>.md   255 GENERATED
  ops/runbooks/         existing docs/ops + Cloud Scheduler provisioning
  decisions/            YYYY-MM-DD-<slug>.md — PRDs, superpowers specs, archived handoffs
```

Size of the finished bundle:

| Group | Files | Layer |
|---|---|---|
| `schema/tables/` + `schema/<domain>.md` | 255 + 20 = 275 | generated |
| `modules/<m>/apis.md` + `permissions.md` | up to 91 + 91 = 182 | generated |
| `modules/<m>/` index + overview + log (36 documented) | 108 | curated |
| `modules/<m>/index.md` stubs (55 undocumented) | 55 | curated, `status: draft` |
| `patterns/` + `pitfalls/` | 17 + 11 = 28 | curated |
| `platform/`, `conventions/`, `ops/`, `decisions/`, root | ≈27 | curated |
| **Total** | **≈675, of which ≈457 generated** | |

Two thirds of the bundle is machine-written. That ratio is the point: the hand-maintained surface is ≈220 files, and only 28 of them hold knowledge that exists nowhere else in the repo.

**Table docs live exactly once**, at `/schema/tables/<Model>.md`. Module documents link to them rather than restating. Ownership of a model by a module is frequently ambiguous across 255 models, and the spec's position is that a link is how a relationship gets asserted.

### Frontmatter contract

Generated document:

```yaml
---
type: Prisma Model
title: AriaKnowledgeArticle
description: One row per curated ARIA knowledge article.
resource: packages/database/prisma/schema/comms.prisma
tags: [comms, aria]
status: stable
generated:
  by: okf-gen/schema
  at: 2026-08-17T00:00:00Z
sources:
  - packages/database/prisma/schema/comms.prisma
---
```

Curated document:

```yaml
---
type: Pitfall
title: Express route order
description: Literal paths must register before :param routes or they are shadowed.
tags: [backend, express, routing]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---
```

`generated` is present on derived docs and absent on curated ones. That single key is the layer boundary, and it is what the staleness gate keys on.

### Generators

| Command | Source of truth | Output |
|---|---|---|
| `okf:schema` | 20 `packages/database/prisma/schema/*.prisma` | 255 `schema/tables/<Model>.md` + 20 `schema/<domain>.md`. Body: column table, `@@map`, indexes, relations as bundle-absolute links to sibling table docs. |
| `okf:api` | `apps/api/src/modules/index.ts` mounts + 97 `*.controller.ts` `Router()` blocks | `modules/<m>/apis.md`: method, path, `requirePermission` code, validation schema, **in registration order**. |
| `okf:permissions` | `apps/api/src/common/constants/permissions.ts` + `seed.ts` / `seed-prod.ts` role grants | `modules/<m>/permissions.md`, noting codes the Admin role bypasses via `auth.service.resolvePermissions`. |

Notes:

- Some modules export more than one route set (`helpdeskPublicRoutes`/`helpdeskRoutes`, `legalPublicRoutes`/`legalRoutes`, `adminRoutes`/`adminUsageRoutes`). `okf:api` must emit all sets for a module, labelled.
- Emitting routes in registration order makes the literal-before-`:param` rule an auditable artifact rather than a warning. That rule has already caused two incidents.
- Generated files carry a "do not hand-edit — run `pnpm okf:generate`" header in the body.

### Injection layering

`SessionStart` and `UserPromptSubmit` provably inject context in this harness. `PostToolUse` `hookSpecificOutput.additionalContext` is documented ("Context injected back to model") with a worked PostToolUse example. **`additionalContext` on `PreToolUse` is not documented** — the fields marked PreToolUse-only are `permissionDecision`, `permissionDecisionReason`, and `updatedInput`. Matchers match tool names only; path scoping comes from the separate `if` field using permission-rule syntax (`if: "Edit(apps/api/src/modules/**)"`), and the hook additionally receives `tool_input.file_path` on stdin.

Three tiers, in order of certainty:

1. **`SessionStart`** injects `docs/okf/index.md`. Guaranteed to fire. Keep the router ≈50 lines — a table of contents, not content.
2. **`PreToolUse` on `Edit|Write`**, `if: "Edit(apps/api/src/modules/**)"`, first touch per module per session (state keyed by `session_id` under the scratchpad). Emits `permissionDecision: "ask"` with `permissionDecisionReason` naming the module index — or silent `additionalContext` if the pipe-test proves that field works on PreToolUse.
3. **`PostToolUse` fallback**, documented-good `additionalContext`. Fires after the edit: too late for the first mistake, correct for the rest of the session.

Which of tiers 2 and 3 carries the weight is decided by pipe-testing during PR5, not by assumption. Tier 1 alone already improves on prose.

### What `CLAUDE.md` becomes

- **Stays inline, in full** — rules whose violation is expensive and whose trigger is unpredictable: Express route order, worktree absolute paths, `escapeHtml` on email interpolation, Tailwind literal class maps, paginated aggregates.
- **Becomes a router** for everything else: one-line titles plus bundle-absolute links, under the rule *before editing under `apps/api/src/modules/<m>/` or `apps/web/src/app/(dashboard)/<m>/`, read `docs/okf/modules/<m>/index.md`; before writing a migration, read `docs/okf/conventions/database-migration.md`.*
- Target size ≈5K, down from 27.5K.
- `CONTEXT.md` and `AGENTS.md` are **deleted**, their content absorbed into `platform/`, `conventions/`, and `patterns/`. Triplication is resolved by removal, not by more cross-references.

---

## 5. CI gates

Five checks, joining the existing four PR gates (type-check, lint, test, brand-drift).

| Gate | Asserts | Failure mode caught |
|---|---|---|
| Conformance | every non-reserved `.md` under `docs/okf/` has parseable frontmatter with non-empty `type`; `index.md`/`log.md` never used as concepts; root index carries `okf_version: "0.2"` | spec violation |
| Link integrity | every bundle-absolute `/…` link resolves to an existing concept | broken knowledge graph |
| **Coverage** | each of the 28 `- **`-prefixed bullets in `CLAUDE.md` at the migration commit maps to **exactly one** file under `patterns/` or `pitfalls/` | a dropped rule |
| Staleness | `pnpm okf:generate --check` regenerates to a temp directory and diffs | generated docs drifted from source |
| `stale_after` | reports curated docs past their date | rot — **warns, never blocks** |

The coverage gate is the control on this project's blast radius. It is a marker-count assertion, not a review: a conflict-free port can silently drop hunks while `tsc` stays green, so counted markers are the only proof that holds.

Link integrity is stricter than the spec, which requires consumers to tolerate broken links. We enforce it for our own bundle because a dangling link inside a tree we generate is a bug, not a tolerated condition.

---

## 6. Sequencing — five PRs, each revertable alone

1. **Skeleton + curated crown jewels.** Bundle root, conformance + link + coverage tests, `patterns/` (17) and `pitfalls/` (11) as concept files. `CLAUDE.md` untouched — nothing removed, so the coverage gate goes green before it has to protect anything.
2. **Generators.** `okf:schema`, `okf:api`, `okf:permissions`, plus the `--check` staleness gate. Generated layer appears; no deletions.
3. **Root de-duplication.** `platform/` + `conventions/` absorb `CONTEXT.md` and `AGENTS.md`; both deleted; `CLAUDE.md` trimmed to hard rules + router. The only PR that can lose knowledge — and it cannot merge unless PR1's coverage assertion still passes.
4. **Monolith split.** `modules/<m>/overview.md` + `log.md` for the 36 documented modules; `MODULES_SPECIFICATION`, `API_SPECIFICATION`, `AUTH_RBAC`, `DATABASE_SCHEMA` retired; the 6 `HANDOFF*.md` archived under `decisions/` with `status: deprecated`. The 55 undocumented modules get stub `index.md` files at `status: draft`, turning hidden absence into a countable backlog.
5. **Hooks.** `SessionStart` router injection plus the tier-2/tier-3 decision, after pipe-testing which events actually inject.

Each PR gets its own implementation plan. The first plan covers **PR1 only** — it installs the safety net every later PR depends on, and its coverage assertion has to be proven working before PR3 is allowed to remove anything.

Retirement, not deletion, for docs with inbound references: `status: deprecated` plus an archive location. A stale document that announces itself stale is safer than a dangling reference to a file that vanished — the same lesson as retiring a permission code while `role_permission` rows still point at it.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Tree gets built, never read | Layered injection (§4); tier 1 is guaranteed to fire |
| PR3 silently drops a rule | Coverage gate from PR1 blocks the merge |
| Generated docs drift from source | `okf:generate --check` diff gate |
| Renames break the graph (concept id = path) | Bundle-absolute links; slugs derived from stable identifiers (Prisma model name, module directory name); link-integrity gate |
| OKF v0.2 churns under us | Plain markdown in our own repo; exit is stripping frontmatter |
| Curated docs rot | `stale_after` + `verified` events; CI reports overdue docs |
| 55 undocumented modules become an invisible backlog again | Stub indexes at `status: draft` make the count queryable |

---

## 8. Decisions locked

- Scope: agent-first, full corpus (not a pilot, not human-first, not conventions-only).
- Approach: generated layer + curated overlay (not fully hand-curated, not flat conversion, generator not deferred).
- Enforcement: prose **and** hook — not prose alone.
- Bundle location: `docs/okf/`, single bundle, committed to this repo.
- Table grain: per-model (255 files), canonical under `/schema/tables/`, linked from module docs.
- `CONTEXT.md` and `AGENTS.md` are deleted in PR3.
- Google Cloud Knowledge Catalog integration is out of scope.

## 9. Open items resolved by test, not opinion

1. Does `hookSpecificOutput.additionalContext` work on `PreToolUse`? Pipe-test in PR5; falls back to `permissionDecision: "ask"` or `PostToolUse`.
2. Does the spec's `visualize` reference tool render a non-BigQuery bundle usefully? Try it in PR4; drop it if not.
3. Exact `type` vocabulary for curated docs (`Playbook`, `Pitfall`, `Reference`, `Runbook`, `Decision`). Free-form per spec; fix the list in PR1 and assert it in the conformance test so it stays stable.
