# Analytics Platform — Approval Submission Checklists

**Status:** Draft v1 — execution checklist for GoGoCash team
**Companion to:** [analytics-platform.md](./analytics-platform.md) (PRD)
**Last updated:** 2026-05-04
**Owner:** GoGoCash team

This document is the operational follow-up to the Analytics Platform PRD §8
(per-platform notes) and §10 risks #1–3. Every item below is a thing a
person can do; every scope has a justification a Meta reviewer would accept;
every CLI command has been verified against current vendor docs (May 2026).

> Note on confidence: where official documentation is ambiguous or
> conflicting, sections are flagged **VERIFY** and a recommended owner is
> named. Treat those as known unknowns — do not invent answers.

---

## 1. Meta App Review (Facebook + Instagram + Threads)

GoGoCash will register **one Meta app** that requests scopes for all three
surfaces (per PRD §4 / connections module: `meta.oauth.ts` is shared).
This is the lowest-friction shape — Meta encourages a single app per
business — but it means every scope below is reviewed against the same
app, against the same screencast bundle.

### 1.1 App setup

- [ ] At [developers.facebook.com/apps](https://developers.facebook.com/apps),
      click **Create App**. Choose **Business** type. App name:
      `GoGoCash Analytics` (must not contain "FB", "Facebook", "Insta",
      or "Threads" — Meta auto-rejects branding violations).
- [ ] Switch to **Live mode** only AFTER review approval. Build & screencast
      in **Development mode** (Standard Access scopes only).
- [ ] Set **Privacy Policy URL** to `https://manut.gogocash.co/legal/privacy`.
      Page must explicitly cover ingestion of FB/IG/Threads data —
      generic privacy boilerplate fails review.
- [ ] Set **Terms of Service URL**: `https://manut.gogocash.co/legal/terms`.
- [ ] Set **Data Deletion**: pick ONE of (a) Data Deletion Callback URL —
      `https://manut.gogocash.co/api/integrations/meta/data-deletion`,
      HMAC-SHA256 signed POST handler, returns `{url, confirmation_code}`,
      or (b) Data Deletion Instructions URL —
      `https://manut.gogocash.co/legal/data-deletion-instructions`.
      Recommendation: ship **(b) instructions** for v1, upgrade to (a)
      callback in Phase 5 (PRD §9). Source:
      https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
- [ ] App Icon: 1024×1024 PNG, no Meta brand assets, no "Login with FB"
      buttons, no minor faces.
- [ ] Category: **Business and Pages**.
- [ ] Add app domain `manut.gogocash.co` and OAuth redirect URI
      `https://manut.gogocash.co/api/integrations/meta/callback`.

### 1.2 Business Verification

Meta requires Business Verification for any app requesting Advanced Access
to scopes that read other people's data (which we do — `read_insights`,
`pages_read_engagement`, `instagram_manage_insights`). Source:
https://www.facebook.com/business/help/159334372093366

For a **Thai-registered** company (GoGoCash):

- [ ] Open Meta Business Suite → **Security Center** → **Business verification**
      → **Start Verification**.
- [ ] Confirm **legal business name** matches `หนังสือรับรองบริษัท`
      (DBD Company Affidavit) exactly — including Thai/English transliteration,
      address, juristic-person ID. Mismatched spelling is the #1 rejection
      cause.
- [ ] Upload at least TWO of the following (all dated within the last 90 days
      where applicable):
  - DBD Company Affidavit (`หนังสือรับรองบริษัท`) — issued by
    Department of Business Development, Ministry of Commerce. Should be
    digital-stamped or notarized.
  - VAT certificate (`ภ.พ. 20`).
  - Recent utility bill (electricity/water) at the registered office, in
    the company's legal name.
  - Bank statement on bank letterhead showing legal name + registered
    address (last 90 days).
- [ ] Domain verification: add the Meta-provided TXT record to
      `manut.gogocash.co` DNS. Verify in Business Suite → **Brand Safety
      → Domains**.
- [ ] Choose verification contact method: **email at @gogocash.co**
      (Meta strongly prefers domain-matched email over phone).
- [ ] Expected timeline: **2–10 business days** if documents match
      perfectly; longer if any field is rejected.

> **VERIFY**: Thailand-specific accepted document list is not separately
> published by Meta as of May 2026 — Meta's docs say "country-specific
> requirements may differ" but provide no Thailand page. The list above
> is what other Thai businesses report as accepted (DBD certificate +
> VAT cert + utility bill is the standard combination). Owner: assign
> someone to confirm with Meta support if first submission is rejected
> on document-type grounds.

### 1.3 Permissions — what we need, why, and review level

Below is the minimum scope set to deliver PRD §8 features. Each row
includes the **review tier** Meta assigns (Standard Access works for
your own Pages/IG accounts; Advanced Access is needed to read data on
behalf of users outside your business). All Advanced Access scopes
require: app screencast + at least 1 successful API call within
30 days of submission + Business Verification.

| Scope                       | Platform  | Why we need it (reviewer-facing)                                                                                                                                               | Tier     | Proof Meta requires                                                                                                                                           |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages_show_list`           | Facebook  | Render the workspace owner's list of Pages so they can pick which Page to connect for analytics.                                                                               | Advanced | Screencast: open Connections → click Connect Facebook → OAuth dialog → see Page picker populated → select Page → see status badge "Connected"                 |
| `pages_read_engagement`     | Facebook  | Read posts/comments/reactions on the connected Page so the AI Strategist can summarize engagement trends. No write access used or requested.                                   | Advanced | Screencast: after Page connect, navigate to Analytics → Facebook deep-dive → see post-level engagement metrics (likes, comments, shares) sourced from the API |
| `pages_manage_metadata`     | Facebook  | Subscribe the Page to our webhook (`feed`, `mention`) so engagement events arrive in real-time without polling. We do NOT modify Page metadata.                                | Advanced | Screencast: connect Page → POST a test comment from a separate test account → see event surface in Analytics within 60 s                                      |
| `read_insights`             | Facebook  | Read Page-level insight metrics (`page_impressions`, `page_fan_adds`, etc.) used in the Overview dashboard and Weekly Strategy AI prompt.                                      | Advanced | Screencast: open FB deep-dive → show daily impressions chart + the underlying `/insights` call in DevTools network tab                                        |
| `instagram_basic`           | Instagram | Identify the IG Business/Creator account linked to the connected FB Page. Required for any IG Graph API call.                                                                  | Advanced | Screencast: pick Page with IG attached → see IG handle resolved + media count                                                                                 |
| `instagram_manage_insights` | Instagram | Read IG follower count, reach, impressions, and per-media insights for the dashboard + AI prompts. Same justification pattern as `read_insights` for FB.                       | Advanced | Screencast: open IG deep-dive → show reach/impressions chart with timestamps matching the IG API response                                                     |
| `threads_basic`             | Threads   | Identify the connected Threads account. Required for any Threads API call. Source: https://developers.facebook.com/docs/threads/get-started/get-access-tokens-and-permissions/ | Advanced | Screencast: connect Threads → see handle + recent post list                                                                                                   |
| `threads_manage_insights`   | Threads   | Read post-level + account-level Threads metrics. PRD specifies this as the Threads metric source.                                                                              | Advanced | Screencast: open Threads deep-dive → show post insight values (views, likes, replies) reconciling with Threads native UI                                      |

**Scopes we are NOT requesting** (anti-pattern check — least privilege):

- `pages_manage_posts`, `pages_manage_engagement` — we never publish or
  moderate. Including these would trigger a "principle of least privilege"
  rejection.
- `instagram_content_publish` — read-only ingestion (PRD §2).
- `threads_content_publish`, `threads_manage_replies` — read-only.
- `business_management` — workspace-level OAuth doesn't need to manage the
  business; the user picks one Page.

### 1.4 Submission artifacts checklist

- [ ] **Screencast bundle** — one `.mp4` per scope, ≤ 4 min each, 1080p.
      Each video must show:
  - Cold-start: log out, open `https://manut.gogocash.co`, sign in fresh
  - Navigate Settings → Analytics → Connections
  - Click **Connect Facebook** → OAuth dialog → grant the specific scope
  - Show the data flow: where the scope is exercised in the product UI
  - Browser DevTools open with Network tab visible during the scope's API call
  - Disconnect flow: Settings → Connections → Disconnect → confirm
- [ ] **At least 1 successful API call per scope within 30 days of
      submission**. Required by Meta's Advanced Access policy. Source:
      multiple submission guides cite this as the most-missed requirement.
- [ ] **Test users**: minimum 1, maximum 5 (default 1). Each must have a
      Meta developer account (not just a regular Meta account). Source:
      https://developers.facebook.com/docs/development/build-and-test/app-roles/.
      Recommendation: create **2** test users — one with a connected FB
      Page + linked IG Business + Threads, one with only IG (to demonstrate
      the "personal account blocked" UX). Reuse these accounts for the full
      review cycle (do not delete them mid-review).
- [ ] **Privacy Policy** must mention by name: "Facebook Pages",
      "Instagram", "Threads", what data we collect from each, retention
      period (PRD §12 q6 — default proposal: 90 days for `social_events`),
      data deletion process, contact email.
- [ ] **Use Case Statement** per scope (Meta requires a 100–500-word
      written justification per Advanced scope). Template:
      "GoGoCash Analytics is a workspace-collaboration product. The
      workspace owner connects their own Facebook Page so all members of
      the workspace can see aggregated engagement metrics in a single
      dashboard, with AI-generated weekly strategy summaries. The
      `<scope>` permission is used solely to <specific use> for the
      Page that the workspace owner explicitly selected. We never write
      to the Page, never share data with third parties, and store
      tokens encrypted with Google Cloud KMS."

### 1.5 Timeline & rejection-pre-emption

- **Typical review duration:** 2–4 weeks per scope. With 8 scopes
  reviewed against a single app, plan for **3–6 calendar weeks** end to
  end (Meta runs scope reviews in parallel, but a single rejected scope
  doesn't fail the whole submission — others can still pass).
- **Common rejection reasons (and how we pre-empt each):**
  1. **Screencast doesn't show the scope in use** — we record DevTools
     Network panel during every scope's API call.
  2. **Privacy policy too generic** — written specifically to cover
     Meta data ingestion (not WordPress-template boilerplate).
  3. **Login is gated behind a paywall reviewers can't pass** — we
     will not put the Connections page behind any paid tier; reviewers
     access via a test workspace pre-loaded with an Owner role.
  4. **Asking for more scopes than the app demonstrably uses** —
     we restricted the request to the 8 scopes above; no `*_publish`,
     no `business_management`.
  5. **App in Development mode for production-style data** — we
     submit only after we have at least 1 real successful API call per
     scope from the live preview environment.

---

## 2. TikTok for Developers — Partner Approval

### 2.1 App tiers (what we get at each)

| Tier                    | Cost                                                                                          | What's available                                                                                                                                              | What's blocked                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Login Kit (default)** | Free, no review                                                                               | OAuth, `user.info.basic` (open_id, union_id, avatar, display_name). User signs in.                                                                            | Anything beyond identity.                                                                      |
| **Display API**         | Free, app review only                                                                         | `user.info.profile`, `user.info.stats` (follower count, video count, likes count), `video.list`, `video.publish`, `video.upload`. ~100 requests/day per user. | Per-video analytics, audience demographics, hashtag trends, comment-level data.                |
| **Content Posting API** | Free, app review only                                                                         | Programmatic upload + publish. Adds `video.publish`, `video.upload` scopes.                                                                                   | Same analytics gaps as Display API.                                                            |
| **Research API**        | Partner-status review (high bar — typically university researchers, news organizations, NGOs) | Public-video search, comment search, user search, full per-video insights. Source: https://developers.tiktok.com/products/research-api/                       | Restricted to "academic and market research". Commercial product use cases routinely rejected. |

**Mapping to PRD §8 ("TikTok"):**

| PRD requirement                                             | Tier needed                                            |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| Video posting events via webhook                            | Display API + Content Posting API + webhook config     |
| Public video metadata for the connected user                | Display API                                            |
| Per-video deep analytics (views, completion rate, audience) | Research API only — **likely unavailable to GoGoCash** |
| Hashtag trend detection                                     | Research API only                                      |

**Honest assessment:** GoGoCash will **not qualify for the Research API**
in v1. The PRD §2 already calls this out: "TikTok features that require
Research API access — fall back to Display API if partner status is
delayed." This section formalizes that fallback as the _expected_ path,
not the contingency.

### 2.2 Application steps (Display API + Content Posting + webhooks)

- [ ] Register at [developers.tiktok.com](https://developers.tiktok.com/),
      sign in with the GoGoCash company TikTok account (must be a
      Business account, not personal).
- [ ] Click **Manage apps** → **Connect an app**. Fill:
  - App name: `GoGoCash Analytics`
  - Description: 100–500 words. Lead with: "Workspace-collaboration
    SaaS that shows the connected user their own TikTok performance
    metrics inside a unified analytics dashboard alongside Facebook,
    Instagram, Threads, and LINE. Read-only ingestion."
  - Category: **Productivity**
  - Logo: 240×240 PNG
  - Terms URL, Privacy URL: same as Meta app
  - Redirect URI: `https://manut.gogocash.co/api/integrations/tiktok/callback`
  - **Webhook URL**: `https://manut.gogocash.co/api/integrations/tiktok/webhook`
    (must be HTTPS, must be reachable before submission so TikTok's
    verification ping succeeds). Source:
    https://developers.tiktok.com/doc/webhooks-overview/
- [ ] Add scopes (each is reviewed individually):
  - `user.info.basic` — auto-included with Login Kit. No review needed.
  - `user.info.profile` — public profile data. Standard review.
  - `user.info.stats` — counts only (followers, videos, likes,
    following). Standard review.
  - `video.list` — list videos the connected user uploaded.
  - `video.upload` — upload videos to draft (gated until publish).
  - `video.publish` — publish drafts. **Skip this scope unless the
    product genuinely posts** (PRD says read-only — likely skip).
- [ ] Subscribe to webhook events under **App settings → Webhooks**:
  - `video.upload.failed` (only event published by default per
    https://developers.tiktok.com/doc/webhooks-events/)
  - As of May 2026 the events catalog is thin; no `video.publish`
    success webhook exists for non-partner apps. Plan: poll
    `/v2/video/list/` every 15 min as the primary signal source.
- [ ] **Use case statement** (separate from app description, ≤ 1000 chars):
  > "GoGoCash Analytics is a workspace product where the workspace
  > owner connects their own TikTok creator account to view their
  > video performance alongside other social platforms. We use
  > `video.list` to enumerate the connected user's videos and
  > `user.info.stats` to display follower/like counts on a unified
  > dashboard. We do not access any other user's data, do not display
  > content publicly, and do not redistribute TikTok data. Tokens
  > are encrypted at rest with GCP KMS and refreshed daily."
- [ ] Submit for review. Expected: **1–4 weeks** (TikTok's stated
      "up to 4 weeks" applies to all reviews, not just Research API).

### 2.3 Fallback if partner / Research API is denied

This is the expected path. Build to it.

**Available with Display API only** (Phase 4 of PRD §9):

| Endpoint                       | Field                                                                                                   | Use in our UI          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| `/v2/user/info/`               | `display_name`, `avatar_url`, `bio_description`                                                         | Connection status card |
| `/v2/user/info/`               | `follower_count`, `following_count`, `likes_count`, `video_count`                                       | Overview metrics       |
| `/v2/video/list/`              | `id`, `create_time`, `cover_image_url`, `share_url`, `video_description`, `duration`, `height`, `width` | Recent videos card     |
| `/v2/video/list/` (each video) | `like_count`, `comment_count`, `share_count`, `view_count`                                              | Per-video stats        |
| Webhook `video.upload.failed`  | upload error event                                                                                      | Error toast in UI      |

**Gaps that show as "Coming soon — pending API access" in UI:**

- Audience demographics (age/gender/country breakdown)
- Hashtag-level analytics
- Reach vs impressions split
- Watch-time / completion-rate distribution
- Comment-text retrieval (only counts)

The PRD already acknowledges this is acceptable for v1.

---

## 3. LINE Developers — Voom & Messaging Channel

### 3.1 LINE channel setup

- [ ] At [developers.line.biz](https://developers.line.biz/), sign in
      with a LINE account that is also an **admin** of the GoGoCash
      LINE Official Account (LINE OA).
- [ ] Create or pick a **provider**. Recommendation: one provider named
      `GoGoCash` (providers are top-level grouping; LINE charges per
      channel, not per provider).
- [ ] Create a **Messaging API channel**. Fields:
  - Channel name: `GoGoCash Analytics`
  - Channel description: same as Meta/TikTok
  - Category: **Business**
  - Subcategory: pick the closest fit (e.g., `Productivity`)
  - Icon: 512×512 PNG
  - Privacy Policy URL, Terms URL: same as the Meta app
  - Region: **Thailand** (this affects LINE Insight API availability)
- [ ] Create a separate **LINE Login channel** (required if we want
      identity-only sign-in flows in addition to webhook ingestion).
      For v1 PRD scope (workspace-owner OAuth that captures a token
      for ingestion), the Messaging API channel alone is sufficient.
      **Decision: ship Messaging API channel only in v1.** Defer
      LINE Login channel until per-user OAuth is in scope (PRD §2 OOS).
- [ ] LINE Official Account verification: in the LINE OA Manager, if
      the account is currently **Unverified (grey)**, request
      **Verified (blue)** badge — required for Messaging API at
      production volume and required for any Voom-related insights API
      access. Verification asks for the same kind of business documents
      as Meta (DBD certificate + utility bill).

### 3.2 LINE Voom — what we can actually get **VERIFY**

This is the biggest open question in the entire approval flow.
Documentation is contradictory:

- LINE VOOM Studio (`https://voom-studio.line.biz/`) is **live as of
  May 2026** and shows insights to creators in the web UI.
- The Messaging API has **no documented public Voom-insights endpoint**.
  The Insight API (`/v2/bot/insight/...`) covers message-event
  aggregation, deliveries, follower count — not Voom post performance.
- One source (ke2b.com) claimed "LINE VOOM ended in 2023". This is
  **incorrect** — VOOM Studio is operational. The likely confusion is
  with LINE Notify (which is ending in 2025).

**What this means for v1 — honest summary:**

| Metric                              | Available via API?                                     | Source                                                          |
| ----------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| Total followers (LINE OA)           | ✅ Yes — `/v2/bot/insight/followers`                   | Messaging API                                                   |
| Number of message deliveries        | ✅ Yes — `/v2/bot/insight/message/delivery`            | Messaging API                                                   |
| Per-event aggregation (clicks etc.) | ✅ Yes — `/v2/bot/insight/message/event/aggregation`   | Messaging API                                                   |
| Voom post views, likes, comments    | ❓ **Unknown — no public API endpoint as of May 2026** | VOOM Studio web UI shows it; no documented programmatic surface |
| Voom audience demographics          | ❌ Not via Messaging API. Only in VOOM Studio UI.      | —                                                               |

- [ ] **ACTION (recommended owner: GoGoCash BD lead)**: contact LINE
      Thailand BD/partnership team (`partner@linecorp.com.th` or via
      the LINE for Business Thailand portal at `https://lineforbusiness.com/th-en/`)
      and ask explicitly:
  1. "Is there a programmatic API for LINE VOOM post-level insights
     (views, likes, comments) for a verified Official Account in 2026?"
  2. "If yes, what tier of LINE OA is required (Verified vs Premium)?"
  3. "If no, are there any partner / private-beta channels available?"
- [ ] Until that confirmation lands, **PRD §10 risk #3 stands**: assume
      Voom-specific metrics are **not** available via API. The v1
      LINE deep-dive view shows Messaging API metrics + a "View VOOM
      analytics in LINE Studio →" external link to the OA Manager.
- [ ] If LINE Thailand confirms a partner channel exists, file a
      separate partner-program application; budget 2–6 weeks for
      onboarding.

### 3.3 Webhook setup

- [ ] In the Messaging API channel, set **Webhook URL** to
      `https://manut.gogocash.co/api/integrations/line/webhook`.
- [ ] Toggle **Use webhook** to ON.
- [ ] Toggle **Auto-reply messages** OFF (we're not a chatbot).
- [ ] Toggle **Greeting messages** OFF.
- [ ] Copy the **Channel secret** and **Channel access token** into
      the AFFiNE config (`/srv/affine/data/affine-config/config.json`
      under `integrations.line.{channelSecret, channelAccessToken}`).
      Encrypt the channel secret via the same KMS key as OAuth tokens.
- [ ] Verify webhook signature handling: LINE signs each request with
      `X-Line-Signature` = base64(HMAC-SHA256(channelSecret, body)).
      Source: https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/
      The PRD §6 already mandates this — controllers MUST reject
      unsigned/bad-signed requests with 401.
- [ ] Subscribe events to the webhook URL via **Webhook events** in
      the LINE Developers console. We need:
  - `message` — new message to the OA
  - `follow` — user added the OA
  - `unfollow` — user blocked/removed the OA
  - `postback` — rich-menu / quick-reply interactions
  - **VERIFY**: Voom post events (post-published, post-commented) are
    **not in the Messaging API webhook event catalog** as of May 2026. Confirm with LINE Thailand (item 3.2 above).

### 3.4 Required scopes / permissions

LINE Messaging API does not use OAuth scopes the way Meta/TikTok do —
the channel access token is a **long-lived issued token** (or
short-lived + refresh) that grants every Messaging API capability the
channel was provisioned for. There is no per-scope review.

- [ ] Grant the channel access token "messaging" capability (default).
- [ ] If we later add LINE Login (deferred), then we will need to
      configure scopes (`profile`, `openid`, `email`).

---

## 4. GCP — KMS Keyring & IAM (no external approval, but config required)

The GoGoCash AFFiNE deployment runs on GCP project `affine-495114`
(per CLAUDE.md §5d). Tokens are stored encrypted by KMS, decrypted only
at the analytics module's request, with audit logging.

### 4.1 Verify or create the keyring

- [ ] Confirm the keyring exists. If the command below errors with
      `NOT_FOUND`, create it.

```bash
# Check if the keyring already exists
gcloud kms keyrings describe gogocash-keyring \
  --location=global \
  --project=affine-495114

# If missing, create it (one-time, R1 — ask before running)
gcloud kms keyrings create gogocash-keyring \
  --location=global \
  --project=affine-495114
```

> **Location choice**: PRD §6 says "global" (matches Vertex
> `us-central1` proximity is irrelevant for KMS — global is the right
> default for cross-region availability). Source:
> https://cloud.google.com/kms/docs/locations

### 4.2 Create the CryptoKey for analytics tokens

- [ ] Create a symmetric encrypt/decrypt key:

```bash
gcloud kms keys create analytics-tokens \
  --location=global \
  --keyring=gogocash-keyring \
  --purpose=encryption \
  --rotation-period=90d \
  --next-rotation-time=$(date -u -v+90d +%Y-%m-%dT%H:%M:%SZ) \
  --project=affine-495114
```

- [ ] Verify creation:

```bash
gcloud kms keys describe analytics-tokens \
  --location=global \
  --keyring=gogocash-keyring \
  --project=affine-495114
```

### 4.3 IAM binding — least privilege for the AFFiNE server SA

The AFFiNE server runs on the GCE VM `affine-vm` and authenticates
using a service account. PRD §6 requires that ONLY this SA has
encrypt/decrypt rights on `analytics-tokens` — backend dev sessions
must not.

- [ ] Identify the SA email used by the production server. From
      CLAUDE.md §5d, Vertex auth uses `getGoogleAuth` which by default
      reads the GCE metadata-server SA. Confirm via:

```bash
# From the VM
gcloud compute ssh affine-vm --project=affine-495114 \
  --zone=asia-southeast1-a \
  --command='curl -s -H "Metadata-Flavor: Google" \
    http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email'
```

The SA is expected to be something like
`<project-number>-compute@developer.gserviceaccount.com` unless a
custom SA was bound.

- [ ] Grant `roles/cloudkms.cryptoKeyEncrypterDecrypter` on the
      **specific key** (not the keyring, not the project):

```bash
gcloud kms keys add-iam-policy-binding analytics-tokens \
  --location=global \
  --keyring=gogocash-keyring \
  --member="serviceAccount:<SA_EMAIL_FROM_PREVIOUS_STEP>" \
  --role=roles/cloudkms.cryptoKeyEncrypterDecrypter \
  --project=affine-495114
```

Source: https://cloud.google.com/kms/docs/iam

- [ ] Confirm no other principals have encrypt/decrypt rights:

```bash
gcloud kms keys get-iam-policy analytics-tokens \
  --location=global \
  --keyring=gogocash-keyring \
  --project=affine-495114
```

### 4.4 Cloud Audit Logs — enable Data Access logging

By default GCP logs admin actions on KMS but **not** every
encrypt/decrypt call. PRD §6 mandates an audit log of every token
decryption — enable Data Access logging on KMS for the project.

- [ ] In the Cloud Console: **IAM → Audit Logs** → filter for
      `Cloud Key Management Service (KMS) API` → tick `Data Read`
      and `Data Write` → save. Or via gcloud:

```bash
# Export current policy
gcloud projects get-iam-policy affine-495114 \
  --format=json > /tmp/iam-policy.json

# Add the auditConfig block via your editor / jq, then re-apply:
# auditConfigs:
#   - service: cloudkms.googleapis.com
#     auditLogConfigs:
#       - logType: DATA_READ
#       - logType: DATA_WRITE

gcloud projects set-iam-policy affine-495114 /tmp/iam-policy.json
```

Note: KMS Data Access logs incur a small per-request cost
(~$0.50/M operations as of May 2026). At PRD-projected token
decryption volume (every connected platform query, every webhook,
every cron), expect < 1 M ops/month per workspace → < $0.50/mo.
Negligible.

### 4.5 Application-side wiring

- [ ] Add the key resource path to AFFiNE config:

```jsonc
// /srv/affine/data/affine-config/config.json
{
  "analytics": {
    "kmsKey": "projects/affine-495114/locations/global/keyRings/gogocash-keyring/cryptoKeys/analytics-tokens",
  },
}
```

- [ ] Backend `connections/token-store.ts` (per PRD §4 module structure)
      uses the GCP KMS Node SDK with this resource path. The SDK reads
      ADC from the GCE metadata server — no key file deploy needed.

---

## 5. Submission Order & Calendar

Assuming kickoff today (Day 0 = 2026-05-04). Approvals run in parallel
with engineering; engineering work on Phase 1 is unblocked from Day 0
because it depends only on KMS + GoGoCash internal data (no external
approvals needed).

| Day         | Approvals work                                                                                                                                                                                                                                                                  | Engineering work (PRD §9)                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Day 0**   | Run all `gcloud kms` commands in §4. Create+verify keyring + key. Bind IAM. Enable audit logs. (R1 — coordinate with whoever owns GCP project IAM.) Open LINE Developers console, create provider + Messaging API channel. Document channel secret + access token in 1Password. | Phase 1 kickoff: Prisma schema + migration; backend module scaffold; frontend module + nav.                                                       |
| **Day 1**   | Submit Meta Business Verification documents. Create the Meta App in Development mode; configure URLs, app icon, redirect URI.                                                                                                                                                   | Continue Phase 1: KMS-backed token store (using key from §4); GoGoCash internal poller.                                                           |
| **Day 2**   | Submit TikTok Developer app for review (Display API + Content Posting tier). Send LINE Thailand BD outreach (§3.2 ACTION).                                                                                                                                                      | Phase 1 finishing: cost meter + first dashboard cards.                                                                                            |
| **Day 3–7** | Wait on Meta Business Verification (~2–10 business days). Wait on TikTok review (~1–4 weeks). Build Meta screencasts in advance using Development-mode app + test users.                                                                                                        | Phase 1 E2E + sign-off; Phase 2 starts: LINE OAuth + webhook; AI prompts (four-step dance per CLAUDE.md §5c).                                     |
| **Week 2**  | Once Meta Business Verification clears, submit App Review with all 8 scopes + screencasts + use case statements.                                                                                                                                                                | Phase 2 finishing: AI insight UI; weekly strategy E2E test against GoGoCash + LINE data.                                                          |
| **Week 3**  | Handle Meta review responses (almost always: at least 1 scope rejected on first pass, fix screencast or copy, resubmit within 48 h to keep momentum). Get LINE Thailand response on Voom API.                                                                                   | Phase 3 starts: implement Meta OAuth + webhook controller (works in Development mode against test users — no Meta approval blocker for dev work). |
| **Week 4**  | Meta scopes start clearing 1-by-1. Each clearance unblocks Phase 3 features in production.                                                                                                                                                                                      | Phase 3 finishing: per-platform deep-dive views; webhook signature verification tests.                                                            |
| **Week 5**  | TikTok approval expected this week. If denied, file appeal + ship Display API fallback path.                                                                                                                                                                                    | Phase 4: TikTok integration (in fallback shape — Display API only).                                                                               |
| **Week 6**  | All approvals settled (or fallback paths confirmed for any rejections).                                                                                                                                                                                                         | Phase 5 polish + production deploy.                                                                                                               |

**Critical-path dependencies:**

- Meta App Review can take longer than 4 weeks if the first submission
  has issues. Build the screencast bundle on **Day 1**, do not wait
  for Business Verification (you can record screencasts in dev mode
  with test users).
- LINE Thailand BD response is the only item that can stall the LINE
  feature beyond the calendar above. If they don't respond in 5 days,
  ship without Voom API and surface the OA-Manager external link.
- TikTok Research API is **not on the critical path** — we don't
  apply for it. Display API is what we actually need.

---

## 6. Open contact items / "who to ping"

| Owner                             | Action                                                                                                                                                                                                                                                         | Notes                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **GoGoCash BD lead**              | Contact LINE Thailand (`partner@linecorp.com.th` or via the LINE for Business Thailand portal) for VOOM analytics API confirmation (§3.2)                                                                                                                      | Highest-uncertainty item in the whole stack. Send before Day 1. |
| **GoGoCash legal / compliance**   | Confirm Thailand-specific document set for Meta Business Verification (§1.2 VERIFY). Confirm DBD Affidavit copies are < 90 days old.                                                                                                                           | Block on first attempt; fall back to Meta support if rejected.  |
| **GoGoCash GCP admin**            | Run §4 `gcloud kms` commands. R1 — ask before granting IAM bindings.                                                                                                                                                                                           | One-time, < 1 hour total work.                                  |
| **GoGoCash design/marketing**     | Produce the 1024×1024 Meta app icon, the 240×240 TikTok logo, the 512×512 LINE channel icon. None can contain platform brand assets.                                                                                                                           | Day 0–1.                                                        |
| **GoGoCash legal**                | Author the data-deletion-instructions page at `/legal/data-deletion-instructions` (§1.1) and update privacy policy to name FB/IG/Threads/TikTok/LINE explicitly (§1.4).                                                                                        | Day 0–1. Required before Meta submission.                       |
| **AFFiNE engineering**            | Build the data-deletion callback endpoint as Phase 5 polish (§1.1 option a), so that v2.1 can move from instructions URL to callback URL without a Meta re-review.                                                                                             | Phase 5 — not blocking v1.                                      |
| **Anthropic-style honesty check** | If LINE Voom API turns out not to exist, **update PRD §8** to remove the "real-time webhooks for Voom posts" claim and replace with "Messaging API insights only; Voom analytics deep-link to LINE Studio". Don't ship a UI that promises data we can't fetch. | Whoever lands the LINE response.                                |

---

## 7. Quick-reference: the top 3 ways this can go sideways

1. **LINE Voom API simply doesn't exist publicly.** All current public
   sources point to web-UI-only analytics in VOOM Studio. If the LINE
   Thailand confirmation comes back negative, we ship LINE deep-dive
   with Messaging-API-only metrics + an external-link button to VOOM
   Studio. PRD §8 must be updated to match.
2. **Meta scope rejection cascade.** If reviewers cite "principle of
   least privilege" on `pages_manage_metadata` (we use it only for
   webhook subscriptions, not for any actual metadata mutation), we may
   need to drop it entirely and run Meta in **polling-only** mode for
   v1 — affects the "<60 s real-time" goal in PRD §9 Phase 3 E2E test.
   Prepare the polling fallback in code from Day 1.
3. **TikTok webhook event catalog is thinner than PRD assumes.**
   PRD §8 lists `video.upload`, `video.publish` as webhook events.
   Per https://developers.tiktok.com/doc/webhooks-events/, only
   `video.upload.failed` is firing for non-partner apps as of May 2026.
   The `video.publish` success path must be polled (`/v2/video/list/`
   every 15 min). PRD §8 should be updated to reflect this.

---

## Sources

- [Meta App Review — Permissions Reference](https://developers.facebook.com/docs/permissions/)
- [Meta App Review — Submission Guide](https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide)
- [Meta App Review — App Roles / Test Users](https://developers.facebook.com/docs/development/build-and-test/app-roles/)
- [Meta — Data Deletion Callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/)
- [Meta — Business Verification (upload documents)](https://www.facebook.com/business/help/159334372093366)
- [Meta — Instagram Platform App Review](https://developers.facebook.com/docs/instagram-platform/app-review/)
- [Meta — Threads Get Started + Permissions](https://developers.facebook.com/docs/threads/get-started/get-access-tokens-and-permissions/)
- [TikTok — Scopes Overview](https://developers.tiktok.com/doc/scopes-overview)
- [TikTok — Webhooks Overview](https://developers.tiktok.com/doc/webhooks-overview/)
- [TikTok — Webhook Events](https://developers.tiktok.com/doc/webhooks-events/)
- [TikTok — Research API Product Page](https://developers.tiktok.com/products/research-api/)
- [LINE — Messaging API Overview](https://developers.line.biz/en/docs/messaging-api/overview/)
- [LINE — Verify Webhook Signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)
- [LINE — Get Started Messaging API](https://developers.line.biz/en/docs/messaging-api/getting-started/)
- [LINE VOOM Studio (live, May 2026)](https://voom-studio.line.biz/)
- [GCP — Cloud KMS IAM](https://cloud.google.com/kms/docs/iam)
- [GCP — Cloud KMS Permissions & Roles](https://cloud.google.com/kms/docs/reference/permissions-and-roles)
- [GCP — Cloud KMS Locations](https://cloud.google.com/kms/docs/locations)
