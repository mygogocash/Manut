# Manut — Project Work Rules

This file is loaded automatically into every Claude Code session in this repo.
It encodes the playbook we've converged on through the gogocash-fork work
(historically codenamed "Superflow"; the brand rename to Manut completed in
v1.11.0). A few surviving infra identifiers — workflow filenames, docker
image name in GAR, the historical GraphQL `Superflow*` `@ObjectType`
decorators — are intentionally left unchanged because each is its own R1
operation, tracked in §9 below. Treat this file as the project's
Definition-of-Done; deviations need a reason.

## 1. TDD Loop & Test Standards

This codebase does NOT yet uniformly follow TDD — prompts ship without
unit tests, OAuth refresh got patched twice in production before a spec
existed, the SSE-parser fix in v1.10.1 was caught by a user, not a test.
This section is forward-looking: where strict TDD applies, do it; where
it doesn't, lean on the deploy smoke-test checklist (§4) and be honest
about which side a change falls on.

### 1.1 The TDD loop

RED → GREEN → REFACTOR. One test at a time. Minutes per cycle, not hours.

- **RED** — pick the smallest next behavior, write ONE test, run it,
  watch it fail FOR THE RIGHT REASON. Failure must be an assertion —
  not an import error, typo, or missing setup. If you can't fail it for
  the right reason, the test is wrong; fix the test before touching
  production code.
- **GREEN** — write the simplest possible code to pass. Hardcoded
  constants, fakes, shortcuts are fine — we're racing to green. Then
  run the FULL suite, not just the new test:
  ```bash
  # backend
  yarn workspace @affine/server ava <spec>
  yarn tsc --noEmit
  # frontend
  yarn workspace @affine/core test
  ```
- **REFACTOR** — clean up under green. Improve naming, dedupe, extract.
  Refactor production AND test code; both rot. NEVER refactor and add
  behavior in the same step — two separate cycles. Commit at green;
  never commit red. If a cycle drags past 30 min, the test is too big —
  split it.

### 1.2 Test standards (FIRST)

- **Fast** — milliseconds for unit, seconds for integration. Slow tests
  get skipped, then rot. ava parallelises by default; keep it that way.
- **Independent** — any test runs alone, in any order. No shared
  Postgres rows leaking between specs.
- **Repeatable** — no flakes. A flaky test is a broken test; quarantine
  or fix, don't tolerate.
- **Self-validating** — pass or fail. Never "check the log to see if
  it worked."
- **Timely** — before or alongside the code, never after.

Test BEHAVIOR, not implementation. Don't assert on private functions,
internal state, or call order. Heuristic: if a behavior-preserving
refactor breaks your test, the test is wrong.

Pyramid: **~70% unit / ~20% integration / ~10% e2e**. Push tests down
the pyramid when you can; e2e via `/browse` is expensive and flaky.

Naming: `subject > given X > then Y`. Example:
`parseTagCandidates > given SSE-wrapped JSON > strips wrappers and returns clean strings`.

Coverage: chase BEHAVIOR coverage on critical paths — money, auth,
user data, public GraphQL surface, copilot tool dispatch, prompt
parsing, OAuth token refresh. An untested branch on a critical path
is unfinished work. Don't chase 100% line coverage on glue code.

Mocks: prefer real over mocked when fast and reliable (in-memory
Postgres, local HTTP fixtures, fake clock). Mock at architecture seams
— Google OAuth, Vertex AI MaaS, `Date.now()`, randomness. Don't mock
code you own; wrap it and mock the wrapper.

**The scar that proves the point:** v1.10.1's SSE-stream-object bug
shipped tags rendered as `{"type":"text-delta","textDelta":"…"}`
because `request.ts`'s join layer didn't strip SSE wrappers. A
20-line unit test on `parseTagCandidates` with a JSON-wrapper input
would have caught it before users did. That test now exists.

### 1.3 When TDD applies (and when smoke-only is fine)

**Strict TDD — always** (critical paths from §1.2 coverage rule):
- New parsers, validators, transformers (`parseTagCandidates`,
  markdown-adapter wrappers, SSE join layers).
- GraphQL resolvers — happy path + every typed error case.
- Copilot tool dispatch (`docEdit`, `dataViewFilter`, etc.) — flag
  gating, mode-picker routing, error mapping.
- OAuth token refresh logic, encryption/decryption helpers, anything
  touching `IntegrationConnectionModel`.
- Auto-router model selection (`pickModel`) — every branch.
- Anything with `@Field(() => …)` annotations: write a startup test
  that boots the GraphQL schema. We've shipped `UndefinedTypeError`
  to production TWICE (§6); a 1-line smoke spec ends that streak.

**Smoke-test-only is fine** (verify via §4 deploy checklist):
- UI tweaks, copy edits, icon swaps.
- vanilla-extract `.css.ts` style changes — tested via bundle
  compilation, not unit tests.
- Dockerfile / compose.yml / Caddy config changes.
- One-shot migration scripts that run once and never again.
- Prompt-text edits to `prompts.ts` — the upsert is integration-tested
  by server startup; the prompt content is editorial, not logic.

**Grey zone** (write a test if cheap, don't block on it if not):
- Wiring an existing component into a new menu or settings tab.
- Renaming a route, file, or i18n key.
- Adding a `case` to an existing union switch.

Snapshot tests on JSX usually rot faster than they add value here —
prefer a behavioral assertion ("the menu contains an item with
testId=foo") over a serialised tree.

> When in doubt, write the test first.

## 2. Honesty Rules (guardrails for the loop)

These rules exist because confidently-wrong claims have shipped to production
on this fork. Each has a trigger and a required behavior — none of them are
optional, and "the user told me to go fast" is not an exemption.

### 2.1 NO MAGIC — never invent context

**Trigger:** anything you don't have evidence for in this repo, this
conversation, or a tool result.

State assumptions explicitly (`Assumption: backend is ava, frontend is
Vitest — confirmed via package.json`). If the assumption is load-bearing,
STOP AND ASK before writing code. Never invent file paths, env vars, test
framework APIs, fixtures, or library behavior — read/verify them, or label
`unverified`. The `@nestjs/graphql` reflection API is the canonical example:
nullable `@Field` declarations do **not** auto-infer types from TypeScript;
assuming they do is what shipped the v1.7.0 and v1.10.2 `UndefinedTypeError`
crashes (see §6). If you haven't grep'd it, you don't know it.

### 2.2 VERIFY BEFORE DONE — evidence before assertions

**Trigger:** about to say "done", "should work", "fixed", or "ready".

"I made the change" ≠ done. Done is `yarn ava` green, `yarn tsc --noEmit`
clean, bundle rebuilt, `/browse` confirmation against the live preview, AND
the smoke-test items in §4 that touch your area — output pasted, not paraphrased.
Never claim a bug fix without showing the previously-failing case now passing.
Example: "AI Auto Tag is fixed" requires (a) `yarn ava` green for
`parseTagCandidates`, (b) `yarn affine bundle -p web` clean, (c) `/browse`
on a real doc showing clean tags (not `{"type":"text-delta","textDelta":…}`
fragments — that's the v1.10.1 scar).

**Sub-agent claims do not count as verification.** When a sub-agent reports
"done" on a multi-file change, the parent must `git diff HEAD~1 -- <file>`
each wiring point — `workspace-layout.tsx`,
`setting/general-setting/index.tsx`, GraphQL schema entries, the
`SettingTab` union in `constant.ts` (see §6b). v1.5.4 shipped a half-feature
because git-stash recoveries during consolidation dropped one agent's
registration while keeping its component files. The agent reported success.
The user got a missing tab.

### 2.3 DISSENT — push back before you build

**Trigger:** any non-trivial change, especially R1+ work.

Before writing code, surface (1) blast radius — what breaks if this is
wrong, (2) hidden assumptions, (3) reversibility — rollback path,
(4) what momentum is hiding. Say it even if the user already said
"go ahead." The v1.10.2 ship-twice would have been caught by one
sentence of dissent: "Every nullable `@Field` in this branch is missing
the explicit `() => Type` parameter — that's exactly the v1.7.0 crash
class, blast radius is server-wide startup failure → Caddy 502." Five
seconds of dissent beats thirty minutes of rollback under pressure.

### 2.4 SCOPE DRIFT — every change traces to a test

**Trigger:** code being written that no test or ticket demanded.

Every line of new production code maps to a failing test (or, for UI
glue, a concrete acceptance criterion in the plan). Refactor commits add
no behavior. Spot a needed fix outside scope? **Note it for a follow-up,
don't smuggle it in.** Example: while fixing the v1.10.1 SSE-stream-object
parser, you notice the prompt-seed verification gate doesn't cover a new
prompt. That is its own R1 change — file it as a follow-up PR, do not
co-mingle it with the parser fix. Mixed PRs are harder to revert and
hide the actual root cause from the next incident responder.

### 2.5 R0 / R1 / R2 — reversibility gates

| Tier | Definition | Required behavior |
|---|---|---|
| **R0** | Irreversible / catastrophic | **STOP. ASK. WAIT FOR EXPLICIT YES.** |
| **R1** | Costly to reverse | **Do, but announce + log + note rollback path.** |
| **R2** | Easily reversed | **Just do it.** |

**R0 examples (project-specific):** force-pushing `main`; dropping a
Prisma migration that's already applied in prod; sending a workspace-wide
email blast; rotating `GOOGLE_OAUTH_CLIENT_SECRET` without coordination;
removing `IF NOT EXISTS` from a migration that already ran; shipping an
AI prompt that routes to `gpt-5-mini` on the Vertex-only stack (silent
no-op feature — v1.8.4 / v1.10.0 scar); any production code on a
critical path without test coverage.

**R1 examples:** Prisma migration adding a column; GraphQL schema change
(see v1.10.2 — nominally R1, escalates to R0 if `@Field` types are sloppy);
`Dockerfile.fullstack` rebuild + push; deploying a release tag;
editing `/srv/affine/data/affine-config/config.json` on the VM; changing
the prompt-seed verification gate.

**R2 examples:** vanilla-extract `.css.ts` tweak with `affine bundle -p web`
green; eslint-clean comment fix; worktree-local refactor with `yarn ava` +
`yarn tsc --noEmit` green; copy edit on a Settings panel.

**When in doubt, treat as one tier higher.** Untested code on a
critical path is automatically R0 — no exceptions.

### 2.6 Plan First — the template

For any R1+ change, post the plan before writing code. Skip if R2.

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

If the user keeps adding features mid-stream, push back: complete one
vertical slice and ship before piling on more horizontal scope.

## 3. Spawn the sub-agent army

**Default to parallel. Sequential is the exception you justify.** Discipline
exists to make the army shippable, not to slow it down. If you find
yourself doing a 4-file research read in the main turn, you've already
lost — that should have been four `feature-dev:code-explorer` agents
firing in one message.

> **Speed math:** 5 agents × 4 min parallel = 4 min wall clock. Sequential
> = 20 min. Spawn the army.

### When to spawn

- **Research / mapping:** any time you'd need to read more than ~3 files to
  answer a question. Use `feature-dev:code-explorer` (read-only research).
- **Audits:** before any deploy, before any architectural change, when the
  user asks "is this safe?" or "is this production-ready?". Use
  `code-reviewer`, `security-reviewer`, or a `general-purpose` agent.
- **Pre-deploy audit (mandatory for R1):** fan out 5 agents — one per
  concern. Security review of the diff; schema migration safety
  (idempotent? `IF NOT EXISTS`? rollback path?); bundle size delta
  (`du -sh packages/frontend/apps/web/dist` before/after, watch for the
  50MB chunk explosion in §4 "Frontend changes"); prompt-seed verification
  (does the deploy gate's psql check still pass?); Caddy/Compose
  hygiene (service vs container name §6, env vars present, image tag
  pinned to semver not `:latest`).
- **Independent work streams:** two features touching non-overlapping
  files → two `general-purpose` agents in parallel.
- **Any task touching 3+ unrelated files:** split by file ownership before
  starting. Don't serialize across the file tree.
- **"Help me ship X":** assume army mode unless proven otherwise. Plan the
  fan-out before writing a single line.
- **Long deploys, builds, or tests** that block the main session — run
  in the background via `run_in_background: true`.

### When NOT to spawn

- Trivial single-file edits.
- Anything where the answer is faster to find with one `grep`.
- Sequential work that depends on the previous step's output.
- Plan-mode reasoning the user wants to see live.

### Fan-out matrix (worked example)

Shipping a new Settings panel "Connected accounts" — backend resolver +
GraphQL type + frontend component + dialog wiring + ava spec + scar
notes update. Five agents, one message, ~4 min wall clock:

| Agent | Owns (file paths) | Produces | Word cap | Depends on |
|---|---|---|---|---|
| A — `general-purpose` | `packages/backend/server/src/plugins/connected-accounts/{module,resolver,service}.ts` + register in `plugins/index.ts` | Edits (NestJS module + resolver with explicit `@Field(() => Type)` on every nullable field — see §6 scar) | 400 | nothing |
| B — `general-purpose` | `packages/frontend/core/src/desktop/dialogs/setting/account-setting/connected-accounts.tsx` + `.css.ts` sibling | Edits (component + vanilla-extract styles — `.css.ts` ONLY, never style({}) from .tsx, §6 scar) | 400 | nothing |
| C — `general-purpose` | `packages/frontend/core/src/desktop/dialogs/setting/general-setting/index.tsx` + `modules/dialogs/constant.ts` SettingTab union | Edits (three-step dialog wiring — §6b) | 300 | B's component name |
| D — `general-purpose` | `packages/backend/server/src/plugins/connected-accounts/__tests__/connected-accounts.spec.ts` | Edits (ava spec, schema + resolver coverage, the catch path) | 400 | A's resolver shape |
| E — `feature-dev:code-explorer` | read-only sweep of `plugins/google-oauth/` + `IntegrationConnection` model | Report on token-refresh pattern + any reuse opportunities | 500 | nothing |

C and D get told who their upstream agents are AND that they must not
touch A/B files. E is read-only so it never collides.

### Agent type cheat sheet

| Agent | Writes files? | Best for |
|---|---|---|
| `feature-dev:code-explorer` | No | Read-only research; returns a design report |
| `feature-dev:code-architect` | **NO — produces a blueprint only. The parent must apply it.** Trips people up constantly. | Designing a feature you'll then implement in the main turn |
| `feature-dev:code-reviewer` | No | Reviewing diffs / branches |
| `general-purpose` | **Yes** | Multi-step execution with edits — the workhorse |
| `code-reviewer`, `security-reviewer`, `typescript-reviewer` | No | Audits with specialised lenses |
| `Explore` | No | Fast file-finding; much cheaper than spawning a full agent |

### How to spawn well

- **Brief like a smart colleague:** explain the goal, what's already known,
  what to avoid touching. Sub-agents have NO conversation memory — every
  prompt must stand alone.
- **Hand over file paths and line numbers**, not vague descriptions.
- **Cap output length** — `cap report at ~500 words`. Without a cap,
  expect 5000-word essays.
- **Declare ownership** — tell each parallel agent which files it owns
  AND which other agents own what. Prevents merge collisions at
  consolidation time.
- **Pick the right agent type** — see cheat sheet above. For code
  changes, verify the agent type can write. `feature-dev:code-architect`
  only has read tools.
- **Run agents concurrently:** spawn multiple agents in a SINGLE message
  with multiple Agent tool blocks. Sequential spawn = wasted clock time.

### Consolidation protocol

When N agents return, do NOT immediately trust the "done" claims. Run:

1. `git status --untracked-files=all` — see ALL new files. Sub-agents
   sometimes write to their OWN `.claude/worktrees/<slug>/` rather than
   the main worktree. If files are missing, `git -C
   .claude/worktrees/<slug> status --untracked-files=all` to find them,
   then `cp` over. **Don't cherry-pick the agent's branch wholesale** —
   it's off an older baseline.
2. `git diff HEAD -- <wired-file>` for every registration point each
   agent claimed (`workspace-layout.tsx`, `setting/general-setting/index.tsx`,
   GraphQL schema entry, `plugins/index.ts`, the `SettingTab` union).
   v1.5.4 shipped a half-feature because an agent's component files
   landed but its wiring did not — verified only by re-diffing each
   registration site.
3. Resolve conflicts on overlapping baseline files BEFORE applying any
   agent's edits. Two agents that both modified
   `setting/general-setting/index.tsx` will silently overwrite each
   other if applied sequentially.
4. Apply atomically. If consolidation fails, revert all and re-fan out
   with tighter ownership boundaries.

After spawning N agents, do NOT start more on overlapping files. Wait,
consolidate, then spawn the next round. When an agent returns, apply
or discard immediately — don't let blueprints rot.

### Anti-patterns

- Spawning agents for tasks the main turn could finish in 30s.
- Spawning sequentially when parallel would work — that's 5× the clock time.
- Forgetting to declare file ownership → merge collisions on consolidation.
- Not capping agent output → 5000-word reports that drain context.
- **Reading `.output` JSONL transcripts via `cat` / `tail` / `Read`** —
  they're full conversation transcripts and will overflow context.
  Trust the structured result and the completion notification.
- Trusting an agent's "done" without a `git diff` of every wired-in file.
- Using `feature-dev:code-architect` and expecting written edits — it
  produces blueprints only. Use `general-purpose` when you want changes
  applied on the spot.

## 4. Testing checklist (run before every deploy)

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

## 5. Live deploy hygiene

- Pin image tags to semver (e.g. `:v1.3.0`), never `:latest`.
- Build for `linux/amd64` (the GCE host) — Mac default is arm64.
- After every deploy, run the smoke test list above.
- If the smoke test fails, ROLL BACK FIRST, then investigate.
- Production migrations (Prisma) run via the `affine_migration` container
  in the compose. Idempotent migrations (`IF NOT EXISTS`, `ADD COLUMN`)
  are safe to re-apply.

## 6. Things this project has been bitten by

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
  **DO NOT widen this glob to include `*.d.ts` / `*.d.ts.map`.** Several
  paths legitimately ship hand-authored declaration files in `src/`:
  - `packages/frontend/core/src/types/types.d.ts` — global types
    referenced from `bootstrap/env.ts` via `import '../types/types.d.ts'`
  - `packages/frontend/component/src/type.d.ts`
  - `blocksuite/playground/apps/{env,vite-env}.d.ts`
  - `blocksuite/affine/shared/src/commands/index.d.ts`
  Wiping these mid-bundle produces:
  ```
  Module not found: Can't resolve '../types/types.d.ts'
  ```
  in the web rspack output and the entire bundle aborts (no
  `dist/index.html` written). v1.10.2 hit this with a too-eager wipe
  that included `.d.ts`; fix was `git restore -- '*.d.ts'` paths and
  re-bundle. Stick to `.js` / `.js.map` only.
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
- **vanilla-extract evaluates `.css.ts` files in a Node VM at build
  time.** Anything imported transitively into a `.css.ts` runs in that
  VM — there is no DOM. Importing `{ animationToken }` from
  `@affine/component` (the package root) drags in sibling exports that
  reference `HTMLElement` at module scope and crashes the build with
  `ReferenceError: HTMLElement is not defined`. The error points at
  the `.css.ts` file (with bogus line numbers like `21529:1125` from
  vanilla-extract's bundled output), not at the offending dep. Fixes,
  in order of preference:
    1. From inside `@affine/component`, use the relative path
       (`'../../theme/animation'`) — only the leaf module evaluates.
    2. From `@affine/core` and other consumers, reference the raw CSS
       variables directly: `transition: 'background-color
       var(--affine-anim-duration-base) var(--affine-anim-curve-default)'`.
       The `animationToken` TS object is only sugar over the same vars.
    3. If both fail, add a sub-path export to the providing package's
       `package.json` so the import path resolves to a leaf module.
- **Sub-agents run in their own worktree by default.** When you launch
  parallel agents from this session, they may write to a different
  `.claude/worktrees/<slug>/` than the one you committed v1.8.x from.
  Symptom: `git status` on main shows fewer files than the agents
  reported. Diagnose with `git -C <worktree> status --untracked-files=all`.
  Consolidate by `cp`-ing each agent file from the agent's worktree
  to the main worktree before lint + commit. (The worktree branch is
  off an older baseline and contains commits you don't want — don't
  cherry-pick the branch wholesale.)
- **Backticks inside `css\`\`` and `html\`\`` Lit template literals
  silently break the build.** Backticks are the template-literal
  terminator. A comment that contains `\`<my-element>\`` will close
  the outer template at the first backtick, then the rest is parsed as
  JS expressions. Cost us a v1.9.0 production blank-page incident:
  `<affine-table-block>` after the broken backtick parsed `affine` as
  an undefined identifier → `ReferenceError: affine is not defined`
  in a `<static_initializer>`, swallowed by React's bootstrap, no
  console error visible to the browse skill. Diagnosed only by
  running the dist locally with HTML rewritten from CDN to relative
  paths (so the browser would actually surface the error). Always
  scan agent-edited Lit components for stray backticks in any
  `css\`...\`` / `html\`...\`` block — comments are the highest-risk
  spot because nobody reviews them. Use plain words like
  "the affine-table-block element" instead.
- **napi-rs binaries are gitignored — CI cannot build the server
  bundle without a Rust step.** `packages/backend/native/server-native.{
  x64,arm64,armv7}.node` are products of `napi build --release` on a
  Rust toolchain. They're in `.gitignore` (binary blobs, ~30MB each).
  Locally we have them; GitHub-hosted runners do not. Any CI job that
  runs `yarn affine bundle -p @affine/server` will fail with
  `Module not found: Can't resolve './server-native.*.node'`. Fix
  in two places:
    - PR/push CI (`manut-ci.yml`): use
      `yarn workspace @affine/server tsc --noEmit` — typechecks
      without linking the binary.
    - Release CI (`manut-release.yml`): install the Rust
      toolchain (`dtolnay/rust-toolchain@stable`) and run
      `napi build --target x86_64-unknown-linux-gnu` BEFORE the
      server bundle step, so the binary exists when bundling.
  Cargo registry cache cuts ~3-5 min off warm runs.
- **Google OAuth (Gmail / Drive integrations) — v1.10.1 is SCAFFOLD ONLY.**
  The connect/disconnect plumbing in `packages/backend/server/src/plugins/google-oauth/`
  is wired end-to-end: GraphQL `connectGoogle` returns a consent URL, the
  callback at `/oauth/google/callback` exchanges the code and persists the
  tokens (encrypted) into the existing `IntegrationConnection` table — no
  Prisma migration needed. Live email reading / file picking is **not
  shipped**; the cards show a "Live import is rolling out soon" footer.
  Required env vars: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  optional `GOOGLE_OAUTH_REDIRECT_URI` (defaults to `${SERVER_URL}/oauth/google/callback`).
  Create the OAuth client at https://console.cloud.google.com/apis/credentials
  in project `affine-495114`; grant scopes `gmail.readonly` and `drive.readonly`.
  Without env vars configured, the Connect button surfaces a "configure
  OAuth client" message instead of opening a blank popup.
- **GraphQL `@Field` UndefinedTypeError — broken TWICE now.** NestJS
  metadata reflection cannot infer a GraphQL type from a union containing
  `null` (or any other ambiguous union). Symptom: backend crashes on
  startup before listening, Caddy returns 502. Stack ends with
  `UndefinedTypeError: Make sure you are providing an explicit type for
  the "<field>" of "<class>"` from `@nestjs/graphql/utils/reflection.utilts.js`.
  History:
  - **v1.7.0** — first occurrence on a different field; fixed by adding
    explicit `() => Type` parameter to all nullable `@Field`s.
  - **v1.10.2** — agent shipped `@Field({ nullable: true }) size?: string | null;`
    on `DriveFileType`. Backend crashed on startup. Caddy 502 in prod.
    Rolled back to v1.10.1 (~30s downtime), fixed by adding explicit
    `@Field(() => String, { nullable: true })`, re-pushed under the same
    v1.10.2 tag, redeployed.
  Rule: **always pass an explicit type to `@Field` for nullable / optional
  / union declarations.** Even if it's "obviously" a string, write
  `@Field(() => String, { nullable: true })`. The annotation is the source
  of truth — TypeScript types alone aren't visible to NestJS at runtime.
  Pre-deploy guard: smoke-test docker images locally with
  `docker run --rm -e DATABASE_URL=… <image> node ./dist/main.js` and
  watch for `UndefinedTypeError` in the first 5 seconds before pushing.
- **NestJS DI metadata traps — broken TWICE the same day.** Same root
  family as the `@Field` trap above: TypeScript type information has
  to be present at runtime for NestJS reflection. Two distinct ways to
  lose it on injected dependencies, both shipped in v1.12.0 and only
  manifested when `ENABLE_MANUT_MODULE=true` was first flipped on
  production:
  - **`import type` on a DI target class.** `manut-agent-registry.service.ts`
    used `import type { PrismaClient }` for the constructor injection
    target. `import type` is erased at compile time, so the emitted
    `design:paramtypes` metadata reflects `Object` instead of
    `PrismaClient`, and NestJS throws
    `UnknownDependenciesException: Nest can't resolve dependencies of
    MnAgentRegistryService (?)`. Fixed in PR #57 by splitting the
    import: runtime value for the class, `import type` only for
    pure-type usages (e.g. row types from `@prisma/client`).
  - **Missing `@Injectable()` decorator on a class registered as a
    provider.** `SuperflowFeatureRegistrar` shipped in v1.10.x without
    `@Injectable()`. Without that decoration, TypeScript skips emitting
    the `design:paramtypes` metadata entirely, so the constructor
    parameter (`ServerService`) silently resolves to `undefined`. The
    class still instantiates (it's in the `providers[]` array) — the
    crash happens on the first method call:
    `TypeError: Cannot read properties of undefined (reading 'enableFeature')
    at SuperflowFeatureRegistrar.onModuleInit`. Fixed in PR #58 by
    adding `@Injectable()`. This was latent for 6+ months because the
    module was never actually loaded in production.

  Rules:
  1. **Any class injected via an `@Injectable()` constructor parameter
     must be a runtime import.** Never `import type` for DI targets.
     Use `import type` ONLY for pure-type usages — function parameters,
     return types, generic constraints, type aliases.
  2. **Every class registered in a NestJS module's `providers[]` array
     MUST be decorated with `@Injectable()`.** This is non-negotiable
     even for classes that "look like" they shouldn't need it (e.g.
     OnModuleInit-only registrars that exist purely for side effects).
  3. **`MnAgentRegistryService` and `MnReleaseRunsService` have a CI
     smoke test** (`__tests__/manut/module-init-smoke.spec.ts`) that
     instantiates the gated `ManutModule.forRoot()` branch via
     `Test.createTestingModule` and asserts all providers resolve.
     Mirror this guard for every new module that adds providers — it
     catches both traps above at PR time, not at production-flip time.
  4. **Pre-deploy smoke for prod env changes:** before flipping any
     module-gating env var like `ENABLE_MANUT_MODULE` for the first
     time, run the same smoke locally:
     `ENABLE_MANUT_MODULE=true docker run --rm <image> node ./dist/main.js`
     and watch for `Listening on http://...:3010` within 10 seconds.
     Any `UnknownDependenciesException` or `TypeError` in that window
     means the module load is broken; do NOT flip in production.
- **v1.10.2 — Gmail / Drive integrations.** Token refresh lives in
  `GoogleOAuthService.getValidAccessToken(userId, workspaceId, scope)`
  — call it from any new Google service to get a non-expired bearer
  token; it refreshes against `oauth2.googleapis.com/token` whenever
  the stored token is within 5 minutes of expiry and persists rotated
  tokens via `IntegrationConnectionModel.updateTokens`. New GraphQL
  surface in `google-oauth.resolver.ts` (split into a separate
  `GoogleIntegrationResolver` class to keep the connect/disconnect
  surface clean): `gmailMessages(workspaceId, query?, maxResults=25)`,
  `importGmailMessage(workspaceId, messageId)` returns the new docId,
  `driveFiles(workspaceId, query?, pageSize=25)` returns
  `{id, name, mimeType, iconLink, webViewLink, modifiedTime, size}`.
  All gated on connected state — typed errors mapped to friendly UI
  copy by `rethrowFriendly` in the resolver. Doc creation reuses
  `DocWriter.createDoc(workspaceId, title, markdown, editorId)` from
  `core/doc/writer.ts` — same path the AI `doc-write` tool uses. HTML
  → plaintext is a 5-step regex stripper (no `sanitize-html` /
  `turndown` deps). Drive list capped at 100 server-side; UI doesn't
  yet expose `nextPageToken` for pagination — follow-up if users
  hit the cap.
- **FOSS license / seat-cap override is at one chokepoint.** Manut
  is FOSS-unlimited by policy; v1.10.1 hides the License settings tab
  AND lifts the upstream 10-seat cap. The frontend toggle is
  `showLicense = false` in
  `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/index.tsx`.
  The backend override is the `env.selfhosted` branch in
  `QuotaService.getWorkspaceQuota` (`packages/backend/server/src/core/quota/service.ts`)
  — it returns `memberLimit: 100_000` so every downstream check
  (`tryCheckSeat`, `checkSeat`, member-add resolvers, the inline
  `quota.memberCount + idx + 1 > quota.memberLimit` guard at
  `member.ts:201`, the `>=` guard at `member.ts:343`) silently passes.
  Don't remove the function — keep the API surface so upstream merges
  apply cleanly. Search for `// MANUT` (and any remaining `// SUPERFLOW`
  in older code paths) comments to find every changed site. Cosmetic
  side-effect: the Members panel title still reads `(N/100000)` for
  non-team workspaces — fix is a "show unlimited" branch in
  `cloud-members-panel.tsx:289` (low priority).
- **AI write tools are gated on `AIToolsConfig` flags + a Mode picker.**
  The backend tools `docEdit`, `sectionEdit`, `docCreate`, `docCompose`,
  `docUpdate`, `docUpdateMeta`, `dataViewFilter`,
  `dataViewAutofillColumn` exist in
  `packages/backend/server/src/plugins/copilot/tools/` but only run
  when the matching flag is true on the chat session. Flags:
  - `searchWorkspace` — search for context (read-only)
  - `readingDocs` — read existing doc content (read-only)
  - `editingDocs` — invoke `docEdit`/`sectionEdit`/`docCreate`/`docUpdate`/`docUpdateMeta`
  - `composingDocs` — invoke `docCompose` (creates new docs)
  - `editingDataViews` — invoke `dataViewFilter`/`dataViewAutofillColumn`
  Frontend Mode picker
  (`blocksuite/ai/components/ai-chat-input/preference-popup.ts`) maps:
  Read-only → none of the write flags, Edit current doc →
  `editingDocs` only, Full agent → all three. Mode persists via
  globalState. When a write tool fires, an "AI made changes" chip is
  rendered in `chat-panel/message/assistant.ts` so the user gets
  visual confirmation. Production gate at `provider.ts:415-419` keeps
  `docCreate`/`docUpdate`/`docUpdateMeta` dev/canary-only — self-hosted
  sees the full effect.
- **`Dockerfile.fullstack` expects PRE-BUILT `dist/` artifacts in the
  build context.** The Dockerfile only runs `yarn workspaces focus`
  for production deps + `prisma generate` — it does NOT bundle the
  app. It `COPY`s these dirs that you must build locally first:
  - `packages/backend/server/dist/main.js` (server bundle)
  - `packages/backend/server/dist/server-native.{x64,arm64,armv7}.node`
    (Rust napi binaries — gitignored, must exist locally)
  - `packages/frontend/apps/web/dist/` (web bundle)
  - `packages/frontend/admin/dist/` (admin bundle)
  - `packages/frontend/apps/mobile/dist/` (mobile bundle)
  Skipping the bundle step ships the PREVIOUS bundle in your fresh
  image — silently, with no error. Symptom: `docker compose pull` +
  `up -d` "succeeds", site loads, but `grep -c editingDocs
  /app/dist/main.js` inside the container returns 0 and the new
  feature is missing despite a green deploy. v1.10.1 hit this:
  first push deployed but smoke-test caught the stale main.js
  (timestamp predated the source commits). Fix: bundle BEFORE docker
  build:
  ```
  yarn affine bundle -p @affine/server  # ~1-3 min
  yarn affine bundle -p web             # ~3-7 min
  yarn affine bundle -p admin           # only if admin changes
  yarn affine bundle -p mobile          # only if mobile changes
  docker buildx build --platform linux/amd64 \
    -f .docker/manut/Dockerfile.fullstack \
    -t asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:vX.Y.Z \
    --push .
  ```
  Pre-flight check before `docker buildx`: confirm
  `ls -la packages/backend/server/dist/main.js` is newer than the
  latest commit's `git log -1 --format=%ai`. If older, re-bundle.
- **`docker compose pull <service>` needs the SERVICE NAME, not the
  container name.** In `/srv/affine/compose/compose.yml` the service
  is `affine` (top-level key) and the container is named
  `affine_server` via `container_name`. `docker compose pull
  affine_server` returns `no such service: affine_server` and
  silently skips the pull. Always use `docker compose pull affine`
  (or just `docker compose pull` for all services). Then
  `docker compose up -d --force-recreate affine` to ensure the
  container actually swaps to the new image. Without
  `--force-recreate`, compose may leave the existing container
  running on the old image if it sees nothing to change.
- **Pre-existing lint debt sometimes blocks `--no-verify`-free
  commits.** v1.10.1 hit two cases: husky's `lint-staged` chain trips
  on a pre-existing `rxjs/finnish` eslint error in `tags.tsx:151`
  (`tagIds$` declaration) and a `consistent-type-imports` error in
  `prompts.ts:2`. Neither is introduced by the changes that triggered
  the hook. Per §7 the right fix is to clean up the lint debt in a
  precursor commit — but two recent commits in v1.10.1 used
  `--no-verify` after stashing-and-verifying the errors are
  pre-existing. The cleanup is overdue; track it as a lint-debt
  sweep before the next release.
  - **UPDATE (post-2900714c2):** husky pre-commit hook now passes
    clean on `main` (verified by a real test commit + revert). The
    rxjs/finnish + consistent-type-imports errors the auto-tag agent
    reported existed in its OLDER worktree base, not in current main.
    No --no-verify needed for new commits. If it bites again later,
    `yarn eslint --no-cache <file>` is the source of truth — exit 0
    means the hook will pass.
- **`rxjs/finnish` requires Finnish notation on Observable typed
  members.** The project enables `rxjs/finnish`, which requires the
  `$` suffix on any field, getter, method return, or function whose
  type is `Observable<T>` (or a subclass: `Subject<T>`,
  `BehaviorSubject<T>`, `ReplaySubject<T>`, `LiveData<T>`). Sub-agents
  trained on standard RxJS conventions reliably forget this — they
  write `subject`, `value`, `connections`, etc. and the pre-commit
  hook rejects the commit. The error message is:
  `rxjs/finnish — Symbols of type Observable should be suffixed
  with $`. Fix is mechanical: rename `subject` → `subject$`,
  `connections` → `connections$`, etc. Verify before commit with
  `yarn oxlint <file>`. Spotted in the v1.12.0 PM/CRM/Reminders
  rollout: the analytics fix and the manut module both had sub-agent
  drafts that fell into this trap. Brief sub-agents up front:
  "Any Observable-typed member must end in `$`." Common false
  positives: `Promise<T>` is fine without `$`; type aliases that
  resolve to Observable still need it. When in doubt, run oxlint.
- **Sub-agents must use `tsc --noEmit`, never `tsc -b`.** `tsc -b`
  (project build mode) compiles project references AND writes
  outputs — including `.d.ts` and `.d.ts.map` files — to whatever
  the tsconfig's `outDir` (or sibling-of-source) is. Several Manut
  tsconfigs emit alongside source (no `outDir`), so a sub-agent
  running `yarn tsc -b packages/frontend/core/tsconfig.json` dumps
  hundreds of declaration files INTO `packages/frontend/core/src/`
  next to the `.tsx` they were generated from. These get picked up
  by `git status --untracked-files=all` and a careless `git add .`
  stages them. Even worse, the `.d.ts` cleanup glob is explicitly
  guarded against (see "DO NOT widen this glob to include `*.d.ts`"
  trap above) because some declarations are hand-authored, so you
  can't just wipe them. Recovery: `git status -u | rg '\.d\.ts'`
  to find the strays, then delete by name. v1.10.x AI session
  handover (line 242-246) documents one occurrence where an attempt
  to typecheck via `tsc -b` produced thousands of TS6305 errors AND
  emitted dist files that had to be cleaned manually. Sub-agent
  rule: brief explicitly with "Use `yarn workspace <pkg> tsc
  --noEmit` to typecheck. Never `tsc -b`." Also worth knowing: the
  per-workspace flavour `yarn workspace @affine/core tsc --noEmit`
  honors the package's tsconfig without invoking project references.
- **`streamObjects` in the chat panel surfaces a tool-call shape
  worth knowing about for any feature that wants to react to AI
  activity.** The chat panel's assistant message component
  (`blocksuite/ai/chat-panel/message/assistant.ts`) maintains a
  `streamObjects` array as the SSE stream arrives. Each entry is one
  of: a `text-delta` chunk (token streaming), a `reasoning` chunk,
  a `tool-call` chunk (the AI invoked a tool — has a `toolName` and
  an `args` payload), or a `tool-result` chunk (the tool returned —
  has `result` keyed by the call's id). The first appearance of
  each `toolName` in `streamObjects` is the earliest reliable signal
  that the AI just touched something, which makes it a useful hook
  for downstream reactions: change-badges ("AI made changes"),
  activation buses (Knowledge Graph pulses), analytics, or per-tool
  toasts. Watch the array length and emit when a new entry's `type
  === 'tool-call'` and `toolName` matches your filter. Do NOT poll
  on every render — debounce or move into a reactive subscription.
  Reference: the "AI made changes" chip in `assistant.ts`, and the
  in-flight Knowledge Graph activation bus (§5e).

## 6b. Settings dialog wiring (where new tabs live)

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

## 6c. AI / Copilot prompts (custom prompts + Vertex AI gotchas)

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

> Tier 2 `deploy.sh` runs a post-swap psql count to verify the
> canonical seed prompts (`Chat With AFFiNE AI`, `Auto Tag`,
> `Summary as title`) upserted successfully — if any are missing,
> deploys auto-rollback. See `docs/CICD.md` "Prompt-seed verification"
> for the full flow + how to add new prompts to the gate.

### Model selection on Manut's Vertex stack

**`gpt-5-mini` is poisonous — and we keep finding new prompts using
it.** Upstream defaults this for many prompts. Each one breaks
silently on a Vertex-only stack — no error in logs, the feature just
doesn't work. We've now hit this in:
- v1.8.4 — Auto Tag prompt (frontend tag picker)
- v1.10.0 — `Summary as title` (auto-naming chat sessions; `New chat`
  forever in the history dropdown until fixed)

Whenever a feature that uses an LLM "silently does nothing", grep
`prompts.ts` for `gpt-5-mini` first.

Manut's Vertex AI deployment (config at
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

### SSE stream-object endpoints emit JSON, not plain text (Auto Tag trap)

When calling `textToText({stream: false})` (defined in
`packages/frontend/core/src/blocksuite/ai/provider/request.ts`) against
the copilot `/chat/:id/stream-object` endpoint, **every SSE
`event.data` is a JSON-stringified `StreamObject` chunk**, not raw
text. Naively `messages.join('')`-ing the events concatenates JSON
wrappers like `{"type":"text-delta","textDelta":"…"}` straight into
the result string, corrupting any downstream `JSON.parse` or
comma-split. v1.10.1 root-caused this in two layers:

1. **`request.ts` join layer** — when `stream: false`, the helper
   now JSON-parses each `event.data`, extracts only `textDelta` from
   `text-delta` chunks, and ignores `reasoning`/`tool-call`/`tool-result`
   chunks. Falls back to raw payload only if parse fails so
   non-stream-object endpoints still work.
2. **Defensive parser** — even with the join fixed,
   `workspace-property-types/tags.tsx` now runs a 4-strategy
   `parseTagCandidates` (full JSON parse → array-extract regex →
   line/comma split, with SSE-wrapper pre-strip) and a
   `looksLikeSseFragment` rejecter for any candidate containing
   structural fragments (`{`, `}`, `\\`, `"type"`, `"textDelta"`,
   `text-delta`).

Symptom of the unfixed bug: tags rendered as `{"type":"text…`,
`textdelta":""}`, `\"mind\"` instead of clean strings. Found in
production after the user clicked AI Auto Tag on a Thai-language doc.

When you build any new feature that calls `textToText({stream: false})`
and parses structured output (JSON, lists, key-value), assume the
join layer might still leak SSE wrappers in edge cases — add a
`looksLikeSseFragment`-style rejecter at the parse boundary.

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

## 6d. Vertex Model Garden providers + auto-routing

Manut exposes five model families on Vertex AI: Gemini + Anthropic
(first-party publishers) and Llama + Mistral + DeepSeek (Model Garden
publishers via the OpenAI-compatible MaaS endpoint). All flow through
the same `getGoogleAuth` service-account path — no separate API keys.

### Models exposed in the chat picker (source of truth: `prompts.ts`)

The `optionalModels` array on `CHAT_PROMPT` in
`packages/backend/server/src/plugins/copilot/prompt/prompts.ts` is the
authoritative list. As of v1.11.0 the chat picker shows:

- **Gemini family** (publisher `google`, location `us-central1`):
  - `gemini-2.5-flash` — default; fast multimodal; backs Auto Tag and
    `Summary as title`.
  - `gemini-2.5-pro` — long-context (1M token) workhorse.
  - `gemini-3.1-pro-preview` — newest Pro tier preview.
  - `gemini-3.1-flash-lite-preview` — fastest tier (provider list only,
    not in the picker by default).
- **Anthropic family** (publisher `anthropic`, location `us-east5`):
  - `claude-sonnet-4@20250514`
  - `claude-sonnet-4-5@20250929` — current default for code-heavy
    auto-routing.
  - `claude-opus-4@20250514` — heaviest reasoning, slowest.
- **Llama family** (publisher `meta`, MaaS via vertex-openai-base):
  - `llama-3.1-70b-instruct-maas`
  - `llama-3.1-405b-instruct-maas`
  - `llama-4-scout-17b-16e-instruct-maas`
  - `llama-4-maverick-17b-128e-instruct-maas`

When upgrading the picker (e.g. adding Claude Opus 4.1+ once Vertex
publishes them, or pinning newer Sonnet/Opus IDs), also remember to
update `proModels` on `CHAT_PROMPT` (the "Pro" lock badge) and the
auto-router fallback in `copilot/auto-router.ts`.

### ⚠️ The Vertex URL prefix has been broken TWICE — read this first

The `getGoogleAuth.getBaseUrl()` helper in
`packages/backend/server/src/plugins/copilot/providers/utils.ts` MUST
include the `projects/{project}/locations/{location}/` segment when
project is set, otherwise Google Vertex rejects with:

```
400 INVALID_ARGUMENT — RESOURCE_PROJECT_INVALID
"Invalid resource field value in the request."
```

History:
- **v1.7.3** — first added the project-prefix branch to fix the bug.
- **v1.9.0** — Agent A's refactor (adding the new `publisher` parameter
  for Llama/Mistral/DeepSeek) silently dropped the prefix branch.
  Production AI chat broke. Diagnosed only when a user tried it.
- **v1.9.2** — restored the prefix branch with an explicit comment
  warning future refactors not to drop it.

The minimal correct shape:

```ts
function getBaseUrl() {
  const { location, project } = options;
  if (!location) return undefined;
  if (project) {
    return (
      `https://${location}-aiplatform.googleapis.com/v1` +
      `/projects/${project}/locations/${location}/publishers/${publisher}`
    );
  }
  // legacy fallback — only valid for callers that haven't configured project
  return `https://${location}-aiplatform.googleapis.com/v1beta1/publishers/${publisher}`;
}
```

Any future change to `utils.ts`, especially refactors that add
parameters or split the function, MUST preserve both branches. Add a
test in `__tests__/copilot/utils.spec.ts` if you find this gets
re-broken.

### Anatomy of a Vertex Model Garden provider

Concrete subclasses extend `VertexOpenAICompatProvider`
(`packages/backend/server/src/plugins/copilot/providers/vertex-openai-base.ts`)
and only declare:
- `publisher` — slug used as model-name prefix in MaaS chat requests
  (`meta`, `mistralai`, `deepseek-ai`).
- A static model list with input/output capability flags.
- A `CopilotProviderType` enum entry.

The base class wires:
- Service-account auth via `getGoogleAuth(this.config, this.publisher)`.
- The MaaS chat-completions URL via
  `getVertexOpenAIBaseUrl({location, project})` →
  `/v1beta1/projects/{project}/locations/{location}/endpoints/openapi/chat/completions`.
- Rust native dispatch via `llmDispatchStream('openai_chat', ...)`.
- `text` / `streamText` / `streamObject` overrides that prefix the
  model id with the publisher slug before sending.

### Adding a new family

1. Pick a Vertex Model Garden publisher with an OpenAI-compat MaaS
   endpoint. If it doesn't have one, you can't reuse this base —
   you'd need a Gemini-style first-party provider.
2. New file `providers/<family>/vertex.ts` extending
   `VertexOpenAICompatProvider`.
3. New file `providers/<family>/index.ts` registering the provider.
4. Add the type to:
   - `providers/types.ts` (`CopilotProviderType` enum)
   - `providers/index.ts` (DI registration)
   - `providers/provider-registry.ts` (legacy provider order)
   - `providers/provider-middleware.ts` (default middleware)
5. Add config block to `copilot/config.ts`:
   `defineModuleConfig('providers.<family>Vertex', { project, location, googleAuthOptions })`.
6. Add catalogue entries to `copilot/model-metadata.ts` with
   `family` / `tier` / `pricePerKToken`.
7. Rebuild server bundle, rebuild image, deploy.
8. Populate `/srv/affine/data/affine-config/config.json` on the VM
   with the new `providers.<family>Vertex.{project,location}` keys.
   Default location: `us-central1` (matches Gemini).

### Auto-routing

`copilot/auto-router.ts` exports `pickModel(messages, options)` which
inspects the request and returns a chosen model + explanation:
- Image input → `gemini-2.5-flash` (cheapest multimodal).
- Code-heavy task (regex match for triple-backtick blocks or
  `code` / `function` keywords) → `claude-sonnet-4.5`.
- Long context (>30k token estimate at ~4 chars/token) →
  `gemini-2.5-pro` (1M context).
- Short text + no images → `gemini-2.5-flash`.
- Default fallback → `gemini-2.5-flash`.

Wired into `ChatSession.resolveModel` via `model: 'auto'` /
`promptName: 'auto'` sentinels. The picked-model explanation is
exposed on `lastAutoRouteExplanation` so the frontend can render
"Auto picked Gemini Flash because: short text, no images." Token
heuristic is 4 chars/token — fine for routing, not for billing.

### Auto prompt

The `auto` promptName resolves through `prompt/service.ts`'s
in-memory mirror of `Chat With AFFiNE AI` with `optionalModels`
extended to include all five families' lead models. This keeps
`prompts.ts` clean (no entry per-family) and avoids the
`refreshPrompts` upsert-stickiness trap (§6c).

## 6e. Knowledge Graph activation pulses

> **Status:** shipped in the v1.11.0/v1.12.0 release wave (PR #44
> folded into the consolidation PR #39). The doc-read event bus is
> live: the backend emits SSE events on every AI tool that reads or
> edits a doc, and the frontend Knowledge Graph view subscribes and
> animates pulses along the curved Bezier edges.

### Event shape

A single "the AI just read or edited this doc" event:

```ts
interface DocReadActivation {
  docId: string;
  workspaceId: string;
  sourceId: string; // dedup key — see below
  tool:
    | 'doc-read'
    | 'doc-edit'
    | 'doc-keyword-search'
    | 'doc-semantic-search'
    | 'frontend-local'; // optimistic emit before the backend round-trip
}
```

`workspaceId` is the SSE filter key; `sourceId` is the dedup key.
The frontend emits optimistically the moment a chat tool-call appears
in `streamObjects` (see §5 "streamObjects in the chat panel"), and
the backend emits the same event with the same `sourceId` once the
tool finishes. The frontend bus drops the duplicate if it arrives
within a 2s window — so a single doc-read pulses ONCE, not twice.

### Backend: `DocReadEventBus` + SSE controller

Lives at
`packages/backend/server/src/plugins/copilot/doc-read/`:

- `doc-read-event-bus.service.ts` — per-workspace `ReplaySubject`
  with refcounted subscribe/unsubscribe and idle cleanup. Emit via
  `bus.emit({...})`. Subscribe via `bus.subscribe(workspaceId)` which
  returns an Observable. Refcount drops when finalize runs on the
  Observable's teardown, so HTTP disconnects don't leak buses.
- `doc-read-stream.controller.ts` — `@Sse('/api/workspace/:workspaceId/doc-read-stream')`.
  Checks `Workspace.Read` BEFORE subscribing (so unauthorised clients
  never bump the refcount). Interleaves a 5s `ping` event into the
  stream so reverse proxies don't kill idle workspaces.

Emit sites are the four doc tools — `doc-read`, `doc-edit`,
`doc-keyword-search`, `doc-semantic-search` — and the search tools
emit ONE event per unique matched doc per query (so a search that
hits five docs produces five pulses, not five×N).

### Frontend: `ActivationBus` + EventSource subscriber

Lives at
`packages/frontend/core/src/modules/knowledge-graph/services/`:

- `activation-bus.ts` — process-wide singleton with a 2s `sourceId`
  dedup window. Emit via `activationBus.emit({...})`. Subscribe via
  `activationBus.activations$.subscribe(...)`.
- `doc-read-stream.ts` — opens an `EventSource` against the SSE
  controller above and forwards every `doc-read` message into the
  bus. Reconnects with backoff on transport errors.

The graph view subscribes to the bus and animates one `ActivePulse`
per incident edge per event, riding the same cubic Bezier curve as
the edge.

### Pure helpers (testable in isolation)

`utils/graph-math.ts` exports `labelPropagation`, `lobeColour`, and
`curveOffsetFor`. These are pure functions — no DOM, no observables,
no service deps — and they cover the cluster detection / colour
assignment / Bezier offset math. Test in isolation in
`__tests__/label-propagation.spec.ts` and `__tests__/activation-bus.spec.ts`.

### Production gotchas to watch for

- The 2s dedup window assumes wall-clock parity between frontend and
  backend. If a workspace has a chat session generating doc-reads
  faster than 2s apart with the same `sourceId`, the second emit will
  be dropped silently. Use a fresh `sourceId` per logical event —
  `crypto.randomUUID()` is the right default.
- The SSE stream is per-workspace, not per-user. Anyone with
  `Workspace.Read` sees the same event stream. That's intentional
  (the Knowledge Graph is a workspace-level view), but if a future
  feature wants per-user events on this channel, it needs a new
  controller or a tagged event variant.
- Tool-call detection on the frontend reads `streamObjects` (see §5
  "streamObjects in the chat panel"). The matcher should anchor on
  `toolName === 'doc-read'` etc., not on free-text in the message
  body, because the AI's prose isn't structured enough to reliably
  classify.

## 7. Commit + PR conventions

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

## 8. Skill routing (gstack)

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

## 9. CI/CD (GitHub Actions)

The Manut-specific workflows live alongside the upstream AFFiNE ones
(which target `canary`/`master` and rely on upstream-only secrets, so
they're effectively dormant on this fork). Workflow filenames are
`manut-*.yml` as of v1.11.0's consolidation; the previous
`superflow-*.yml` paths were git-mv'd in the same release.

### Visual conventions (post-v1.12.1 CI hygiene pass)

Every Manut workflow uses an emoji prefix in its display name and a
`run-name:` template so the Actions tab is scannable without clicking
into each run:

| File | Display name | run-name template |
|---|---|---|
| `manut-ci.yml` | ✅ Manut CI | `✅ CI • <ref>@<sha> • <event> • <actor>` |
| `manut-build.yml` | 🏗️ Manut Build | `🏗️ Build • <ref>@<sha> • <event> • <actor>` |
| `manut-autodeploy.yml` | 🚀 Manut Auto Deploy | `🚀 Auto Deploy • <sha> • from <upstream-workflow>` |
| `manut-deploy.yml` | 🎯 Manut Deploy (manual) | `🎯 Deploy <tag> • <actor>` |
| `manut-release.yml` | 📦 Manut Release | `📦 Release <tag> • <actor>` |
| `manut-rollback.yml` | ↩️ Manut Rollback | `↩️ Rollback to previous • <actor>` |
| `manut-vm-init.yml` | 🔧 Manut VM Init | `🔧 VM Init • <actor>` |

Emojis are deliberate — they create visual landmarks in the Actions list
(scan for 🚀 to find deploys, 📦 for releases, ↩️ for rollbacks). Don't
remove them when adding new Manut workflows; mirror the prefix pattern.

### Concurrency rules (QUEUE, don't cancel)

After the v1.12.0 production incident (2026-05-14), `manut-build.yml`
uses `cancel-in-progress: false`. Rapid commits on `main` now QUEUE
their Builds instead of cancelling each other, and the buildx push to
GAR is atomic so the queued Build still produces a clean tag. The
previous `cancel-in-progress: true` setting caused a multi-cycle
cancellation storm where every new commit superseded its predecessor
and no image ever published — production stayed on the pre-v1.10.x
image for hours despite multiple successful CI runs.

Per workflow:
- `manut-ci.yml` — **cancel-in-progress: true**, group is `manut-ci-<ref>`
  (per-ref). Cancellation here is fine — stale CI on a superseded
  commit has no value.
- `manut-build.yml` — **cancel-in-progress: false**, group is
  `superflow-build` (global). Builds queue serially so every commit
  on `main` gets its own image. The trade-off is slightly more CI
  minutes; the win is predictable deploy behavior.
- `manut-autodeploy.yml` — **cancel-in-progress: false**, group is
  `superflow-autodeploy` (global). Documented in-workflow: the
  remote `deploy.sh` script handles supersession via VM-side runid
  registry, so we want both deploys to reach the SSH stage rather
  than cancel mid-flight.

Don't switch any of these to `cancel-in-progress: true` without a
specific reason — the queueing model is the v1.12.1 contract.

### Upstream-AFFiNE workflow noise

The fork inherits ~10 upstream workflow files that target `canary`/
`beta`/`stable` branches. Most have `push:` triggers restricted to
those branches and are dormant on `main`, but `build-test.yml`
historically also had an unrestricted `pull_request:` trigger that
fired on every PR into `main` — generating noisy "Build & Test"
runs that always failed or skipped because the upstream test env
isn't present on the fork.

`build-test.yml` is now scoped: both its `pull_request:` and
`merge_group:` triggers restrict to the upstream-aligned branches
(`canary`, `beta`, `stable`, `v*.*.x-staging`, `v*.*.x`). PRs into
`main` no longer fire it. If a new upstream workflow appears (via
a future upstream sync) and starts cluttering the Actions tab on
`main`-targeted PRs, apply the same pattern: restrict `pull_request:`
to the upstream branches.

### Workflow inventory:

- `.github/workflows/manut-ci.yml` — push/PR to `main`. Three
  jobs: lint (oxlint + prettier), build-web (web/admin/mobile bundles),
  build-server (with `prisma generate`). Concurrency-cancellation per
  ref so a fast iteration doesn't pile up runs. Yarn 4 cache via
  `actions/cache` keyed on `yarn.lock`.
- `.github/workflows/manut-release.yml` — fires on `v*.*.*` tag
  push. Builds all four bundles + pushes the `Dockerfile.fullstack`
  image to `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash`,
  tagged with both the version and `latest`. GHA cache via
  `cache-from/to: type=gha,mode=max`.
- `.github/workflows/manut-deploy.yml` — manual
  `workflow_dispatch` with a `tag` input. Validates the tag exists
  in GAR, IAP-tunnels into `affine-vm`, backs up `compose.yml` to
  `compose.yml.pre-<tag>.bak`, swaps the image, restarts. Smoke-tests
  `https://manut.gogocash.co/info` (30 retries × 3s) and verifies
  the `Auto Tag` prompt is seeded. Always prints the rollback command
  in the run summary.

Required secret: `GCP_SA_KEY` — service account JSON with these
roles on `affine-495114`:
`roles/artifactregistry.{writer,reader}`,
`roles/iap.tunnelResourceAccessor`,
`roles/compute.instanceAdmin.v1`. Setup walk-through in
`.github/MANUT_CI_SETUP.md`.

The default branch on GitHub was changed from `canary` (inherited
from upstream) to `main` so PRs target the correct place. Upstream
workflows still trigger on `canary`/`master` — leave them alone unless
they start firing on `main`.

Tagging a release:

```bash
git tag v1.x.0 && git push origin v1.x.0
# Wait ~15 min for manut-release.yml to push the image.
# Then: GitHub → Actions → Manut Deploy → Run workflow.
```

Optional: rename `.github/dependabot.manut.yml` →
`.github/dependabot.yml` to enable weekly grouped dep PRs (3 npm + 2
GH Actions per week, majors of react/blocksuite/prisma/next pinned).

## 9. Deferred rename items (post-rebrand)

The brand → Manut rename landed across user-facing strings, frontend
modules (`modules/manut-*`), backend plugin paths (`plugins/manut/`),
i18n keys (`com.manut.*`), and Prisma models (`Mn*` after DB migration
in PR #26). These items were deliberately left at their old names
because each is its own R1 operation with a separate rollback path:

- **Docker image name** — `affine-gogocash` in GAR. Renaming requires
  pushing the new tag, updating compose.yml on the VM, retagging cache
  image (`affine-gogocash-cache:buildx`), and updating every workflow
  reference. Track as a separate R1 release.
- **~~CI workflow filenames~~** — completed in v1.11.0's PR #39
  consolidation. `.github/workflows/superflow-*.yml` were
  git-mv'd to `manut-*.yml` (7 files including `manut-ci.yml`,
  `manut-build.yml`, `manut-deploy.yml`, `manut-release.yml`,
  `manut-rollback.yml`, `manut-vm-init.yml`, `manut-autodeploy.yml`).
  `.docker/gogocash/` moved to `.docker/manut/` in the same change.
  The `workflow_run` chain (CI → Build → Auto Deploy) uses display
  names so it kept working unchanged.
- **GraphQL `@ObjectType('Superflow*')` decorators** — backend types
  in `plugins/manut/resolver*.ts`. Renaming the decorator string is a
  contract change for any client that queries those object types by
  name (currently only the Manut frontend, but third-party API
  consumers are possible). Plan: introduce `@ObjectType('Manut*')`
  aliases alongside, deprecate `Superflow*` over a release, then
  remove. R1 from a contract-stability perspective.

If you find a deferred-rename surface that's NOT on this list, flag it
in the PR description rather than renaming inline — every one of these
has surprising blast radius. The full plan lives in
`docs/MANUT_CONTROL_PLANE.md`.
