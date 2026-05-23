# Manut Launch Readiness Checklist

> **Purpose:** every gate that must be green before flipping
> `manut.xyz` from soft-launch to public-launch posture.
> **Audience:** the launch-window owner (engineering + ops).
> **Linked docs:** [MANUT_DEPLOY_RUNBOOK.md](./MANUT_DEPLOY_RUNBOOK.md),
> [MANUT_LAUNCH_COMMS_TEMPLATE.md](./MANUT_LAUNCH_COMMS_TEMPLATE.md).

Treat every box as a launch blocker unless explicitly marked as
"nice-to-have". A red box flips the launch posture from GO to NO-GO.

---

## 1. Migrations

- [ ] All five Wave-2 migrations applied to **staging** Postgres:
  - [ ] `20260520000000_add_mn_agent_memory_embedding`
  - [ ] `20260520010000_add_mn_ai_budget_usage`
  - [ ] `20260520020000_add_pinned_doc_id_to_chat_histories`
  - [ ] `20260520030000_add_user_completed_onboarding`
  - [ ] `20260520040000_add_workspace_plan`
- [ ] Same five applied to **production** Postgres.
- [ ] `pgvector` extension confirmed on both DBs:
      `SELECT extname FROM pg_extension WHERE extname = 'vector';`
- [ ] Idempotency verified locally — re-running `migrate deploy` is
      a no-op (every migration uses `IF NOT EXISTS` per CLAUDE.md §2.5).
- [ ] `prisma generate` clean on the deploy image (catches drift
      between `schema.prisma` and the applied migrations).

## 2. CI gates

- [ ] `Manut CI` green on `main`.
- [ ] `Manut Beta Security Gate` green on the beta candidate commit:
  - [ ] Workflow lint.
  - [ ] Secret scan.
  - [ ] Production dependency audit.
  - [ ] Static security scan.
  - [ ] Manut security regression guards.
- [ ] `🏗️ Manut Build` produced the `:main-<sha>-<runid>` immutable
      image in GAR.
- [ ] `tests/affine-cloud/e2e/manut/*.spec.ts` green in CI (the
      seven launch-blocking E2E specs).
- [ ] `yarn workspace @affine/server ava` green for
      `quota/__tests__/{ai-budget,tiers,storage}.spec.ts`.
- [ ] `yarn tsc --noEmit` clean across all touched packages.
- [ ] `npx oxlint` clean — pre-commit hook is green without
      `--no-verify` (CLAUDE.md §7).

## 3. Secrets + environment

- [ ] Production secrets populated (or features gracefully
      degrading per [MANUT_DEPLOY_RUNBOOK.md §2](./MANUT_DEPLOY_RUNBOOK.md#2-secrets-to-populate)):
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `MANUT_PRO_PRICE_ID`
  - [ ] `MIXPANEL_TOKEN`
  - [ ] `GOOGLE_OAUTH_CLIENT_ID` / `..._SECRET`
- [ ] Nice-to-have secrets present, OR friendly degrade verified:
  - [ ] `MODAL_API_TOKEN` (E3.1 code_run tool)
  - [ ] `EXA_API_KEY` (web search)
  - [ ] `GITHUB_OAUTH_CLIENT_ID` / `..._SECRET` (E2.1)
- [ ] `SERVER_URL` matches the OAuth redirect URI registered in GCP.
- [ ] Vertex AI service account JSON still valid; project
      `affine-495114`, locations `us-central1` + `us-east5`.

## 4. Telemetry + observability

- [ ] Mixpanel dashboard set up with funnels for:
  - [ ] signup → workspace create
  - [ ] workspace create → first chat
  - [ ] first chat → 7-day retention
  - [ ] floating chat opened → message sent
  - [ ] `/upgrade` viewed → checkout clicked
- [ ] Mixpanel sees `signup_completed`, `workspace_created`,
      `floating_chat_opened`, `chat_message_sent` in staging.
- [ ] Railway service has alerts wired for:
  - [ ] 5xx rate above 1% over 5 min
  - [ ] Boot failures (`UndefinedTypeError`, `UnknownDependenciesException`)
  - [ ] Memory > 80% of allocated for 5 min
- [ ] Sentry (or equivalent) capturing exceptions; release tag
      matches the deployed SHA.

## 5. Marketing surface

- [ ] `manut.xyz` landing live with the cloud-first copy from PR #117.
- [ ] `manut.xyz/pricing` (or in-app `/upgrade`) reflects Free vs
      Pro shape ($0 vs $20/user/mo, 2 GB vs 100 GB, $5 vs $50 AI).
- [ ] Pricing copy uses the launch-window message:
      "Bring your whole team in. No seat caps."
- [ ] `/manifesto` route renders (E3.4 brand polish).
- [ ] `/terms` + `/privacy` pages live (PR #118).
- [ ] Custom 404 page renders with personality (PR #117 / E3.4).
- [ ] OG image + favicon + apple-touch-icon serve correctly across
      Twitter, Slack, LinkedIn link previews.

## 6. Launch comms

- [ ] Twitter/X thread drafted from
      [MANUT_LAUNCH_COMMS_TEMPLATE.md](./MANUT_LAUNCH_COMMS_TEMPLATE.md).
- [ ] Hacker News Show HN post drafted, reviewed by 2+ people for
      tone (HN is unforgiving with marketing language).
- [ ] Email to existing AFFiNE-fork users drafted (subject:
      "Manut is the workspace AFFiNE became").
- [ ] Blog post outline drafted; the hero feature claim ("the AI
      workspace intelligent Gen Z grads want to use") matches
      decision #0 in IMPLEMENTATION_PLAN.
- [ ] Launch tweet scheduled for the launch window (default:
      Tuesday 9am PT / Wednesday 12am ICT for HN reach).
- [ ] All comms link to a single landing URL — no dead-end
      `/blog/...` paths.

## 7. On-call rotation

- [ ] Primary on-call assigned for the launch window
      (T-1h to T+24h).
- [ ] Secondary on-call assigned for the following 48h.
- [ ] Rollback owner identified (the same person, ideally).
- [ ] Pager rotation tested — a deliberate "test page" reaches the
      primary within 60s.
- [ ] On-call has the rollback command (see
      [MANUT_DEPLOY_RUNBOOK.md §8](./MANUT_DEPLOY_RUNBOOK.md#8-rollback-procedure))
      pinned or memorised.
- [ ] On-call knows the smoke-test sequence (§7 of the runbook).

## 8. Status page

- [ ] Status page live at `status.manut.xyz` (or equivalent).
- [ ] Components wired:
  - [ ] Web app (front door)
  - [ ] GraphQL API
  - [ ] AI chat / copilot
  - [ ] Authentication
  - [ ] Storage / uploads
  - [ ] Stripe (Pro tier checkout)
- [ ] Incident template pre-written for the most likely launch
      failure modes (boot crash, migration rollback, Stripe
      misconfigured).
- [ ] Public subscribe enabled so users can opt into status emails.

## 9. Support readiness

- [ ] Support inbox monitored during launch window (`support@manut.xyz`).
- [ ] FAQ page covers the top-five expected questions:
  - [ ] "How do I import my AFFiNE workspace?"
  - [ ] "What happens when I hit the $5/mo AI budget?"
  - [ ] "Can I self-host?" — answer: no, Manut is cloud-only.
  - [ ] "What's the difference between Manut and Notion / Obsidian / Mem?"
  - [ ] "Where's my data stored?" — answer: Railway-hosted Postgres + GCS, US region.
- [ ] Office hours for launch week scheduled.
- [ ] Pre-canned responses for "Stripe checkout error" and
      "workspace creation timed out" in the support tool.

## 10. Legal + compliance

- [ ] Terms of Service published (PR #118).
- [ ] Privacy policy published (PR #118).
- [ ] DPA template available for enterprise prospects who ask.
- [ ] GDPR-compliant data export + deletion paths exist
      (cmdk → "Export workspace", "Delete account").
- [ ] Cookie banner present where legally required (EU traffic).

## 11. Final gates (T-30 minutes)

These are the last-mile sanity checks the launch-window owner
runs immediately before flipping the switch.

- [ ] All boxes above green (or explicitly waived in writing).
- [ ] Production smoke (all six specs in
      [MANUT_DEPLOY_RUNBOOK.md §7](./MANUT_DEPLOY_RUNBOOK.md#7-smoke-test-sequence)) green within the last 60 min.
- [ ] `docs/BETA_RISK_REGISTER.md` has no open P0/P1 findings.
- [ ] `docs/BETA_GO_NO_GO.md` is filled out with commit, Railway
      deployment id, rollback target, and launch owner.
- [ ] No `[ERROR]` lines in Railway logs for the last 30 min.
- [ ] Status page reads "All systems operational".
- [ ] Comms drafts reviewed by ≥1 second pair of eyes.
- [ ] Launch announcement timed for max audience overlap (HN +
      Twitter + email all firing within a 30-min window).

If all 11 sections are green, launch posture is **GO**.
If any box is red, launch posture is **NO-GO** until resolved.

---

## Post-launch (T+24h debrief)

After the first 24h:

- [ ] Pull funnel numbers from Mixpanel; flag any cliff >50%.
- [ ] Review every Sentry / Railway error class that's new since
      launch.
- [ ] Tally Hacker News + Twitter responses; reply to top-10 with
      "thank you, will look" or "filing as issue".
- [ ] Write the post-mortem skeleton — incidents, near-misses,
      surprises. File under `docs/RELEASES/v1.13.0-launch-debrief.md`
      (or whatever the released tag is).
- [ ] Schedule a 1-week retrospective with the launch team.
