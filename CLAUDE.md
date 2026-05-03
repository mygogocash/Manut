# GoGoCash AFFiNE — Project Work Rules

This file is loaded automatically into every Claude Code session in this repo.
It encodes the playbook we've converged on through the gogocash-fork work.
Treat it as the project's Definition-of-Done; deviations need a reason.

## 1. Spawn sub-agents to speed up development

Sub-agents run in parallel and protect the main context window from large
file reads. Use them aggressively, but with discipline.

### When to spawn

- **Research / mapping:** any time you'd need to read more than ~3 files to
  answer a question. Use `feature-dev:code-explorer` (read-only research).
- **Audits:** before any deploy, before any architectural change, when the
  user asks "is this safe?" or "is this production-ready?". Use
  `code-reviewer`, `security-reviewer`, or a `general-purpose` agent.
- **Independent work streams:** if two features touch non-overlapping files,
  do them in parallel with two `feature-dev:code-architect` agents.
- **Long deploys, builds, or tests** that block the main session — run
  in the background via `run_in_background: true`.

### When NOT to spawn

- Trivial single-file edits.
- Anything where the answer is faster to find with one `grep`.
- Sequential work that depends on the previous step's output.
- Plan-mode reasoning the user wants to see live.

### How to spawn well

- **Brief like a smart colleague:** explain the goal, what's already known,
  what to avoid touching. Sub-agents have NO conversation memory — every
  prompt must stand alone.
- **Hand over file paths and line numbers**, not vague descriptions.
- **Cap output length** — `cap report at ~500 words`.
- **Declare ownership** — tell each parallel agent which files it owns and
  which other agents own. Prevents merge conflicts.
- **Pick the right agent type:**
  - `feature-dev:code-explorer` → read-only research, returns a design report
  - `feature-dev:code-architect` → produces a blueprint (does NOT write files
    unless given explicit Edit/Write tools — verify before assuming)
  - `feature-dev:code-reviewer` → reviews diffs / branches
  - `general-purpose` → tasks that need write access + multi-step execution
  - `code-reviewer`, `security-reviewer`, `typescript-reviewer` → audits
  - `Explore` → fast file-finding, much cheaper than agents
- **For CODE changes:** verify the agent type can write. The
  `feature-dev:code-architect` agents only have read tools and produce
  blueprints — the parent must apply them. Use `general-purpose` if you
  want the agent to actually edit files.
- **Run agents concurrently:** spawn multiple agents in a SINGLE message
  with multiple Agent tool blocks. Sequential spawn = wasted clock time.

### Coordination rules

- After spawning N agents, do not start more on overlapping files. Wait,
  consolidate, then spawn the next round.
- Never spawn an agent to do something the main turn could finish in 30s.
- When an agent returns, immediately apply or discard — don't let blueprints
  rot. The longer they sit, the more context decays around them.

## 2. Plan before you build

Every non-trivial change starts with a written plan. The bigger the change,
the more it pays off.

### Plan template

```
GOAL: <one sentence — what success looks like>
SCOPE IN: <files/areas this touches>
SCOPE OUT: <what we're NOT doing this round>
RISKS:
  - <thing that could break>
  - <reversibility>
STEPS:
  1. <concrete step>
  2. ...
VERIFICATION:
  - <build, test, browse, deploy probe>
ROLLBACK:
  - <one command if it goes wrong>
```

### Sizing

- **R0 (irreversible)**: dropping data, force-pushing, sending email blasts,
  rotating production secrets without coordination. STOP and ask.
- **R1 (costly to reverse)**: schema migrations, public API contracts,
  dependency upgrades, deploys. Do, but explain the plan first.
- **R2 (easily reversed)**: UI tweaks, comments, local refactors, formatting.
  Just do it.

When uncertain about the tier, treat it as one level higher (more cautious).

### Honesty rules

- Don't claim "done" without verification (build output, test results,
  preview screenshot, or live probe). "Should work" is not a status.
- State assumptions explicitly. "I'm assuming X — flag if wrong."
- Surface dissent BEFORE committing to a major change. Blast radius,
  reversibility, hidden assumptions — name them out loud.
- If the user keeps adding features mid-stream, push back: complete one
  vertical slice and ship before piling on more horizontal scope.

## 3. Testing checklist (run before every deploy)

Adapt to the change. Skip what doesn't apply, but be deliberate about it.

### Backend changes

- [ ] `yarn tsc --noEmit` — clean
- [ ] `yarn ava <relevant spec>` — pass
- [ ] If schema changed: `yarn prisma generate` — clean
- [ ] If migration: applied to local Postgres, verified tables/columns
- [ ] Server logs after restart show provider/module registration
- [ ] No unhandled promise rejections in startup logs

### Frontend changes

- [ ] `tsc --noEmit` for affected packages — clean
- [ ] `affine bundle -p web` — compiled successfully (no errors, not even
      "compiled with N errors")
- [ ] `affine bundle -p admin` and `-p mobile` if they could be affected
- [ ] Bundle file sizes look sane (no 50MB single-chunk explosions)

### Image changes

- [ ] `docker buildx build --platform linux/amd64 ... --push` succeeds
- [ ] Run `docker run --rm` against the pushed image, verify entrypoint
      binary works (e.g. `node ./dist/main.js --version`)

### Live deploy (R1)

- [ ] Backup the existing compose.yml on the VM (we keep
      `/srv/affine/compose/compose.yml.pre-<feature>.bak`)
- [ ] `docker compose pull` succeeds
- [ ] `docker compose up -d` — server reports `Listening on http://...:3010`
- [ ] Migration job exits 0 (`sudo docker inspect -f '{{.State.ExitCode}}'
      affine_migration_job`)
- [ ] Caddy returns 200 for `/`, `/api/server-config`, `/api/version`
- [ ] No `[ERROR]` lines in the last 5 minutes of `affine_server` logs
- [ ] Browse-load the home page; React mounts (`#app` innerHTML > 0,
      `__reactRoot$xxx` key on the element)
- [ ] No console.error in the live JS

### Smoke test (per feature touched)

- **AI chat:** open Intelligence sidebar → check model dropdown shows the
  expected models (Auto, Gemini, Claude, etc.) → send a test message
- **Database views:** open a database doc → "View settings" should list all
  11 layouts → switch to each, verify it renders without throwing
- **Calendar link:** Settings → Account → Integrations → Calendar → Link →
  flow completes through Google or CalDAV without `redirect_uri_mismatch`
- **Image generation:** trigger AI image action → expect a real image, not
  the chart-block style demo data fallback
- **Verified pages:** admin verifies a doc → badge appears in detail header
  AND in cmdk results

### Rollback path

The VM keeps a backup compose at `/srv/affine/compose/compose.yml.pre-<feature>.bak`.
To roll back any release in under 60s:

```bash
gcloud compute ssh affine-vm --project=affine-495114 --zone=asia-southeast1-a \
  --command='cd /srv/affine/compose && sudo cp compose.yml.pre-gogocash.bak compose.yml && sudo docker compose up -d'
```

## 4. Live deploy hygiene

- Pin image tags to semver (e.g. `:v1.3.0`), never `:latest`.
- Build for `linux/amd64` (the GCE host) — Mac default is arm64.
- After every deploy, run the smoke test list above.
- If the smoke test fails, ROLL BACK FIRST, then investigate.
- Production migrations (Prisma) run via the `affine_migration` container
  in the compose. Idempotent migrations (`IF NOT EXISTS`, `ADD COLUMN`)
  are safe to re-apply.

## 5. Things this project has been bitten by

Document the surprises — saves the next session a discovery cycle.

- **vanilla-extract `style({...})` MUST live in `.css.ts` files.** Calling
  it from `.tsx` compiles fine but throws at runtime, killing React mount
  silently. Cost us ~3 hours of "blank page" debugging.
- **rspack worker target has no CSS rule by default.** Adding ES `import 'x.css'`
  to a module reachable from a `*.worker.ts` entry breaks the worker bundle.
  Fix: add `{ test: /\.css$/, type: 'asset/source' }` to the worker rules.
- **The gogocash Dockerfile copies frontend dists onto the upstream image,
  but doesn't include the backend.** Frontend-only swaps don't ship
  `listConnections` / `isVerified` / etc. — those need the full-stack
  Dockerfile (`Dockerfile.fullstack`).
- **AFFiNE's GraphQL endpoint is `/graphql` not `/api/graphql`.** Trips up
  every probe attempt.
- **Prisma `prisma` CLI must end up in `packages/backend/server/node_modules/`**
  for the `predeploy` script to find it. The CI flow is
  `yarn workspaces focus @affine/server --production` then
  `mv ./node_modules ./packages/backend/server/`. Replicate this in any
  custom Dockerfile.
- **The bundle's worker filename includes the AFFiNE version
  (`nbstore-0.26.3.worker.js`).** A frontend bundle built from version X
  served alongside upstream's static dir from version Y will request
  workers that don't exist (Caddy serves SPA fallback HTML, browser
  silently fails). Always rebuild bundles fresh per deploy.
- **`feature-dev:code-architect` does not write files** — it returns a
  blueprint. Use `general-purpose` for write-capable agents, or apply
  blueprints from the parent turn.
- **Stale `.js` / `.d.ts` in `packages/**/src/` poisons the bundle.**
  Some host-side `tsc -b` (or `yarn affine init`) emits sibling `.js` /
  `.css.js` next to `.tsx` / `.css.ts` source. Rspack's
  `resolve.extensions` puts `.js` first, so the bundler picks the stale
  `foo.css.js` over the `foo.css.ts` that vanilla-extract was going to
  process — styles silently strip, React crashes at mount. Symptom:
  `app` div has 0 children, no console errors, all chunks load 200 OK.
  Fix: wipe before every bundle run:
  ```
  rtk proxy find packages/frontend/core/src packages/frontend/component/src \
    packages/frontend/i18n/src blocksuite -type f \
    \( -name "*.js" -o -name "*.js.map" \) -not -path "*/node_modules/*" -delete
  ```
  Hardened in `.gitignore` + `.dockerignore` (don't remove those rules).
- **Sub-agent edits can vanish during multi-agent consolidation.** When
  10 parallel agents touch overlapping baseline files (`workspace-layout.tsx`,
  `setting/general-setting/index.tsx`, etc.), git-stash recoveries and
  re-checkouts can drop one agent's wiring while keeping its component
  files. Always `git diff HEAD~1 -- <wired-file>` to verify each agent's
  registrations survived. We lost the integrations cleanup wiring this
  way and shipped a half-feature in v1.5.4.
- **Bundle invocation is `yarn affine bundle -p <pkg>` from project root.**
  `yarn workspace @affine/web run build` fails (`command not found: affine`)
  because yarn 4 doesn't auto-inject `node_modules/.bin` into PATH for
  nested scripts. The `affine` CLI is at `tools/cli/bin/cli.js` and it
  dispatches via `yarn r affine.ts`. Always invoke from root with `-p`
  (or `--package`). Aliases: `web`, `admin`, `mobile`, `@affine/server`.
- **Web bundle is chunk-split.** `index.<hash>.js` is the entrypoint, but
  route-level code lives in numbered chunks (e.g. knowledge-graph code
  ships in `<chunk-id>.<hash>.js`). When grepping the bundle to verify a
  deploy, search ALL `dist/js/*.js`, not just `index.*.js`.
- **Sub-agent `.output` files are full JSONL transcripts.** Do NOT
  `cat` / `tail` / `Read` them — they overflow context. Trust the
  completion notification and the agent's structured result. Same goes
  for the hint banner that appears on Agent tool returns: "Do NOT Read
  or tail this file via the shell tool".
- **`/*.md` in `.gitignore` hides root README.md.** The fork rule keeps
  dev notes (CLAUDE.md is whitelisted). Anything else at root needing
  to ship needs an explicit `!/<file>.md` allow. Symptom: `git add
  README.md` fails with "ignored by .gitignore". Root: `.gitignore:51`.
- **Flex layouts overflow with N+ children.** The View settings Layout
  picker was a plain flex row; once we had 7+ view types they spilled
  out the popup. Switch to a CSS grid (`repeat(4, 1fr)`) or add
  `flex-wrap: wrap`, AND drop `white-space: nowrap` from the children
  so cells don't force their own width. Same trap likely lurks in
  other dense pickers — audit before adding many options.
- **Disk-space preflight before `docker buildx`.** Mac Docker Desktop's
  disk fills surprisingly fast during iteration. Symptom: ENOSPC shows
  up mid-yarn-install with cryptic worker errors during the prep stage.
  Recovery: `docker buildx prune -af && docker image prune -af` (we
  recovered ~37GB this way once).

## 5b. Settings dialog wiring (where new tabs live)

Adding a new general settings panel needs THREE edits:

1. `packages/frontend/core/src/modules/dialogs/constant.ts` — add the key
   to the `SettingTab` union.
2. `packages/frontend/core/src/desktop/dialogs/setting/general-setting/index.tsx`:
   - import the new component,
   - add the entry in `useGeneralSettingList` (with title, icon, testId),
   - add a `case '<key>': return <Component />` in `GeneralSetting`.

Forgetting any of these silently drops the tab. The component still
exists, but the dialog never renders it. Confirm with `/browse` after
deploy: open Settings → look for the tab in the sidebar.

## 5c. AI / Copilot prompts (custom prompts + Vertex AI gotchas)

Custom AI prompts live in
`packages/backend/server/src/plugins/copilot/prompt/prompts.ts`. Adding
or editing one is a four-step dance — skip any step and the change
silently doesn't take effect:

1. `prompts.ts`: add the entry to the `prompts` array (or one of its
   sub-arrays: `textActions`, `imageActions`, `modelActions`, `chat`,
   `workflows`).
2. **Server bundle rebuild**: `yarn affine bundle -p @affine/server`.
   The prompts list is bundled into `dist/main.js`; without a rebuild
   the upsert at server startup can't see your change.
3. Frontend wrapper that invokes the prompt (e.g. AI Auto Tag is wired
   in `packages/frontend/core/src/components/workspace-property-types/tags.tsx`).
4. **Image rebuild + deploy**: `Dockerfile.fullstack` reads from
   `dist/main.js`, so the image is a snapshot of `prompts.ts` at build
   time. A code change without a deploy = no behavior change in prod.

### Model selection on Superflow's Vertex stack

**`gpt-5-mini` is poisonous.** Upstream defaults this for many prompts.
Superflow's Vertex AI deployment (config at
`/srv/affine/data/affine-config/config.json` on the VM) only routes:

- `geminiVertex` (project: `affine-495114`, location: `us-central1`)
- `anthropicVertex` (project: `affine-495114`, location: `us-east5`)

OpenAI requests 500. New custom prompts should default to:

- `gemini-2.5-flash` — same as Chat With AFFiNE AI. Fast, cheap,
  multimodal, Vertex-backed. Right choice for most one-shot tasks.
- `claude-3.5-sonnet` (or whatever the current Anthropic Vertex pin is)
  for harder reasoning that benefits from longer context.

If you must use an OpenAI model, wire up an OpenAI provider first and
update `config.json` on the VM.

### The `refreshPrompts` upsert is sticky

On every server start, prompts are upserted from the bundled
`prompts.ts`. There's one exception: rows with `modified=true` (set
when an admin edits via the admin panel) are skipped. This means:

- Hot-fixing a prompt directly in the DB **without** setting
  `modified=true` lasts only until the next server restart. Don't rely
  on it for anything but a few-minute emergency patch.
- A bundled `prompts.ts` change overrides any non-modified DB row at
  every restart.
- The right fix is always the four-step dance above. We learned this
  the hard way shipping AI Auto Tag in v1.8.3 (DB hot-fixed to gemini)
  → had to ship v1.8.4 (model baked into prompts.ts) so the fix
  survived restarts.

### Reading doc body markdown without an editor host

When a feature needs the doc's text content but doesn't have a
BlockSuite `EditorHost` (e.g. AI Auto Tag from the property panel),
the pattern is:

```ts
const store = doc.blockSuiteDoc.getStore();
const transformer = store.getTransformer();
const { MarkdownAdapter } = await import('@blocksuite/affine/shared/adapters');
const adapter = new MarkdownAdapter(transformer, store.provider);
const { file: markdown } = (await adapter.fromDoc(store)) ?? { file: '' };
```

Cap the result (we use 3000 chars) to keep prompts under token budgets.
ALWAYS wrap in `try/catch` and fall back to title-only — never let
extraction failure block the AI feature itself. Reference call sites:
`packages/frontend/core/src/blocksuite/ai/utils/extract.ts`,
`workspace-property-types/tags.tsx` (AI Auto Tag).

## 6. Commit + PR conventions

- Commit message format: `<type>: <subject>` then optional body.
  `type` ∈ `feat | fix | refactor | docs | test | chore | perf | ci`.
  Subject is imperative, ≤ 72 chars.
- Body explains WHY, not WHAT (the diff explains what).
- One logical change per commit. Mixed commits get harder to revert later.
- Don't `git add -A` blindly. Stage by name; review the staged diff before
  committing.
- **Never `--no-verify`** unless the user explicitly says so. Pre-commit
  hooks (`yarn oxlint --deny-warnings` on the whole codebase) exist for
  a reason. The codebase is currently lint-clean (cleanup landed in
  v1.8.5) — do NOT let it slide back. If a commit is failing the hook,
  fix the lint, don't bypass.
  - Verify your changes lint clean before commit:
    `yarn oxlint <file1> <file2>`.
  - If the hook flags something pre-existing in upstream files you
    didn't touch, that means new upstream debt drifted in — fix it in
    the same commit (or a precursor commit) rather than bypassing.
  - On the rare occasion the user explicitly authorises `--no-verify`,
    document the reason in the commit body.
- Never `--amend` a published commit unless the user explicitly says so.

## 7. Skill routing (gstack)

When the user invokes a slash command from gstack, the skill takes
precedence over generic plan-mode behavior. Common skills used here:

- `/browse` — drives a headless Chromium for live verification
- `/qa`, `/qa-only` — automated journey tests
- `/review`, `/ship`, `/land-and-deploy` — release flow
- `/investigate` — bug triage with minimal user back-and-forth
- `/design-review`, `/plan-design-review` — UX evaluation
- `/context-save`, `/context-restore` — session handoff

Skills are stored under `~/.claude/skills/`; their SKILL.md files are
authoritative. Never use `mcp__claude-in-chrome__*` tools — always go
through `/browse`.
