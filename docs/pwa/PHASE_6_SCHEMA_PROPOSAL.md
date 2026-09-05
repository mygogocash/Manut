# Phase 6 — Schema Proposal: Push Subscriptions

**A database change IS required.** This document exists because Step 8/30 of the brief forbids creating a migration silently. Read this before the migration is applied anywhere.

Status: **migration file written, NOT applied to any database.** See §8.

---

## 1. Why a table is needed at all

Checked first, as instructed. There is **no existing push infrastructure** anywhere in the repository — no `web-push`, no VAPID, no `pushManager`, no `PushSubscription`, and no notification-preference model on this branch. Re-verified this phase by grepping `apps/api/src`, `apps/web/src` and the whole Prisma schema.

What *does* exist and is reused unchanged:

| Existing | Role | Reused how |
| --- | --- | --- |
| `CrmNotification` | Persisted per-user notification events (`title`, `body`, `linkUrl`, `readAt`) | Push reads recipients and content from the same events; **no duplicate notification table** |
| Dashboard read-model | Recomputes pending approvals, urgent items etc. on demand | Untouched — the bell keeps using it |
| Email service | Existing templated delivery | Untouched — push sits beside it, not instead of it |

A push *subscription* cannot be derived from any of these: it is a browser-issued endpoint plus two keys, per device, and the Web Push protocol requires storing it verbatim to deliver anything. Hence one new table, and nothing else.

## 2. Proposed model

```prisma
model PushSubscription {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  endpoint  String   @unique @db.Text
  p256dh    String   @db.Text
  auth      String   @db.Text
  userAgent String?  @map("user_agent") @db.Text
  failureCount Int   @default(0) @map("failure_count")
  lastSuccessAt DateTime? @map("last_success_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@map("push_subscriptions")
}
```

### Field rationale

| Field | Why it is here | Why not more |
| --- | --- | --- |
| `userId` | Delivery is per recipient; the server resolves who, never the client | No FK relation declared — see §3 |
| `endpoint` | The push service URL. **Required** by the protocol | `@unique`: the browser reissues the same endpoint for the same device, so re-subscribing must update rather than accumulate |
| `p256dh`, `auth` | The two keys RFC 8291 payload encryption requires | These are *browser-issued per-subscription* values, not user credentials |
| `userAgent` | Lets an admin recognise a stale device and lets a user tell two subscriptions apart | Truncated to 255 chars on write; **no** device id, no IP, no OS fingerprint, no locale |
| `failureCount` | Distinguishes a transient blip from a dead endpoint | Reset to 0 on success |
| `lastSuccessAt` | Cheap observability: "has this device ever received anything" | No delivery log table — see §5 |
| `createdAt` / `updatedAt` | Repo convention | |

**Deliberately absent:** notification content or history (that already lives in `CrmNotification`), auth tokens, session identifiers, IP addresses, precise device models, and any per-category preference columns (§6).

## 3. Relationships

**No Prisma relation to `User` is declared**, and this is deliberate rather than an oversight.

`CrmNotification` — the closest precedent in this schema — also stores a bare `userId String @db.Uuid` with no relation. Declaring one here would add a relation field to the `User` model, which is a change to a heavily-used model for no functional gain: the service always loads subscriptions by `userId`, never by traversing from a user.

**Consequence, stated plainly:** deleting a user does not cascade-delete their subscriptions. Mitigated because (a) users are soft-deleted in this codebase, not hard-deleted, and (b) a subscription for a deactivated user is unusable — the send path resolves recipients from live queries, and any orphan is pruned by the 410/404 handling in §5.

## 4. Indexes

| Index | Query it serves |
| --- | --- |
| `@@index([userId])` | "every active device for this recipient" — the only read path in the send loop |
| `@unique` on `endpoint` | Upsert on re-subscribe, and the lookup used to delete on unsubscribe |

No composite index is proposed; the table is expected to hold roughly *users × devices*, which for this organisation is in the hundreds.

## 5. Data lifecycle and cleanup

| Event | Action |
| --- | --- |
| User enables notifications | Upsert on `endpoint`. Re-enabling on the same device updates the row rather than creating a second |
| Browser rotates the subscription | Old endpoint stops working → pruned on first 404/410 |
| User disables notifications | Row deleted immediately (not soft-deleted — a dead subscription has no audit value) |
| Push service returns **404 / 410** | Permanent: row deleted at once. This is the protocol's "this endpoint is gone" signal |
| Push service returns **429 / 5xx** | Transient: `failureCount` incremented, row kept |
| `failureCount` reaches 10 | Row deleted. Stops indefinite retries against an endpoint that never recovers |
| Successful delivery | `failureCount` reset to 0, `lastSuccessAt` stamped |
| User logs out | **Subscription is deleted** — see §7 |

No cron job is introduced. Cleanup is driven by delivery outcomes, so a dead endpoint is removed the first time it is used rather than waiting for a sweep.

## 6. Security implications

1. **`p256dh` and `auth` are not user secrets.** They are per-subscription keys the browser generates so the push service can encrypt a payload it cannot read. Leaking them would let an attacker who *also* had the endpoint send notifications to that device — unpleasant, not an account compromise. They are nonetheless treated as sensitive: never logged, never returned to any client.
2. **The endpoint is never accepted as an identity.** Subscribe/unsubscribe operate on `req.user.id` from the existing session; a caller cannot subscribe or unsubscribe another user by supplying an endpoint.
3. **Recipients are resolved server-side.** The client never says who to notify.
4. **Payloads are minimal** — a title, a neutral body and a `notificationId` + relative `url`. No amounts, names or record details, because a notification renders on a lock screen.
5. **VAPID private key is server-only**, from the existing env conventions. Only the public key reaches the browser, which is what the standard intends.
6. **Shared-device risk** is why logout deletes the subscription (§7).

## 7. Logout behaviour

Logging out deletes that device's subscription. Otherwise a shared or handed-on laptop would keep receiving the previous user's notifications, and the user has no way to see or revoke it. This is a deliberate trade: the user must re-enable after signing back in.

## 8. Migration strategy

**Written but not applied.** The file is additive and idempotent:

```
packages/database/prisma/migrations/20261218000000_push_subscriptions/migration.sql
```

- `CREATE TABLE IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`.
- New table only. **No existing table is altered**, so nothing in flight can be affected.
- No data migration, so the `db:push`-on-staging hazard in `CLAUDE.md` does not bite: staging gets the table from the schema push, and there is no backfill to miss.

**Not applied to the shared dev/staging database**, deliberately. That database is re-synced by `db:push` from the `dev` branch's schema, which does not yet contain this model — the column-dropping incident recorded in Phase 3 would repeat. It should be applied when this work merges to `dev`.

## 9. Rollback strategy

| Scenario | Action |
| --- | --- |
| Revert before merge | Delete the migration directory and the `push.prisma` model. Nothing else references the table |
| Revert after deploy | `DROP TABLE push_subscriptions;` — no other table has a FK to it, so the drop is unconstrained |
| Disable without rollback | Leave the table; unset `VAPID_PRIVATE_KEY`. The send path logs a warning and no-ops, the subscribe endpoint refuses, and the rest of the intranet is unaffected |

The last row is the important one: **push can be switched off with an environment variable**, without a migration or a deploy of code changes.

## 10. What this does not do

- No notification **preference** table. Step 12 says not to build a preference system unless the product requires one; none exists today. The send path takes a category string, so per-category preferences can be added later without touching this table.
- No delivery **log** table. `failureCount` and `lastSuccessAt` are enough to spot a dead device; a per-attempt log would grow without bound and would hold exactly the payloads §6 says not to keep.
- No **queue**. See the main Phase 6 document — the existing codebase has no job runner, and the brief forbids introducing Redis or similar for this alone.
