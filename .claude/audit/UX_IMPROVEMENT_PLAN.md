# GoGoCash AFFiNE — UX Improvement Plan

**Status:** v1.3.0 deployed. This plan covers what to fix next, organized
by UX principle, prioritized by impact / effort.

## Method

Each item is graded against three Nielsen-rooted heuristics that AFFiNE
specifically struggles with:

- **Visibility of system status** — does the user know what just happened
  / what's happening now?
- **Match between system and the real world** — do labels/affordances
  match user expectations from competing tools (Notion, Linear, Figma)?
- **Error prevention vs. error recovery** — does the UI prevent user
  mistakes upfront, vs. only telling them after the fact?

Plus three product-specific lenses:

- **First-run / empty-state** — what does a new user see in their first 60s?
- **Power-user friction** — what wastes a daily user's time?
- **Trust signals** — does the UI tell the truth about what the AI/system
  did, or does it bluff?

Each row carries effort (S/M/L) and impact (Low/Med/High).

## Priorities (top to bottom = ship-order recommendation)

### Tier 1 — High impact, weeks of compound payoff

| # | Issue | Heuristic | Effort | Impact | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | **Loading states everywhere.** Every async surface (chat send, doc save, calendar link, image gen, view switch) needs a visible loading affordance. We've shipped components that just go silent for 3-15s and users assume it's broken. | Visibility | M | High | Adopt the `<Loading />` skeleton that already exists in `@affine/component`. Audit all `await fetch(...)` / mutation triggers. |
| 2 | **Honest error states.** AFFiNE's "500: Something is wrong" page leaks zero diagnostic info. Replace with a panel that shows `error.message`, a copyable trace ID, and a "Reload" button. Users with bad networks should see "lost connection" not "fatal error". | Error recovery | M | High | The bundle already has `Failed to bootstrap app` + Sentry context — surface them. |
| 3 | **First-run experience.** Brand-new workspace has zero docs, zero AI history, no tooltips, no welcome tour. Compare to Notion/Linear's first-run. Add: a single onboarding doc auto-created with 3 example pages (database, journal, AI chat) + a tour overlay that fires once per user. | First-run | L | High | Linear's tour is the gold standard — 4 steps, dismissable. |
| 4 | **Truth in advertising on AI features.** Already partly addressed (audio transcription label, chart fallback) but not for: the "AFFiNE AI usage 0/10 times" copy that doesn't explain what counts as a use, the lock icon on Pro models that doesn't link anywhere, and the "Beta" badge with no explanation. | Trust | S | High | One-time copy pass. |
| 5 | **Settings → Integrations is a graveyard.** Six integration cards (Readwise / Calendar / MCP / Web Clipper / Connections), most disabled or partial, no "configure" / "learn more" links. Users click and bounce. Prioritize: hide unconfigured ones OR show explicit "Not yet configured by your admin" with a Slack/Discord deep-link. | Match-to-real-world | S | Med |

### Tier 2 — Daily-driver friction

| # | Issue | Heuristic | Effort | Impact | Notes |
| --- | --- | --- | --- | --- | --- |
| 6 | **Database view picker is a one-row strip with no preview.** Notion shows a thumbnail per layout. Add tiny SVG previews (~20 lines each) per view type — this matters more after we ship 11 layouts in v1.3.0. Otherwise users stay on Table because everything else is a guessing game. | First-run | M | High | The icons we just shipped (Timeline, Map, Chart, etc.) help — but a hover preview would close the gap. |
| 7 | **Slash menu is too long, no fuzzy search.** 60+ commands organized into groups but no search-as-you-type or recently-used pinning. A daily user types `/h2` and sees 8 candidates. | Power-user | M | High | Reorganize: group by frequency-of-use (telemetry-driven), promote the user's last 5 picks to top. |
| 8 | **No undo for destructive list / chip operations.** Unverify-doc, disconnect-provider, delete-cell — all silent on success, no toast with "Undo" for 5s. Users who misclick have to manually re-do the action. | Error recovery | M | Med | Standard toast-with-undo pattern; AFFiNE already has the toast component. |
| 9 | **Right-click context menus are inconsistent.** Some blocks have rich menus, some have nothing, some go through the editor toolbar instead. Audit + standardize: every block must support cut/copy/paste/duplicate/delete via right-click. | Match-to-real-world | M | Med | |
| 10 | **Workspace switcher hidden behind tiny avatar.** Top-left "GoGoCash" header should be a clickable workspace switcher. Currently you have to know to click the avatar. | Visibility | S | Med | One-line change — make the workspace name a `<button>` that opens the existing switcher. |
| 11 | **No keyboard shortcut hints anywhere.** Users discover Cmd+K by accident. Add a `?` keypress that opens a shortcuts cheat sheet (existing `Settings → Keyboard shortcuts` panel — surface it as a `?` overlay too). | Power-user | S | Low | |

### Tier 3 — Polish

| # | Issue | Effort | Impact |
| --- | --- | --- | --- |
| 12 | Empty-state illustrations: every empty list shows a generic "No items" gray text. Add per-context illustrations + a "Create your first X" CTA. | M | Low |
| 13 | Avatar placeholders for users without photos use the first letter of email — should use the first letter of display name when set. | S | Low |
| 14 | Date-time strings are inconsistent (`2 hours ago` vs `Apr 28` vs `2025-04-28`). Pick one relative-time helper (`date-fns/formatDistanceToNow`) and use it everywhere. | S | Low |
| 15 | Modal dialogs don't trap focus or close on Escape consistently. | S | Low |
| 16 | Sidebar nav items don't show active-route indication strongly enough — currently a 1px highlight, should be a 3px left bar + bg color. | S | Low |
| 17 | Notifications drawer empty state is "No notifications" with no helpful next step. Could show "You'll see mentions and shared-doc activity here". | S | Low |
| 18 | Theme toggle is hidden in Settings — promote to top-right corner of the app shell. | S | Low |

## Cross-cutting principles to bake in

- **Optimistic UI for all mutations.** Every network call should update the
  UI immediately and roll back on failure with a toast. Users on flaky
  networks (mobile, café Wi-Fi) get a much better experience.
- **Skeleton screens, not spinners.** Spinners say "something is happening";
  skeletons say "this is roughly what's coming." Use skeletons for
  predictable content (doc lists, member lists, view switching).
- **Disable, don't hide.** When an action is unavailable (no permission,
  feature flag off, missing config), show it disabled with a tooltip
  explaining why. Hiding makes users think AFFiNE doesn't have the feature.
- **Concrete over abstract in copy.** "Connect your Google Calendar" beats
  "Configure integration provider". Same number of words, half the
  cognitive load.
- **One primary action per surface.** Every dialog / panel should have ONE
  blue button. Multiple blue buttons (currently the Settings dialog has
  three on the same screen) tells users nothing about priority.

## Work breakdown (for a sprint plan)

If we did Tier 1 in order, sequenced agents:

```
Week 1
  Day 1-2: Issue 1 (loading states) — parallel: backend trace-ID middleware + frontend Loading audit
  Day 3-4: Issue 2 (honest errors) — single agent
  Day 5: Issue 4 (copy pass) — single small agent

Week 2
  Day 1-3: Issue 3 (first-run tour) — parallel: tour component + onboarding-doc seed
  Day 4: Issue 5 (integrations cleanup) — single agent
  Day 5: Smoke test pass + deploy v1.4.0

Week 3
  Day 1-3: Issue 6 (view picker previews) — single agent (svg per view)
  Day 4-5: Issue 7 (slash menu reorg) — single agent

Week 4
  Day 1-2: Issue 8 (undo toasts)
  Day 3-4: Issue 9 (context menus)
  Day 5: Smoke test pass + deploy v1.5.0
```

Each issue should land as one PR with: planning doc updated, code, tests
(if applicable), and a smoke-test screenshot or video showing the change.

## Measurement

Pick one metric per tier and track it:

- **Tier 1 success metric:** % of users who get past first-run within 5 min
  (not `bounce rate` — measure forward progress).
- **Tier 2 success metric:** time-to-first-AI-message median, time-to-first-
  database-create-and-customize median.
- **Tier 3 success metric:** support-ticket volume on UX-flavored issues.

Without measurement, we can't tell if the work paid off. Add PostHog events
(or whatever analytics is in place — there's an `enableTelemetry` flag in
the Telemetry component already) at the top of each Tier 1 funnel before
shipping the fix. Comparing before/after takes 2 weeks of traffic.

## What this plan is NOT

- A redesign. AFFiNE's visual style is fine; this is friction reduction.
- A feature wishlist. New AI features and view types are tracked in the
  separate "Round 2" backlog (in CLAUDE.md and the session todo list).
- Mobile work. The mobile bundle has its own UX gap inventory; out of
  scope for this plan.
