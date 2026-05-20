# Manut Launch Comms Template

> **Status:** drafts. Replace bracketed placeholders before sending.
> **Tone:** technical, concise, no buzzwords. Manut is the AI workspace
> intelligent Gen Z grads actually want to use — write like that
> reader is reading.
> **Lead-in:** every channel below opens with the AI workspace pitch
> (per decision #0 in IMPLEMENTATION_PLAN). Hero features stay
> consistent across channels: ⌘J floating chat, per-doc-type quick
> actions, memory that learns.

---

## 1. Twitter/X thread (5-10 tweets)

> Use it for the public launch ping. Reply-chain — each tweet is
> ≤280 chars, posted as one thread for thread-engagement signal.

**Tweet 1 — hook**

> Today we're launching Manut — the AI workspace for people who
> already know how to think.
>
> Docs that talk back. Memory that learns. ⌘J for the chat that
> reads your work.
>
> Free, no seat caps. Bring your whole team.
>
> Try it: manut.xyz

**Tweet 2 — what it is**

> Manut is a docs-and-chat workspace. The chat sees what you're
> reading, the docs see what you said in the chat.
>
> No "open the AI sidebar." No copy-paste between tabs.
>
> One ⌘J. The AI is already inside.

**Tweet 3 — quick actions**

> The AI doesn't ask you what to do. It looks at the doc and
> offers the next move.
>
> On a page: summarize, outline, polish.
> In a database: filter, autofill, draft.
> In a meeting note: surface decisions, list action items.
>
> Per doc type. No prompting required.

**Tweet 4 — memory**

> Manut remembers what you told it.
>
> "My team prefers blunt feedback." "Our brand is Manut, not
> 'mant.'" "I write in Korean half the time."
>
> Every chat picks up where the last one left off. Across docs,
> across days.

**Tweet 5 — pricing**

> Free: unlimited members, 2 GB storage, $5/mo of AI.
> Pro: $20/user/mo for 100 GB and $50/mo of AI.
>
> No seat-counting. Bring your whole team in on the free tier
> and see if it fits.

**Tweet 6 — what it's built on**

> Built on the AFFiNE editor (open-source, real BlockSuite),
> plugged into Vertex AI for Gemini + Claude + Llama under the
> hood.
>
> We picked Vertex because the bill is predictable and the
> models stay current.

**Tweet 7 — why now**

> Notion is for big companies. Mem is sleek but small. Obsidian
> is a brain you carry alone.
>
> Manut is for the small team that ships fast. The AI doesn't
> replace the work — it watches it and keeps up.

**Tweet 8 — try it**

> manut.xyz
>
> Welcome page, 30 seconds, one workspace.
>
> Hit ⌘J on any doc and start.

**Tweet 9 (optional) — replies**

> Building in public. Reply with what you'd want next and we'll
> probably ship it.
>
> Roadmap, docs, contact: manut.xyz

---

## 2. Hacker News — Show HN

> **Title (≤80 chars):**
>
> Show HN: Manut – an AI workspace built on AFFiNE + Vertex AI

> **Body (≤2000 chars). HN doesn't accept markdown — plain prose
> with line breaks. No emoji. No marketing voice.**

```
Hi HN — I'm [your name], and we just launched Manut at manut.xyz.

It's an AI workspace that started as a fork of AFFiNE (the open-source
notion-alike with the BlockSuite editor). What we kept: real editor,
real docs, real database views. What we changed: hardcoded the cloud
deployment, ripped out the self-host paths, added an always-present
AI chat that actually knows what you're reading.

Three things we did that I think are worth talking about:

1) ⌘J floating chat that picks up the current doc as context. No
"open the AI sidebar" dance, no copy-paste between tabs. The chat
reads the doc, you ask, it answers. Closes with Esc.

2) Quick actions per doc type. On a page: summarize / outline /
polish. In a database: filter / autofill / draft. In meeting
notes: surface decisions / list action items. The AI doesn't
ask you what to do; it looks at what you're on and offers the
next move.

3) Memory that learns across sessions. Tell Manut "my team
prefers blunt feedback" once and it carries that forward. The
implementation is pgvector + Vertex embeddings, with the
memory prompt prepended to every chat turn as
<memories>...<memory kind=... scope=...>...</memory></memories>.
No magic — just persistent context retrieval.

Free tier: unlimited members, 2 GB storage, $5/mo of AI spend.
Pro: $20/user/month for 100 GB and $50/mo. The free tier has no
seat caps so you can bring your team in and see if it fits.

We run on Vertex AI (Gemini 2.5 Flash + Pro, Claude Sonnet 4.5,
Llama 3.1/4) routed via an auto-picker that looks at the request
shape (code-heavy, long context, image input). Bill is predictable;
models stay current.

What we're not doing: not pitching this as Notion / Mem / Obsidian
replacement. It's for small teams that already know how to think
and want the AI to keep up rather than steer.

Source: forked from github.com/toeverything/AFFiNE; our changes
live in feat/manut-wave2-cloud (199 files, 5 migrations).

Happy to answer anything. Especially curious where this falls
over for you.
```

---

## 3. Email to existing users

> **Audience:** the small set of existing AFFiNE-fork users (if any),
>
> - anyone who signed up to the early-access list.
>   **Tone:** plain, no marketing-speak. Subject line is load-bearing.

**Subject:** Manut is live

**Body:**

```
Hi [name],

Manut is live at manut.xyz. We shipped today.

What changed since last time:
- ⌘J floating chat with doc context built in
- Memory that carries across sessions
- Free tier: 2 GB, $5/mo AI, unlimited team members
- Pro tier: $20/user for 100 GB and $50/mo AI

If you were on AFFiNE before, the editor is the same. The AI is
where the new work happened.

You can import your existing AFFiNE workspace — Settings →
Workspace → Import. The format is identical.

Let me know what breaks.

— [your name]
manut.xyz
```

---

## 4. Blog post outline

> **Target:** longer-form launch piece on the company blog or
> medium. ~1500 words.
> **Hook:** "We rebuilt AFFiNE into the AI workspace it always
> wanted to be."

### Sections

1. **The pitch (~150 words)**
   - Manut is the AI workspace for people who already know how to
     think.
   - Free, no seat caps, designed for small teams that ship.
   - manut.xyz.

2. **What we kept from AFFiNE (~200 words)**
   - The BlockSuite editor (the best open-source rich-text editor
     for technical work).
   - Database views, edgeless canvas, doc-linking.
   - Real, persistent, local-first storage backed by Y-CRDTs.
   - Why fork: AFFiNE is excellent infrastructure; we're a
     different product on top.

3. **What we changed (~300 words)**
   - Hardcoded the cloud deployment. No self-host paths. Saves
     ~30% of the codebase and keeps the surface area
     manageable for a small team.
   - Free tier with no seat caps. Decision #26 from
     IMPLEMENTATION_PLAN — bring your team in, see if it fits,
     pay only when storage or AI spend justifies it.
   - Quota structure that maps to real usage: 2 GB / $5 free,
     100 GB / $50 pro. The $5 AI cap is the actual
     pay-as-you-go ceiling — not a billing trick.

4. **The AI changes (~400 words)**
   - ⌘J floating chat. Closes with Esc. Auto-attaches the
     current doc as context. The chat reads what you're
     reading.
   - Per-doc-type quick actions. The AI doesn't ask "what
     would you like to do?" — it offers concrete next moves
     based on the doc type. Page: summarize / outline /
     polish. Database: filter / autofill. Meeting note:
     decisions / action items.
   - Memory MVP. pgvector + Vertex embeddings.
     `<memories>` block prepended to every chat turn. We tell
     it once, it remembers across docs and sessions.
   - Auto-routing across Gemini, Claude, Llama. Code-heavy →
     Claude Sonnet 4.5. Long context → Gemini 2.5 Pro. Short
     text → Gemini Flash. Bill is predictable; the user
     doesn't pick.

5. **What it's not (~150 words)**
   - Not a Notion replacement. Notion is for big companies
     with workflow-template needs. We're for small teams that
     already know how to think.
   - Not Mem. Mem is sleek but narrow; we're the workspace
     and the chat at the same time.
   - Not Obsidian. Obsidian is a brain you carry alone; Manut
     is for teams.

6. **What's next (~150 words)**
   - GitHub connector (E2.1 — in flight).
   - WebSocket transport for lower-latency chat (B13).
   - Code-run sandbox via Modal (E3.1).
   - Image-gen via Vertex Imagen (E3.2).
   - The full roadmap lives in
     [docs/IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

7. **Try it (~100 words)**
   - manut.xyz
   - 30-second welcome flow.
   - ⌘J anywhere in your workspace.
   - Reply to this post or `support@manut.xyz` with what
     breaks.

### CTA block (footer)

> Manut is open about the work. If you're a small team that wants
> the AI to keep up with you rather than steer you, give it a
> spin. Free tier doesn't expire.
>
> manut.xyz

---

## 5. Internal launch announcement (Slack / email)

> **Audience:** internal team.
> **Length:** short.

**Slack #general:**

```
Manut is live.

URL: manut.xyz
PR: #121 (25 commits, 199 files, 5 migrations)
Smoke: manut/*.spec.ts all green
On-call: [name] (primary), [name] (secondary)
Status page: status.manut.xyz

If anything looks weird, ping me. Runbook lives at
docs/MANUT_DEPLOY_RUNBOOK.md.

— [your name]
```

---

## Style notes

When editing the drafts above, keep these constraints:

- **Don't** use the words "revolutionary", "game-changing", "powerful",
  "seamless", "unleash", "supercharge", "AI-powered".
- **Don't** open with "I'm excited to announce" — start with the
  thing itself.
- **Don't** stack adjectives. One adjective per noun, or none.
- **Do** name the actual model / library / commit when relevant —
  HN readers can smell hand-waving from a thread away.
- **Do** include the rollback / known-limitation paragraph somewhere
  in long-form pieces (the blog post should mention the $5 AI cap
  is a real ceiling, not a teaser).
- **Do** keep the tone consistent across channels — the launch
  reader will see at least two of these and notice when one
  contradicts another.

---

## Schedule template

| Time (PT) | Channel                                                                                                      | Owner        |
| --------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| T-24h     | Final smoke run + rollback rehearsal                                                                         | on-call      |
| T-1h      | Status page → "Maintenance" while we cut the deploy                                                          | on-call      |
| T-30m     | Run the 11-section launch checklist                                                                          | launch owner |
| T-0       | Railway redeploy + smoke spec sweep                                                                          | on-call      |
| T+5m      | Tweet the launch thread                                                                                      | launch owner |
| T+10m     | Post Show HN                                                                                                 | launch owner |
| T+15m     | Send the existing-users email                                                                                | launch owner |
| T+1h      | Publish the blog post                                                                                        | launch owner |
| T+4h      | Mid-window funnel check (Mixpanel)                                                                           | launch owner |
| T+24h     | Debrief (see [MANUT_LAUNCH_CHECKLIST.md §post-launch](./MANUT_LAUNCH_CHECKLIST.md#post-launch-t24h-debrief)) | launch owner |
