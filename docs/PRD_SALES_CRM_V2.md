# PRD — Sales CRM v2

> Proposed evolution of the Sales CRM module from a flat `Deal` table into a full **Lead → Opportunity → Account/Contact** pipeline with activity tracking. Triggered by Vivek feedback batch 1 item #2 (deferred from PR #72).

**Status**: Phase 1 (schema + backend) SHIPPED; Phase 2 (UI) largely shipped; Phase 3 (drop legacy `Deal`) NOT done
**Owner**: TBD
**Target reviewers**: Vivek (product), sales lead, engineering

> **Implementation status (2026-06-16).** The v2 backend is live: `leads`, `opportunities`,
> `accounts`, `contacts` modules exist with services/tests + the §8 permissions, and the lead
> `convert` transaction is implemented. The pipeline stage list shipped with an extra **`live`**
> stage after `closed_won` (a won deal now generating revenue — see
> `opportunities.constants.ts`), and within-column **drag-reorder** shipped via
> `POST /api/opportunities/reorder-within-stage`. The `/sales` route exists; the legacy `/deals`
> route + `deals` module + `Deal` table are **still present** (Phase 3 cleanup pending). Treat the
> sections below as the original plan; deltas from it are the `live` stage and reorder.

---

## 1. Problem

The current Sales CRM is a single-table `Deal` model where:

- `company` and `contact` are free-text strings — no first-class accounts or people
- Pre-qualified inquiries (cold inbounds, conference scans) live nowhere; sales reps lose them or capture them as half-stage Deals that pollute the pipeline
- No activity log: calls, emails, meeting notes are not captured against a deal or contact
- No follow-up tasks tied to a deal — reps depend on personal calendars
- One `Deal` cannot model both _early-stage interest_ ("might want our platform") and _negotiated commercial deal_ — the same record carries both, distorting probability/forecast math

Vivek's feedback (batch 1 #2) is that the workspace cannot replace HubSpot/Salesforce for the sales team in its current shape.

## 2. Goals

- Treat **leads** (unqualified) and **opportunities** (qualified deals in pipeline) as distinct entities with a conversion step
- First-class **accounts** (companies) and **contacts** (people), de-duped, reusable across opportunities
- **Activities** (call / email / meeting / note) and **tasks** (follow-ups with due dates) tied to lead, opportunity, account, or contact
- Stage-by-stage forecast based only on opportunities, not leads
- Migration from existing `Deal` rows without losing pipeline state

## 3. Non-goals (v2)

- Email send/sync (defer to integration with Gmail module)
- Quoting / CPQ / contract generation
- Marketing automation, drip sequences
- Lead scoring (rule-based or ML)
- Territory management, quota assignment
- Mobile app

These are explicit non-goals so v2 stays shippable. Each can become its own PRD.

## 4. Personas + user stories

**Sales rep**
- As a rep I capture a fresh inquiry as a **Lead** with company name, contact name, source — no obligation to fill probability or close date yet.
- As a rep I work the lead with calls/emails — each interaction logs as an **Activity** on the lead.
- As a rep I qualify the lead — convert it to an **Opportunity**. Conversion creates an Account (if new), a Contact, and a fresh Opportunity tied to both. The Lead is closed (status = `converted`), kept for audit.
- As a rep I move the Opportunity through stages, set probability, close date, value.
- As a rep I create follow-up **Tasks** ("call back Tuesday") visible on my Today list.

**Sales lead / manager**
- As a manager I see weighted pipeline (sum of `value × probability` per stage) for my team
- As a manager I see leads aging without activity for >N days (stale-lead alert)
- As a manager I reassign a lead or opportunity to another rep

**Finance / leadership**
- See a forecast snapshot tied to closeDate quarter, broken by stage

## 5. Data model

```prisma
model Account {
  id          String    @id @default(cuid())
  name        String
  domain      String?   @unique // dedupe key
  industry    String?
  size        String?   // 1-10, 11-50, 51-200, 201-1000, 1000+
  country     String?
  website     String?
  notes       String?
  ownerId     String    @map("owner_id") @db.Uuid
  partnerId   String?   @map("partner_id") // optional bridge to Partner CRM
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  owner         User           @relation(fields: [ownerId], references: [id])
  partner       Partner?       @relation(fields: [partnerId], references: [id])
  contacts      Contact[]
  opportunities Opportunity[]
  activities    Activity[]

  @@map("accounts")
}

model Contact {
  id         String    @id @default(cuid())
  accountId  String    @map("account_id")
  firstName  String    @map("first_name")
  lastName   String    @map("last_name")
  email      String?
  phone      String?
  title      String?
  isPrimary  Boolean   @default(false) @map("is_primary")
  notes      String?
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  account       Account        @relation(fields: [accountId], references: [id], onDelete: Cascade)
  opportunities Opportunity[]
  activities    Activity[]

  @@index([accountId])
  @@index([email])
  @@map("contacts")
}

model Lead {
  id         String   @id @default(cuid())
  company    String                          // free-text, becomes Account.name on convert
  firstName  String   @map("first_name")
  lastName   String   @map("last_name")
  email      String?
  phone      String?
  title      String?
  source     String                          // web, referral, conference, partner, cold, other
  status     String   @default("new")        // new, contacted, qualified, converted, disqualified
  ownerId    String   @map("owner_id") @db.Uuid
  notes      String?
  convertedOpportunityId String?   @map("converted_opportunity_id")
  convertedAt            DateTime? @map("converted_at")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  owner                 User         @relation(fields: [ownerId], references: [id])
  convertedOpportunity  Opportunity? @relation(fields: [convertedOpportunityId], references: [id])
  activities            Activity[]

  @@index([ownerId, status])
  @@map("leads")
}

model Opportunity {
  id          String    @id @default(cuid())
  name        String                                // "Acme — Platform Q3"
  accountId   String    @map("account_id")
  contactId   String?   @map("contact_id")          // primary point of contact
  stage       String    @default("qualified")       // qualified, proposal, negotiation, closed_won, closed_lost
  value       Decimal   @db.Decimal(15, 2)
  currency    String    @default("USD")
  probability Int       @default(20)                // 0..100
  closeDate   DateTime? @map("close_date") @db.Date
  type        String?                               // enterprise, smb, startup
  notes       String?
  ownerId     String    @map("owner_id") @db.Uuid
  lostReason  String?   @map("lost_reason")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  account    Account    @relation(fields: [accountId], references: [id])
  contact    Contact?   @relation(fields: [contactId], references: [id])
  owner      User       @relation(fields: [ownerId], references: [id])
  activities Activity[]
  tasks      CrmTask[]
  fromLeads  Lead[]                                 // back-relation for converted leads

  @@index([stage])
  @@index([ownerId, stage])
  @@map("opportunities")
}

model Activity {
  id            String    @id @default(cuid())
  type          String                              // call, email, meeting, note
  subject       String
  body          String?
  occurredAt    DateTime  @map("occurred_at")
  durationMins  Int?      @map("duration_mins")
  ownerId       String    @map("owner_id") @db.Uuid
  // exactly one of leadId / opportunityId / contactId / accountId is required at app layer
  leadId        String?   @map("lead_id")
  opportunityId String?   @map("opportunity_id")
  contactId     String?   @map("contact_id")
  accountId     String?   @map("account_id")
  createdAt     DateTime  @default(now()) @map("created_at")

  owner       User         @relation(fields: [ownerId], references: [id])
  lead        Lead?        @relation(fields: [leadId], references: [id], onDelete: Cascade)
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  contact     Contact?     @relation(fields: [contactId], references: [id], onDelete: Cascade)
  account     Account?     @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([leadId])
  @@index([opportunityId])
  @@index([occurredAt])
  @@map("crm_activities")
}

model CrmTask {
  id            String    @id @default(cuid())
  subject       String
  dueDate       DateTime  @map("due_date") @db.Date
  status        String    @default("open")          // open, done, cancelled
  ownerId       String    @map("owner_id") @db.Uuid
  opportunityId String?   @map("opportunity_id")
  leadId        String?   @map("lead_id")
  completedAt   DateTime? @map("completed_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  owner       User         @relation(fields: [ownerId], references: [id])
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  lead        Lead?        @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([ownerId, status, dueDate])
  @@map("crm_tasks")
}
```

The legacy `Deal` table is **migrated** (not dropped) — see §9.

## 6. Conversion flow

`POST /api/leads/:id/convert` body:

```ts
{
  // optional account override — if domain matches an existing account, link to it
  accountId?: string;          // existing account
  newAccount?: {                // create new
    name: string;
    domain?: string;
    industry?: string;
    country?: string;
  };
  // contact: defaults to creating from lead's first/last/email
  contactId?: string;           // existing contact
  newContact?: { firstName, lastName, email?, phone?, title? };
  // opportunity defaults
  opportunity: {
    name: string;
    stage?: string;             // default "qualified"
    value: number;
    currency?: string;          // default "USD"
    probability?: number;       // default 20
    closeDate?: string;
    type?: string;
  };
}
```

Server-side transaction:
1. Resolve / create Account (dedupe by `domain` if provided)
2. Resolve / create Contact under that Account, mark `isPrimary` if first
3. Create Opportunity tied to Account + Contact, owner inherits from Lead
4. Update Lead — `status="converted"`, `convertedOpportunityId`, `convertedAt`
5. Copy Lead activities to the new Opportunity (re-target via `opportunityId`, keep `leadId` for audit)

Disqualify is a separate endpoint: `POST /api/leads/:id/disqualify` with reason — sets `status="disqualified"`. No conversion.

## 7. API endpoints

| Method | Endpoint                              | Permission              |
| ------ | ------------------------------------- | ----------------------- |
| GET    | `/api/leads`                          | `crm:read`              |
| POST   | `/api/leads`                          | `crm:create`            |
| GET    | `/api/leads/:id`                      | `crm:read`              |
| PUT    | `/api/leads/:id`                      | `crm:update`            |
| POST   | `/api/leads/:id/convert`              | `crm:update`            |
| POST   | `/api/leads/:id/disqualify`           | `crm:update`            |
| DELETE | `/api/leads/:id`                      | `crm:delete`            |
| GET    | `/api/accounts`                       | `crm:read`              |
| POST   | `/api/accounts`                       | `crm:create`            |
| GET    | `/api/accounts/:id`                   | `crm:read`              |
| PUT    | `/api/accounts/:id`                   | `crm:update`            |
| DELETE | `/api/accounts/:id`                   | `crm:delete`            |
| GET    | `/api/contacts`                       | `crm:read`              |
| POST   | `/api/contacts`                       | `crm:create`            |
| GET    | `/api/contacts/:id`                   | `crm:read`              |
| PUT    | `/api/contacts/:id`                   | `crm:update`            |
| DELETE | `/api/contacts/:id`                   | `crm:delete`            |
| GET    | `/api/opportunities`                  | `crm:read`              |
| GET    | `/api/opportunities/pipeline`         | `crm:read`              |
| POST   | `/api/opportunities`                  | `crm:create`            |
| GET    | `/api/opportunities/:id`              | `crm:read`              |
| PUT    | `/api/opportunities/:id`              | `crm:update`            |
| DELETE | `/api/opportunities/:id`              | `crm:delete`            |
| GET    | `/api/crm/activities`                 | `crm:read`              |
| POST   | `/api/crm/activities`                 | `crm:create`            |
| PUT    | `/api/crm/activities/:id`             | `crm:update`            |
| DELETE | `/api/crm/activities/:id`             | `crm:delete`            |
| GET    | `/api/crm/tasks`                      | `crm:read`              |
| POST   | `/api/crm/tasks`                      | `crm:create`            |
| PUT    | `/api/crm/tasks/:id`                  | `crm:update`            |
| PUT    | `/api/crm/tasks/:id/complete`         | `crm:update`            |
| DELETE | `/api/crm/tasks/:id`                  | `crm:delete`            |

Manager-scope reads (permission `crm:team-read`) return all rows where owner is on the manager's team. Default `crm:read` is "own records only" plus records where the user is on a shared team.

## 8. Permissions

| Code               | Description                                  |
| ------------------ | -------------------------------------------- |
| `crm:read`         | View own + team-shared CRM records           |
| `crm:team-read`    | View all CRM records owned by direct reports |
| `crm:create`       | Create leads, accounts, contacts, opps       |
| `crm:update`       | Update CRM records (own + team-shared)       |
| `crm:delete`       | Delete CRM records (own only by default)     |
| `crm:reassign`     | Change owner on a lead or opportunity        |
| `crm:export`       | Export pipeline to XLSX                      |
| `crm:admin`        | Manage stages, sources, lost-reasons         |

## 9. Migration plan

Existing `Deal` rows must not be lost.

**Phase 1 — additive (one PR)**:
- Add new tables (`accounts`, `contacts`, `leads`, `opportunities`, `crm_activities`, `crm_tasks`)
- Build all v2 endpoints
- Build a backfill script:
  - For each `Deal` where `stage in ('lead')` → create Lead row, owner preserved
  - For each `Deal` where `stage in ('qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')`:
    - Create Account from `Deal.company` (dedupe by name only — no domain in legacy)
    - Create Contact from `Deal.contact` if non-null (split on first space → first/last)
    - Create Opportunity inheriting `value`, `stage`, `probability`, `closeDate`, `type`, `notes`, `ownerId`, `partnerId` (now on Account)
- Old `/api/deals` endpoints kept, marked deprecated, return v2 data via shim

**Phase 2 — UI cutover**:
- New `/sales` route with sub-tabs: Pipeline (kanban of Opportunities), Leads, Accounts, Contacts, Activities, Tasks
- Keep `/deals` route up but redirect to `/sales/pipeline` after one release

**Phase 3 — drop legacy**:
- Remove `model Deal` from schema, drop `deals` table, remove `/api/deals` routes
- Done after one full release with both paths live and zero traffic on `/api/deals`

## 10. UI screens (v2)

| Screen                  | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `/sales/pipeline`       | Kanban board of Opportunities by stage, with weighted total per col |
| `/sales/leads`          | Table of Leads, filter by status + owner + source                   |
| `/sales/leads/:id`      | Lead detail sheet — info, activities, "Convert" CTA                 |
| `/sales/accounts`       | Table of Accounts, filter by industry + country                     |
| `/sales/accounts/:id`   | Account detail — contacts, opportunities, activities                |
| `/sales/contacts`       | Table of Contacts                                                   |
| `/sales/contacts/:id`   | Contact detail sheet                                                |
| `/sales/opportunities/:id` | Opportunity detail — stage controls, activities, tasks           |
| `/sales/tasks`          | Today's tasks for the current user, grouped by overdue / today / soon |

Convention: detail views are right-side sheets (consistent with travel, payroll, employees post-PR #73, #72).

## 11. Decisions

The seven open questions from the original draft are resolved below as **proposed defaults**. Each has a rationale and a fallback so Vivek can override before Phase 1 ships. Anything that requires a code change after Phase 1 lands is called out as a follow-up.

### 11.1 Owner on conversion → **lead owner stays**

When a Lead is converted, the resulting Opportunity inherits the Lead's `ownerId` even if a different user clicks Convert. The converter is recorded on the conversion Activity (`ownerId`) so we still have an audit trail.

**Why:** The converter is often a sales manager doing the click on behalf of the rep. Reassigning ownership at convert-time would be a silent reassignment — better to keep ownership with the rep who worked the lead, and let `crm:reassign` (an explicit permission) handle the rare case where ownership should change.

**Override:** body parameter `ownerId` on `POST /api/leads/:id/convert` lets a `crm:reassign` user pick a different owner up-front; otherwise the request is rejected if the body tries to change ownership.

### 11.2 Account dedupe → **domain primary, name fallback with confirmation**

On `POST /api/accounts` and inline during conversion:
- If a `domain` is supplied, match against `Account.domain` (unique index). Hard reject creation if a record exists; client must use `accountId` to attach.
- If no domain, do a case-insensitive `name` match. If a row exists, the API returns `409 Conflict` with the candidate's `id`/`name`/`domain` so the client can render a "Did you mean Acme Corp?" disambiguation step. Client passes `confirmCreate: true` to override and create a new row.

**Why:** Domain is the only reliable corporate identifier we have. Names are noisy ("Acme", "Acme Corp", "Acme, Inc."). Hard-blocking on name causes false negatives for legitimate distinct accounts; soft-blocking with a confirmation prompt gives the rep agency.

### 11.3 Stale-lead threshold → **14 days, hard-coded in v2**

Leads with `status in ('new', 'contacted')` and no Activity in the last 14 days surface in the manager's "Stale leads" view and on the daily digest email.

**Why:** 14 days is the SaaS sales norm. Per-workspace configurability adds a `WorkspaceSetting` table or a `system_settings.stale_lead_days` row plus an admin UI — disproportionate for v2.

**Follow-up:** Move to `system_settings` once v2 is in production and we have feedback that 14 doesn't fit. Listed under §15 below.

### 11.4 Probability defaults per stage → **opinionated defaults, rep-overridable**

| Stage | Default probability |
| --- | --- |
| qualified | 20 |
| proposal | 40 |
| negotiation | 60 |
| closed_won | 100 |
| closed_lost | 0 |

When a rep moves an Opportunity to a new stage, `probability` snaps to the stage default *only if* the rep has not manually set it on this Opportunity yet (tracked by a `probabilityCustom Boolean` flag, default `false`). Once they touch it, we never overwrite.

**Why:** Standard pipeline-management hygiene. Pure rep-set probability gives inconsistent forecasts; pure stage-driven probability strips rep intuition. The hybrid keeps both.

### 11.5 Currency → **per-Opportunity, single-FX reporting**

`Opportunity.currency String @default("USD")` is in v2. Forecast totals on the pipeline view are summed **per currency**, displayed side-by-side ("$425k + ฿2.1M"). No FX conversion in v2.

**Why:** Multi-currency is a real workflow at TBH (Thailand + USD investors). FX reporting needs an FX rate table + a daily fetch job + a "report-as currency" toggle — that's its own PRD.

**Follow-up:** Cross-currency aggregated forecast view is out of v2. Tracked in §15.

### 11.6 Partner CRM relationship → **soft link, no merge**

`Account.partnerId String? @map("partner_id")` is a nullable FK to `Partner`. UI shows a "Linked partner: Acme Co." chip on the Account detail and a "Linked sales accounts" panel on the Partner detail. Partner and Account stay separate records.

**Why:** Partners and sales accounts have different lifecycles and different fields (Partner has `contractValue`, `contractStart/End`; Account has `domain`, sales-process metadata). Merging would force one model to swallow the other and bloat the schema.

### 11.7 Lead source enum → **fixed in v2, expandable later**

Allowed values: `web`, `referral`, `conference`, `partner`, `cold`, `other`. Server-side zod enum.

**Why:** Sales reporting needs a finite set or the "by source" charts become free-text noise. Six values cover ≥95% of inbounds based on Vivek's batch 1 transcript.

**Follow-up:** A `lead_sources` table for workspace-admin extensibility is in §15.

## 12. Phase 1 acceptance criteria

Phase 1 has shipped. Status of the original acceptance criteria (verify specifics against the
modules before relying on any single line):

- [x] Migrations land (`accounts`, `contacts`, `leads`, `opportunities`, `crm_activities`, `crm_tasks`)
- [x] §7 endpoints implemented behind the §8 permissions
- [x] `POST /api/leads/:id/convert` runs as a single Prisma transaction with the §11.1 `ownerId` override, §11.2 dedupe, and Lead-activity copy (`leads.convert.test.ts`)
- [x] `Account.domain` unique; `Account.name` fallback lookup
- [x] `Opportunity.probabilityCustom` stage-default behaviour per §11.4
- [x] Backfill script `Deal` → Lead / Account+Contact+Opportunity (see `accounts/account-deal.sync.ts`)
- [x] `/api/deals` still responds (legacy module retained — `deals.shape.test.ts`)
- [x] Permissions seeded
- [x] API + web type-check, lint, unit tests pass (PR-checks gate)

Phase 2 (UI) is largely shipped (`/sales`). **Phase 3 (drop the legacy `Deal` table) is not done** —
the `deals` module + `/deals` route + `Deal` table are still live.

## 13. Out of scope reminders

- No email sync (defer to Gmail module integration PRD)
- No quoting / contract generation
- No marketing automation
- No mobile

## 14. Rough effort estimate

Assuming the schema/decisions above are accepted as-is:

| Phase                     | Estimate    |
| ------------------------- | ----------- |
| Schema + backend (Phase 1) | ~2 weeks    |
| UI v2 + migration (Phase 2) | ~2 weeks  |
| Legacy cleanup (Phase 3)  | ~3 days     |

Total: **~4.5 weeks** to fully replace current `/deals` with `/sales`.

## 15. Follow-ups (not in v2)

These were called out inline in §11 and §12 — repeated here so they don't get lost:

- **Workspace-configurable stale-lead threshold** (§11.3) — move from hard-coded `14` to `system_settings.stale_lead_days` once we have post-launch feedback
- **Cross-currency aggregated forecast** (§11.5) — needs an FX-rate table, daily refresh job, and a "report-as currency" picker. Its own PRD.
- **Workspace-admin lead source extensibility** (§11.7) — promote from zod enum to a `lead_sources` lookup table once a customer needs a value we didn't ship
- **Admin UI for `category` on leave types** (cross-reference: tracked in #83) — same pattern likely useful for `lead_sources` and `lost_reasons`

---

## Sign-off needed from

- [x] Vivek (product) — §11 open questions resolved as **proposed defaults** in #84. Vivek to override before Phase 1 lands or accept by silent ratification.
- [ ] Sales lead — confirm stage list + permissions
- [ ] Engineering — confirm migration approach is acceptable
