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
| 🔍 **Search** | **Opens modal — not a sidebar body view.** Reuses Cmd+K. See "Search experience spec" below. | Search button + existing Cmd+K |

### Search experience spec (Notion-style modal)

User confirmed 2026-05-19 (with reference screenshot): Search should behave like Notion's Cmd+K modal — a focused overlay, not an inline sidebar view. Manut already has `CMDKQuickSearchService`; this spec is how we level it up to match.

```
                ┌─────────────────────────────────────────────────────────┐
                │  🔍  Search or ask a question in GoGoCash...    ▢  ▼   │
                ├─────────────────────────────────────────────────────────┤
                │  [Aa Title only]  [👤 Created by ▾]  [📂 In ▾]  [+ Filter]│
                ├──────────────────────────────────┬──────────────────────┤
                │  Today                           │                      │
                │  ▸ 📄 @Today 9:39 PM        ↗   │  @Today 9:39 PM      │
                │  ▸ 📄 @Today 9:39 PM             │  ──────────────      │
                │  ▸ 📊 Home views                 │  🎙️ Meeting @Today  │
                │                                  │                      │
                │  Past 30 days                    │  (preview body)      │
                │  ▸ 📄 @May 3, 2026 8:18 AM       │                      │
                │  ▸ 📋 Meeting Notes              │                      │
                │     — GoGoCash HQ                │                      │
                │  ▸ 📊 Projects — GoGoCash HQ     │                      │
                ├──────────────────────────────────┴──────────────────────┤
                │  ⌘↵ Open in new tab                                ⚙    │
                └─────────────────────────────────────────────────────────┘
```

**Required features (P0):**

1. **Input bar** with magnifying-glass icon + placeholder `Search or ask a question in <Workspace>...`
2. **Filter chips row** directly under input:
   - `Aa Title only` — restrict match to title field
   - `👤 Created by ▾` — dropdown of workspace members
   - `📂 In ▾` — restrict to folder/tag/collection
   - `+ Filter` — adds more filters from a menu (type, tags, date range)
3. **Grouped results by recency**: `Today`, `Yesterday`, `Past 7 days`, `Past 30 days`, `Older`
4. **Result row anatomy**:
   - Icon (page / database / kanban / meeting / etc.)
   - Title
   - Em-dash + parent context: `Meeting Notes — GoGoCash HQ`
   - Hover state shows "↗ Open in new tab" affordance
5. **Right-side preview pane** (split view):
   - Renders title + lightweight content preview of the focused result
   - Updates on arrow-key navigation through results
   - Toggle the preview pane open/closed (the ▢ icon top-right)
6. **Keyboard**:
   - `↑ ↓` navigate results
   - `↵` open in current tab
   - `⌘↵` open in new tab (footer hint visible)
   - `Esc` close modal

**Polish (P1):**

- AI-assisted search: when query starts with a verb or question mark, surface a "Ask Manut AI" row at the top of results that pipes to the chat panel
- Recent searches when input is empty
- Suggested filters based on workspace usage patterns

**What we already have:**

- `CMDKQuickSearchService` in `packages/frontend/core/src/modules/quicksearch/services/cmdk.ts` is the entry point
- It already does global doc search via the existing search index
- Missing: the filter chips, grouped-by-recency layout, preview pane

**Implementation order:**

This is its own slice — independent from the tab strip. Could ship before, during, or after Phases 2–3. Suggest landing it as part of Phase 3 alongside the Search tab wiring.

### Customize sections (Home tab)

User confirmed 2026-05-19 (with reference screenshot): the Home tab body should expose a "Home settings" popover that lets users hide/show individual sections. Matches Notion's pattern.

```
                        ┌─ Home settings ───────────────┐
                        │  ⇄  Customize sections        │
                        │  👁  Hide tab name             │
                        └───────────────────────────────┘

                        ┌─ Customize sections (edit) ──┐
                        │  Meetings              👁     │
                        │  Recents               👁     │
                        │  Favorites             👁     │
                        │  Agents                👁     │
                        │  Private               👁     │
                        │  Teamspaces            👁     │
                        │  Shared                👁     │
                        │  Notion apps           👁     │
                        │  Library               👁     │
                        │  My Tasks              👁     │
                        │  Marketplace           👁     │
                        │  Help                  👁     │
                        │  Trash                 👁     │
                        ├───────────────────────────────┤
                        │            Done               │
                        └───────────────────────────────┘
```

**Behavior:**
- Right-click (or hover-gear) on Home tab → "Home settings" popover
- "Customize sections" → enters edit mode: each section gets an eye-icon toggle
- Toggling eye dims the section; hidden sections collapse out of view immediately for preview
- "Done" commits and exits edit mode
- Per-user preference stored in `globalState` (per-workspace, persists across reloads)
- "Hide tab name" hides the label under the active tab icon (shrinks the tab strip vertically)

**Implementation:** new component `SidebarSectionVisibilityEditor` rendered as a popover. The Home view (Phase 2) already iterates over named sections — gating each on a visibility-prefs lookup is trivial. ~half day on top of Phase 2.

### Floating AI chat anchor (page-aware)

User confirmed 2026-05-19 (with reference screenshot): focus on AI accessibility. Every page gets a floating chat affordance in the bottom-right corner — clicking it opens a contextual AI chat panel anchored to the current page.

```
              Page content
                                                  ┌──────────────────────┐
                                                  │ Chat about this page │
                                                  │                ⌘J    │
                                                  └─ tooltip ────────────┘
                                                                       ⊕
                                                                       │
                                                                  ◯  click

              After click →

              Page content                        ┌────────── New AI chat ──┐
                                                  │  ★ (workspace logo)     │
                                                  │                         │
                                                  │  How can I help today?  │
                                                  │  ─ Summarize this page  │
                                                  │  ─ Translate this page  │
                                                  │  ─ Analyze for insights │
                                                  │  ─ Create a task tracker│
                                                  │                         │
                                                  │  📄 @Today 9:41 PM      │
                                                  │  ┌─────────────────────┐│
                                                  │  │ Do anything with AI ││
                                                  │  └─────────────────────┘│
                                                  │             Auto ▾  ↑   │
                                                  └─────────────────────────┘
```

**Behavior:**
- Floating button bottom-right of every workspace page (docs, databases, whiteboards, settings)
- `⌘J` (kbd) opens/closes — matches Notion's shortcut
- Click → slides panel in from right (or floating overlay on mobile)
- Panel is **page-aware**: auto-injects current doc id into the chat context so the AI knows what the user is looking at
- Quick actions adapt to page type:
  - Doc → Summarize, Translate, Outline, Continue writing
  - Database → Analyze, Suggest filters, Generate column
  - Meeting → Extract action items, Draft follow-up email
- Free-form input "Do anything with AI..." for open queries
- Model picker (`Auto` default; expands to the full 15-model list per `CHAT_PROMPT.optionalModels`)
- Page context badge above input shows which doc the chat is anchored to (chip is removable to make the chat non-contextual)
- Conversation persists when navigating to other pages — but the page-context chip swaps to match the current page. User can pin a chat to a specific page if they want it stuck.

**Why this matters strategically:**
The hero already markets AI as the killer feature ("Your team's workspace that builds with you"). Today users have to navigate AWAY from their work to a dedicated AI page to use it. Notion's floating-chat pattern means AI is always one keystroke away from whatever you're doing — much higher engagement and stickiness for the AI surface.

**Implementation:**
- Component `FloatingAiChatAnchor` rendered in the workbench layout (above all page content)
- Reuses existing `AiChatPanel` component (currently used in the Intelligence route)
- New `useCurrentDocContext` hook surfaces `{ docId, docType, title }` to the chat
- New URL state for an open chat: `?ai-chat=open` so deep links preserve state
- Quick-action templates live in a new `lib/ai-quick-actions.ts` mapped by `docType`

**Reusing what's there:**
- `CHAT_PROMPT.optionalModels` (the 15-model list) → model picker
- `auto-router.ts` → "Auto" mode
- `MailSender` is irrelevant here — chat doesn't email
- Existing chat history + persistence in `aiChatHistories` table

**Effort:** ~3-4 days as a standalone slice. Could ship independently of the tab-strip work.

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
| **Search** | Clicking the 🔍 tab opens the **Cmd+K modal** described in "Search experience spec" above — split view, filter chips, grouped results, preview pane. Not a sidebar body view. Implements the existing `CMDKQuickSearchService` with the new layout. |

URL state for deep-linking: `?nav=chat|meetings|inbox|search`.

### Phase 4 — Polish (R2, ~1–2 days)

- Keyboard: `Cmd+1..5` jumps between tabs
- Tooltip preview on tab hover
- Empty states with CTAs ("No meetings today — connect your calendar →")
- First-time-user ping on the tab strip

### Phase A (parallel) — Floating AI chat anchor (R1, ~3–4 days, medium risk)

**Independent of the tab-strip phases. Can ship before, during, or after.**

- New `FloatingAiChatAnchor` component in workbench layout
- `⌘J` keyboard binding (global)
- Page-context auto-injection via `useCurrentDocContext`
- Quick-action templates per `docType`
- URL state `?ai-chat=open` for deep-linking
- Reuses existing `AiChatPanel` + `CHAT_PROMPT.optionalModels` + `auto-router`

This is the **highest user-facing AI win** in this whole redesign. Suggest it ships in parallel to Phase 1 since the two don't conflict.

### Phase B (parallel) — Customize sections + section visibility prefs (R2, ~0.5 day)

**Depends on Phase 2 (tab strip + Home view). Bundle into Phase 2 PR.**

- `SidebarSectionVisibilityEditor` popover
- "Home settings" entry: customize sections + hide tab name
- Per-workspace prefs in `globalState`
- Eye-toggle UI matching Notion's reference

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

Two slices in parallel — they don't conflict:

**Phase 1 — utility footer** (~1 day, low risk). Smallest possible visible win. Ships end-of-day. ~1 file (`root-app-sidebar/index.tsx`) + CSS.

**Phase A — floating AI chat anchor** (~3-4 days, medium risk, feature-flagged). The highest-leverage AI win in this whole plan. Reuses the existing `AiChatPanel`; mostly wiring + a new floating button + ⌘J handler + page-context hook.

Combined effect after both ship:
- Sidebar visibly less cluttered (Phase 1)
- AI accessible from every page with one keystroke (Phase A)
- Foundation ready for the tab strip (Phases 2–3) when we want to commit to the deeper restructure

---

## Decisions still needed

| # | Decision | Default | Status |
|---|---|---|---|
| 1 | Tab order | `Home / Chat / Meetings / Inbox / Search` | proposed |
| 2 | Mobile parity | Desktop-only V1, mobile V2 | proposed |
| 3 | Workspace selector placement | Above tab strip | proposed |
| 4 | Agents section home | Under Chat tab | proposed |
| 5 | Graph / Analytics | Cmd+K + Views dropdown (not sidebar) | proposed |
| 6 | Search behavior | Opens Cmd+K modal (not sidebar view), Notion-style layout | **confirmed by user 2026-05-19** |
| 7 | Customize sections (eye-toggle popover) | Bundled with Phase 2; per-workspace prefs in `globalState` | **confirmed by user 2026-05-19** |
| 8 | Floating AI chat anchor (⌘J, page-aware) | Phase A — ships in parallel to Phase 1, reuses existing AiChatPanel | **confirmed by user 2026-05-19** |
| 9 | Feature flag name | `sidebar_tabs_v2` (tab strip) + `floating_ai_chat` (chat anchor) | proposed |
| 10 | When to start Phase 1 + Phase A | Awaiting your green-light | open |

---

*Last updated: 2026-05-19. Update by PR.*
