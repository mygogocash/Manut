# AGENTS.md format (Manut portability)

This document specifies the Markdown-based portability format used by
`MnPortabilityService.exportToManifest()` and consumed by
`importFromManifest()`. The format is one of the two artifacts (the
other being `manifest.json`) packaged in a `manut-export-*.tar.gz`
archive produced by `yarn manut:export-workspace`.

## Goals

1. **Human-readable.** The export should open cleanly in any Markdown
   viewer and be reviewable by a non-engineer.
2. **Round-trippable.** `parseAgentsMd(buildAgentsMd(doc))` must equal
   `doc` for any well-formed `AgentsMdDocument`. Tests in
   `m5b-agents-md-roundtrip.spec.ts` pin this guarantee.
3. **Secret-safe.** Adapter configuration is scrubbed by
   `manut-secret-scrubber.ts` BEFORE serialization. The exported
   document never carries live credentials.

## Top-level structure

```
---
<top-level YAML frontmatter (optional)>
---

## Agent <name>
---
<per-agent YAML frontmatter (optional)>
---
<free-form description (optional)>

## Skill <slug>
---
name: <display name>
version: <version>
---
<skill body in Markdown>

## Goal <title>
---
level: PROJECT | TEAM | AGENT | TASK
---
<description (optional)>
```

Sections may appear in any order. The parser groups them by header
kind (`Agent`, `Skill`, `Goal`); the builder emits agents first, then
skills, then goals, but consumers should not depend on this ordering.

## Top-level frontmatter

A YAML mapping at the top of the document. The parser surfaces it as
`doc.frontmatter` (a `Record<string, unknown>`); the builder writes
whatever keys the producer chose. Manut's export pipeline always
includes:

- `workspaceId` — the source workspace UUID.
- `exportedAt` — ISO-8601 timestamp.
- `version` — the format version, currently `manut-portability-v1`.

Unknown keys are preserved verbatim.

## Agent section

```
## Agent Customer Support Bot
---
role: support
adapter: COPILOT_CHAT_SESSION
capabilities: "Reads tickets, drafts replies, escalates on negative sentiment."
skills:
  - skill.reply-templates
  - skill.escalation-playbook
---
Handles tier-1 customer support across the inbox channels.
```

Supported frontmatter fields:

| Field          | Type     | Notes                                      |
| -------------- | -------- | ------------------------------------------ |
| `role`         | string   | Optional. Short human-readable role label. |
| `adapter`      | string   | The `MnAgentAdapterType` enum value.       |
| `capabilities` | string   | Free-form text shown in agent picker.      |
| `skills`       | string[] | List of skill slugs this agent draws on.   |

Any text after the inner frontmatter block (and before the next `##`
header) is captured as `description`.

## Skill section

```
## Skill skill.reply-templates
---
name: Reply Templates
version: 1.2.0
---
# Reply templates

When closing a ticket, use the following structure:

1. Acknowledge the issue
2. Summarise the resolution
3. Invite follow-up questions
```

- `slug` (the header argument) must be unique per workspace.
- `name` defaults to `slug` when omitted, but the builder always emits
  it explicitly to make the round-trip exact.
- `version` is the producer-controlled version string. Bumping it
  signals to consumers that the body changed.
- Everything after the inner frontmatter is the skill body. The
  parser preserves it byte-for-byte (modulo CRLF normalisation).

## Goal section

```
## Goal Reduce reply latency p95 below 4 hours
---
level: PROJECT
---
Tracked via the support analytics dashboard. Owner: Customer Support Bot.
```

- `level` must be one of `PROJECT | TEAM | AGENT | TASK`. Unknown
  levels are dropped on parse.
- Description follows the inner frontmatter.

## Full example

```markdown
---
workspaceId: 8a5e3a40-1c4b-4f7a-9c64-3d0e62a47e91
exportedAt: 2026-05-18T09:42:11.000Z
version: manut-portability-v1
---

## Agent Reply Composer

---

role: composer
adapter: COPILOT_CHAT_SESSION
capabilities: Drafts ticket replies; never sends without review
skills:

- skill.reply-templates

---

Drafts reply candidates from the ticket history. The human reviewer
approves before send.

## Agent Escalation Watcher

---

role: watcher
adapter: COPILOT_CHAT_SESSION
capabilities: Watches sentiment + SLA timers

---

## Skill skill.reply-templates

---

name: Reply Templates
version: 1.2.0

---

Use the three-step template for closing tickets.

## Skill skill.escalation-playbook

---

name: Escalation Playbook
version: 0.4.0

---

Escalate when sentiment drops below -0.4 OR SLA timer exceeds 70%.

## Skill skill.style-guide

---

name: Brand voice
version: 2.0.0

---

Plain prose, no jargon, never apologise.

## Goal Reduce reply latency p95 below 4 hours

---

## level: PROJECT

## Goal Maintain CSAT > 4.5 stars

---

## level: PROJECT
```

## Parser caveats

- **CRLF normalisation.** `\r\n` is rewritten to `\n` before parsing.
  Outputs are always LF-only.
- **BOM stripping.** A leading UTF-8 BOM is stripped silently.
- **Lenient YAML.** Inner frontmatter blocks may be empty (just `---`
  followed by `---`), in which case the parser produces a section with
  no metadata fields.
- **Unknown sections.** `## Notes` or any other `##` header that
  isnt `Agent | Skill | Goal` is silently dropped. The format isnt
  a general extension point; treat it as a fixed schema.
- **No HTML.** Don't embed `<script>` or raw HTML in skill bodies;
  consumers may render them as plain Markdown only.

## Secret scrubbing

`manut-secret-scrubber.ts` walks the manifest JSON before export and
replaces any of these with the sentinel string `<scrubbed>`:

- Object fields whose name matches
  `/^.*(secret|key|token|password|credential|auth).*$/i`.
- Standalone scalar strings matching `/[A-Za-z0-9+/=_-]{32,}/`
  (high-entropy base64-ish tokens).

The scrubber is conservative — false positives are preferred to
leaked credentials. The replacement is a constant string so the
scrubbed output never reveals length or character class of the
original value.

On import, `MnPortabilityService.importFromManifest` detects the
sentinel anywhere in `adapterConfig` / `runtimeConfig` and logs a
warning per agent; the placeholder is preserved in the database so
the operator can replace it via the workspace settings UI.

## File layout

A `manut-export-<workspaceId>-<timestamp>.tar.gz` archive contains:

```
manifest.json
AGENTS.md
settings.json
skills/<slug>.md
```

`manifest.json` is the canonical machine-readable form; `AGENTS.md`
is the human-readable mirror. They MUST describe the same agents,
skills, and goals — the import tool reads `manifest.json` for the
structured data and `AGENTS.md` only for cross-checking.
