# Sidebar UX redesign — Notion-style tab modes

> **Status:** Proposal — awaiting review. No code changes yet.
> **Author:** Manut session, 2026-05-19
> **R-tier:** R1 — heavily-used component, blast radius is every authenticated session, but each phase is independently revertable.

---

## TL;DR

Replace Manut's flat 17-item sidebar with Notion's tab-strip pattern: 5 mode tabs at the top (`Home`, `Chat`, `Meetings`, `Inbox`, `Search`) swap the sidebar's body content. Visible items drop from 17 → 5–7 at a time. Shippable in 4 phases, each independently revertable.

---

## Diagnosis

The Manut sidebar inherited AFFiNE's "show every feature at the top level" structure. Today the top level shows:

```
Search, Notifications, All docs, Graph, Analytics, Journals,
Agents (Beta), New agent, Settings,
First Folder, Tags, Collections,
Trash, Import, Invite members, Template, Download App
```

That's **17 items**, ~3× Notion's primary nav density.

User-reported symptom: "brain fried, don't know what to do, drop off." Matches the textbook cognitive-overload pattern — when users see >7 ± 2 nav items, they freeze and bounce instead of choosing.

Notion's mental model (reference: screenshots in the user's session 2026-05-19): a small icon **tab strip** at the top of the sidebar (`Home / Chat / Meetings / Inbox / Search`) swaps the body. Each tab is a coherent "viewport" — `Chat` shows AI conversations + agents only, `Meetings` shows calendar events only. The user always sees ~5–7 items at a time instead of 17.

---

## Target design

### Sidebar layout

```
┌─ Workspace selector ──────────────────┐
│ GoGoCash ▾                       👤   │
├───────────────────────────────────────┤
│ [🏠] [💬] [📅] [📥]  [🔍]              │  ← tab strip
├───────────────────────────────────────┤
│                                       │
│  (Body content for active tab)        │
│                                       │
│                                       │
├───────────────────────────────────────┤
│ Trash · Templates · Import · ⋯ More   │  ← utility footer
│ Invite · Settings · Help              │
└───────────────────────────────────────┘
```

### Tab → content mapping

| Tab | Body content | Today's equivalent |
|---|---|---|
| 🏠 **Home** (default) | Docs tree, folders, tags, collections, favorites | All docs, Journals, First Folder, Tags, Collections, Favorites |
| 💬 **Chat** | AI conversation list + agents + "New chat" | Intelligence page (currently a content-area route, no sidebar entry) |
| 📅 **Meetings** | Upcoming / Today / Past 30d / Calendars | Calendar plugin (buried in Settings → Integrations) |
| 📥 **Inbox** | Notifications, invites, comments, mentions | Notifications button |
| 🔍 **Search** | Global search input + recents + suggested | Search button |

### Utility footer (always visible)

`Trash · Templates · Import · Settings · Invite · Help`

These are valid features but low-frequency for daily use. They don't deserve permanent prime nav real estate.

### Outcome metric

- Items visible at any moment: **17 → 5–7**
- Time-to-decision on first load: should improve materially (no formal A/B planned for V1; rely on qualitative)
- Existing users keep all features — just one click further away for the utility set

---

## Answers to the 5 design questions

### 1. Tab order

**Recommendation: `Home / Chat / Meetings / Inbox / Search`**

Rationale: Home-first preserves orientation for AFFiNE migrators. Chat in slot 2 gets prime real-estate as the differentiator (Manut's positioning leads with AI). Notion uses `Home / Chat / Meetings / Inbox / Search` and the pattern is now muscle-memory for many users — fight the muscle memory only with strong reason.

### 2. Mobile parity

**Recommendation: Desktop-only for V1.**

AFFiNE has a separate mobile bundle (`packages/frontend/apps/mobile`) with its own nav model (bottom tabs). Mirroring the tab strip there is feasible but adds ~30% to the engineering scope. Defer to V2 once desktop pattern is validated. The mobile bottom-tab pattern already accomplishes roughly the same "mode-switching" goal.

### 3. Workspace selector placement

**Recommendation: Move workspace selector ABOVE the tab strip.**

Notion's layout reads as "I'm in `[workspace]`, and these tabs navigate within it." That hierarchy is clearer than today's inline workspace + user avatar mash. Cost: one component shuffle in `root-app-sidebar/index.tsx`. Worth it for the readability win.

### 4. Agents section

**Recommendation: Move under the Chat tab.**

Agents run AI tasks. Their natural home is alongside AI conversations. In the Chat tab body:

```
💬 Chat
  ├─ + New chat
  ├─ Active (3)
  │  ├─ Q2 strategy review (Sonnet 4.5)
  │  └─ Auto-tag for /reports
  ├─ Agents (Beta)
  │  ├─ + New agent
  │  └─ Inbox triage agent
  └─ History (last 30 days)
```

Surfaces agents more prominently than the current "Agents Beta" buried section.

### 5. Graph + Analytics

**Recommendation: Demote from sidebar entirely. Access via Cmd+K + a "Views" dropdown in the Home tab toolbar.**

These are power-user / occasional features. Permanent sidebar real estate isn't justified by usage frequency. Replacement access:

- `Cmd+K` → "Open Graph" / "Open Analytics" (already searchable in the command palette)
- Home tab toolbar gets a small "Views ▾" button: `[Docs · Tree · Graph · Analytics · Timeline]` — visual switcher between the workspace's projections

This is also more honest about the Graph's actual cost — it's a separate heavy view, not a peer of `All docs`.

---

## Phased implementation

Each phase is shippable independently. Stop after any phase if it feels good enough.

### Phase 1 — Demote utility (R1, ~1 day, low risk)

Move things, no architecture change.

- Move `Trash`, `Import`, `Template`, `Invite members`, `Download App` to a bottom utility footer
- Move `Settings`, `Help` next to user info
- Keep existing nav items in place — just visually clustered

**Files:**
- `packages/frontend/core/src/components/root-app-sidebar/index.tsx` (reorder)
- `packages/frontend/core/src/components/root-app-sidebar/index.css.ts` (utility footer styles)

**Win:** ~6 items hidden from main nav. ~30% visual clutter reduction. Zero behavior change.

### Phase 2 — Tab strip + Home view (R1, ~2–3 days, medium risk)

Add the icon tab strip; wrap existing nav as the Home view.

- New `SidebarTabStrip` (5 tabs)
- Active tab → `globalState` (per-workspace, persists)
- `<SidebarHomeView>` wraps current sidebar body
- Other tabs stub: "Coming soon"
- Feature-flag: `flags.sidebar_tabs_v2`

**Files:**
- New: `root-app-sidebar/tab-strip.tsx`, `tab-strip.css.ts`
- New: `root-app-sidebar/views/{home,chat,meetings,inbox,search}-view.tsx`
- Modified: `root-app-sidebar/index.tsx`

**Win:** Visual model matches Notion. Stubs are honest — "Coming soon" sets expectations.

### Phase 3 — Wire real content per tab (R1, ~3–5 days, medium risk)

Fill in tabs. Each tab is independently shippable.

| Tab | Wiring |
|---|---|
| **Chat** | Move chat history + agent list from Intelligence header into `SidebarChatView`. Chat panel stays in main content area when active. |
| **Meetings** | Wire to `calendar/service.ts`. Show Today / Upcoming / Past 30d. Click → event detail in main area. |
| **Inbox** | Wire to `NotificationService`. Unread first, then read. Mark-as-read on click. |
| **Search** | Existing `QuickSearchInput` becomes the always-visible field. Show "Recent searches" + "Suggested" below. |

URL state for deep-linking: `?nav=chat|meetings|inbox|search`.

### Phase 4 — Polish (R2, ~1–2 days)

- Keyboard: `Cmd+1..5` jumps between tabs
- Tooltip preview on tab hover
- Empty states with CTAs ("No meetings today — connect your calendar →")
- First-time-user ping on the tab strip

---

## Open items + risk

### Blast radius

Every authenticated user sees the sidebar on every page load. A regression is high-visibility.

### Mitigation

1. Feature-flag the tab strip (`flags.sidebar_tabs_v2`) for Phases 2–3
2. Roll out: internal team → 10% of users → 100%
3. Each phase is a separate PR — revert removes the new path entirely

### Test plan per phase

- Visual regression via `/browse` on `/workspace`, `/workspace/all`, `/workspace/graph` for each phase
- Manual click-through on each tab
- a11y: tab strip keyboard nav, screen-reader labels on each tab icon

### Things to verify before Phase 2

- Does AFFiNE's `globalState` persist correctly across workspace switches? (Test: switch workspace, tab should reset OR maintain — pick one and stick to it.)
- Does the existing chat side panel state coexist with a `SidebarChatView`? Or do we need to migrate that state?
- The `WorkbenchService` location subscription — does it need to know about active sidebar tab, or is sidebar state independent?

---

## What I'd build first

**Phase 1 — utility footer.**

Smallest possible win. Visibly de-clutters the sidebar. We can ship it, watch the qualitative signal, and decide whether to invest in Phase 2.

If green-lit, the Phase 1 PR is ~1 file (`root-app-sidebar/index.tsx`) + the CSS. Should ship end-of-day.

---

## Decisions still needed

| # | Decision | Default | Status |
|---|---|---|---|
| 1 | Tab order | `Home / Chat / Meetings / Inbox / Search` | proposed |
| 2 | Mobile parity | Desktop-only V1, mobile V2 | proposed |
| 3 | Workspace selector placement | Above tab strip | proposed |
| 4 | Agents section home | Under Chat tab | proposed |
| 5 | Graph / Analytics | Cmd+K + Views dropdown (not sidebar) | proposed |
| 6 | Feature flag name | `sidebar_tabs_v2` | proposed |
| 7 | When to start Phase 1 | Awaiting your green-light | open |

---

*Last updated: 2026-05-19. Update by PR.*
