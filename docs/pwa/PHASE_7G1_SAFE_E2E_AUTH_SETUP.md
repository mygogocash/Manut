# Phase 7G-1 — Safe E2E authentication setup

## STATUS: **BLOCKED — E2E AUTH SETUP INCOMPLETE**

The infrastructure is built, wired and verified as far as it can be without a credential.
**No E2E account exists yet**, so login, session, logout, deep-link, RBAC and mobile
authentication remain unverified.

**Zero production code changed.** No API, database, Prisma, business module,
authentication-implementation or RBAC change.

---

## 1. Why it is blocked

`E2E_EMAIL` and `E2E_PASSWORD` are unset, in the environment and in every `.env*` file
(checked by **name only**; no value was read or printed). No storage state exists.

**I did not create the account.** Doing so would mean provisioning a user and choosing a
password inside the shared dev/staging Supabase — that belongs to whoever owns the tenant,
not to a verification phase. §9 has the exact steps.

The rotated System Admin credential was not used, not read, and git history was not
searched.

---

## 2. What was delivered

Everything except the account itself, and every part of it verified.

| Piece | State |
|---|---|
| `e2e/auth.setup.ts` | written — env-only credentials, no fallback |
| `e2e/storage-state.ts` | written — shared path constant |
| `playwright.config.ts` | `setup` project + 3 authenticated projects with `dependencies` and `storageState` |
| `.gitignore` | `playwright/.auth/` + `*.storageState.json` — **verified with `git check-ignore`** |
| `.env.example` | `E2E_EMAIL=` / `E2E_PASSWORD=` — **values blank, confirmed** |
| `e2e/authenticated/` | the migrated specs, no credentials |
| Leaked credential in specs | **removed — zero occurrences remain in the working tree** |

---

## 3. The security fix this phase actually shipped

Phase 7G reported a **P1 operational hazard**: `pnpm test:e2e` attempted logins with the
committed System Admin credential, because `auth.spec.ts` and `leave.spec.ts` had it inline.

Both are migrated. The credential literal is **gone from the working tree**, and every
business assertion was preserved verbatim (Step 25) — only the login mechanism changed.

| Before | After |
|---|---|
| `e2e/auth.spec.ts` — 4 public tests + 2 credential tests + a 3-test authenticated block | `e2e/auth.spec.ts` — **public sign-in behaviour only** |
| `e2e/leave.spec.ts` — logged in per test with the literal | `e2e/authenticated/leave.spec.ts` — **same 3 assertions**, session from storage state |
| — | `e2e/authenticated/session.spec.ts` — the migrated shell/navigation tests plus reload and cross-page session checks |

**Demonstrated, not asserted.** Running the whole matrix with no credentials present:

```
1 failed        setup — "E2E_EMAIL is not set"
14 did not run  authenticated specs, correctly gated behind the failed setup
46 passed       all unauthenticated coverage
10 skipped      PWA/a11y specs (production server not running)
```

**Zero login attempts.** In Phase 7G the same command tried to authenticate as the System
Admin.

---

## 4. Auth architecture as found (unmodified)

Sign-in posts to Supabase Auth; the API resolves the Prisma user, roles and permissions per
request; the session rides httpOnly cookies with a silent refresh on 401.

Three behaviours shaped the setup and are worth recording, because the previous specs got
two of them wrong:

1. **The landing path is not always `/dashboard`.** `auth-provider.tsx:266` sends
   Employee-only accounts to `/my-portal`. The old specs waited on `**/dashboard**`, which a
   dedicated non-admin account — quite possibly Employee-only — would never reach. The setup
   accepts either.
2. **`mustChangePassword` diverts to `/change-password`.** A freshly provisioned account
   commonly lands there. The setup detects it and fails with an explanation rather than
   hanging, and deliberately does **not** change the password itself: rotating a credential
   from inside a fixture would leave it somewhere nobody expects.
3. **`?redirect=` is honoured** and validated against open redirects, so deep-link testing in
   7G-2 will work.

---

## 5. Credential handling

```ts
function required(name: "E2E_EMAIL" | "E2E_PASSWORD"): string
```

Throws when absent, naming the variable and pointing at this document. **There is no
fallback** — not to a seed account, not to an admin, not to a literal. A silent fallback is
how a suite ends up authenticating as somebody it should not, which is the state this
repository was in.

Verified output with nothing set:

```
Error: E2E_EMAIL is not set.
Authenticated E2E requires a dedicated non-admin test account.
Set E2E_EMAIL and E2E_PASSWORD in your environment (or CI secrets).
Never hardcode them, and never reuse an employee's own credentials.
```

No value is printed, logged, asserted on, or written anywhere but the gitignored state file.

---

## 6. Project topology

```
setup                        → logs in once, writes playwright/.auth/user.json
  ├─ authenticated-chromium        testMatch e2e/authenticated/**
  ├─ authenticated-mobile-safari   iPhone 13
  └─ authenticated-tablet-safari   iPad Mini

chromium | mobile-chrome | mobile-safari | tablet-safari
                             testIgnore e2e/authenticated/**
```

The split matters: **unauthenticated coverage keeps working on a machine with no
credentials**, which is how public-route, PWA and contrast verification survived every phase
so far.

`setup` is pinned to Desktop Safari because WebKit is the only engine currently installed.
Storage state is cookies plus localStorage, so it is engine-agnostic — any browser can
produce it and all of them can consume it. Change that line freely once the other binaries
are installed.

---

## 7. Test matrix

| Test | Chromium | iPhone WebKit | iPad WebKit | Status |
|---|---|---|---|---|
| Login | BLOCKED¹ | BLOCKED² | BLOCKED² | no account |
| Landing page | BLOCKED | BLOCKED | BLOCKED | |
| Refresh session | BLOCKED | BLOCKED | BLOCKED | spec written |
| Navigation | BLOCKED | BLOCKED | BLOCKED | spec written |
| Deep link | BLOCKED | BLOCKED | BLOCKED | not written — 7G-2 |
| Logout | BLOCKED | BLOCKED | BLOCKED | not written — 7G-2 |
| Protected route | BLOCKED | BLOCKED | BLOCKED | |
| StorageState reuse | BLOCKED | BLOCKED | BLOCKED | wiring verified, reuse not |
| Basic RBAC | BLOCKED | BLOCKED | BLOCKED | |
| **Missing-credential failure** | **PASS** | N/A | N/A | fails safely, names the variable |
| **Authenticated specs gated** | **PASS** | **PASS** | **PASS** | 14 did not run |
| **Unauthenticated unaffected** | BLOCKED¹ | **PASS** | **PASS** | 46 passed |

¹ Chromium binary not installed. ² needs the account, not the engine.

### Security matrix

| Item | Status |
|---|---|
| Password hardcoded | **NONE** — removed from both specs |
| Token hardcoded | NONE |
| StorageState committed | **NO** — gitignored, verified with `git check-ignore` |
| Credentials logged | NO |
| Credentials in screenshots | NO — login never ran |
| Credentials in traces | NO — login never ran |
| `.env` committed | NO — `.env.example` carries blank names only |
| Gitignore protected | **YES** |
| CI secrets referenced | **NOT CONFIGURED** — see §8 |
| Admin account used | **NO** |

---

## 8. CI

**CI SECRET CONFIGURATION REQUIRED.**

No workflow runs Playwright today — `pr-checks.yml` runs type-check, lint, unit tests and
the brand-drift gate only. No E2E job was added: that is a pipeline decision, and adding one
that always fails for want of a secret would be noise.

When E2E goes into CI it needs `secrets.E2E_EMAIL` and `secrets.E2E_PASSWORD` mapped to the
same variable names, plus `pnpm exec playwright install --with-deps`. `test:e2e` invokes
Playwright directly rather than through turbo, so no `turbo.json` `globalEnv` entry is
needed.

---

## 9. Prerequisites for Phase 7G-2

Exactly four things, in order:

1. **Provision a dedicated non-admin account** in the dev/staging tenant. Not a real
   employee's login; not the System Admin.
2. **Grant it the minimum for the 7G-2 workflows** — read on dashboard, projects, project
   requests, project board and task detail, plus whatever the approval path needs. Grant
   nothing extra because it makes tests easier. **Testing RBAC denial properly needs a
   second, more restricted account**, recorded here as a 7G-2 requirement rather than
   solved by over-granting this one.
3. **Clear `mustChangePassword`** by signing in once by hand (§4.2).
4. **Export `E2E_EMAIL` and `E2E_PASSWORD`.**

Optionally `pnpm exec playwright install chromium firefox` to complete the browser matrix.

Then `pnpm test:e2e` runs the whole thing, and 7G-2 can be executed as written.

**Also still needed for 7G-2, and not solvable here:** a safe test project with tasks, so
approval and task-move mutations do not touch production records.

---

## 10. Known limitations

1. **No account, so nothing authenticated is verified.** The setup has never performed a
   successful login — only its failure path is proven.
2. **`e2e/authenticated/session.spec.ts` assertions are unexecuted.** They are written
   against the shell as understood from source; the first real run may need adjustment,
   particularly the account-menu locator.
3. **RBAC needs a second account** (§9.2).
4. **Chromium and Firefox binaries absent**, so the authenticated matrix would currently run
   on WebKit only.
5. **Accessibility on the authenticated landing page: not run** — it needs a session. The
   `/sign-in` scan from Phase 7G still stands (contrast clean, two moderate structural
   findings).
6. **No test data** for mutating workflows (§9).

---

## 11. Release gate

**BLOCKED — E2E AUTH SETUP INCOMPLETE**, on the account alone.

Everything the phase could deliver without one is delivered and verified: environment-based
credentials, a safe failure path, storage-state protection, project topology, and the
removal of a leaked credential from the test suite. That last item is a real security
improvement that shipped today regardless of the block.

The moment `E2E_EMAIL` and `E2E_PASSWORD` exist, this phase completes itself.
