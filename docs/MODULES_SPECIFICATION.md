# Intranet - Modules Specification

> **Partial. Measured 2026-08-26.** This file specifies roughly **55** modules;
> `apps/api/src/modules/` contains **99**. Around 44 have no spec here.
>
> It is still the best prose description of the modules it *does* cover — but do
> not infer that an absent module does not exist. `apps/api/src/modules/` is the
> inventory; this is commentary. Gap tracked in [`DOCS_PLAN.md`](DOCS_PLAN.md).

---

## Table of Contents

1. [Module Overview](#module-overview)
2. [Workspace Modules](#workspace-modules)
3. [Revenue Modules](#revenue-modules)
4. [People Modules](#people-modules)
5. [Fundraising Modules](#fundraising-modules)
6. [Finance Modules](#finance-modules)
7. [Content Modules](#content-modules)
8. [Integration Modules](#integration-modules)
9. [System Modules](#system-modules)

---

## Module Overview

Intranet contains **36 documented modules** organized into **8 groups**. The
platform mounts substantially more API route families than there are numbered
modules here — several modules span a family of routes, and the CRM surfaces
share infrastructure. Treat the numbering as a reading order, not a census.

| Group            | Modules                                                                       | Description                           |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------- |
| **Workspace**    | Home, Dashboard, ARIA, Messaging, Projects (incl. Approval Workflow & Proposals) | Daily work hub and collaboration      |
| **Revenue**      | Partner CRM, Sales CRM, Sales Revenue CRM, Marketing Analytics                | Sales, partnership and engagement analytics |
| **People**       | Leave, Payroll, HRMS (incl. Attendance + ESOP), Survey Forms, Survey, Certificates, Benefits, Onboarding, Learning, Visa, Office, Directory | Human resources and employee services |
| **Fundraising**  | Cap Table, Investor Dashboard, Investor CRM, Data Room, Investor Updates      | Investor relations management         |
| **Finance**      | Revenue Analytics, Accounting, Expenses                                       | Financial operations                  |
| **Content**      | Blog Management, PR/Article Management, Company News                          | Content publishing and PR             |
| **Integrations** | Gmail, Drive                                                                  | External service integrations         |
| **System**       | Settings, Admin, Access Control                                               | Platform administration               |

---

## Workspace Modules

### 1. Home Dashboard

**Purpose**: Executive command center providing at-a-glance view of company operations.

#### Features

- **KPI Cards**: Revenue, MRR, Partner pipeline, BNRY balance, ESOP pool
- **Urgent Items**: Expiring visas, pending expenses, draft journals
- **Company Wall**: Social feed for announcements and celebrations
- **Company News**: Official company news and updates
- **Company Dates**: Calendar of important dates (holidays, events)
- **In-app deep links**: Company Wall posts, Company News, and Company Dates each carry an optional `linkUrl` field (`comms.prisma` — `WallPost`, `CompanyNews`, `CompanyDate`). Auto-posted survey announcements point this at the survey respond page (`/survey-forms/:id/respond`); ordinary items leave it null.
- **Notification bell**: A header bell renders grouped pending items from the dashboard stats payload, including a **"Surveys to complete"** group — published, targeted, in-window survey forms the current user has not yet answered (`notification-bell.tsx`, backed by `stats.openSurveys`). See Survey Forms below.
- **Quick ARIA Prompt**: Inline AI assistant access
- **Quick Actions**: Add wall post, news, dates via modals

#### UI Screens

| Screen          | Description                     |
| --------------- | ------------------------------- |
| Dashboard       | Main home page with all widgets |
| Wall Post Modal | Create new wall post            |
| News Modal      | Create company news             |
| Date Modal      | Add company date                |

#### Permissions

| Code          | Description          |
| ------------- | -------------------- |
| `home:read`   | View dashboard       |
| `wall:create` | Create wall posts    |
| `wall:delete` | Delete any wall post |
| `news:create` | Create company news  |
| `news:delete` | Delete company news  |

---

### 2. Dashboard (Aggregate Stats)

**Purpose**: Central API endpoint providing aggregate statistics across all modules.

#### Features

- **Aggregate KPIs**: Total employees, partners, deals, revenue, expenses
- **Cross-module Summary**: Single endpoint for dashboard widgets
- **Per-user notification feed**: The payload also carries `openSurveys` — the published, targeted, in-window survey forms the caller has not answered yet (computed by `dashboardRepository.getOpenSurveyFormsForUser`, anonymous forms excluded). The notification bell renders these as the "Surveys to complete" group, each linking to `/survey-forms/:id/respond`.

#### API Endpoints

| Method | Endpoint              | Description              |
| ------ | --------------------- | ------------------------ |
| GET    | `/api/dashboard/stats`| Get aggregate statistics |

#### Permissions

Gated on `home:read` (`requirePermission(PERMISSIONS.HOME_READ)`).

---

### 3. ARIA (AI Assistant)

**Purpose**: AI-powered assistant for querying company data and performing tasks.

#### Features

- **Chat Interface**: Conversational AI powered by Anthropic Claude (`claude-sonnet-4-20250514`)
- **Context Awareness**: Access to company data for informed responses
- **Receipt Parsing**: Extract data from receipt images
- **Invoice Parsing**: Extract data from invoice PDFs
- **Multi-turn Conversations**: Maintains conversation history

#### Data Models

```prisma
model AriaConversation {
  id        String   @id @default(uuid())
  userId    String
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User          @relation(fields: [userId], references: [id])
  messages AriaMessage[]
}

model AriaMessage {
  id             String   @id @default(uuid())
  conversationId String
  role           String   // 'user' | 'assistant'
  content        String
  metadata       Json?    // parsed data, attachments
  createdAt      DateTime @default(now())

  conversation AriaConversation @relation(fields: [conversationId], references: [id])
}
```

#### API Endpoints

| Method | Endpoint                          | Description                   |
| ------ | --------------------------------- | ----------------------------- |
| GET    | `/api/aria/conversations`         | List user's conversations     |
| POST   | `/api/aria/conversations`         | Create new conversation       |
| GET    | `/api/aria/conversations/:id`     | Get conversation with messages|
| DELETE | `/api/aria/conversations/:id`     | Delete conversation           |
| POST   | `/api/aria/chat`                  | Send message, get AI response |

#### Permissions

| Code         | Description                   |
| ------------ | ----------------------------- |
| `aria:use`   | Access ARIA assistant         |
| `aria:parse` | Use document parsing features |

---

### 4. Messaging

**Purpose**: Internal team communication via channels and direct messages.

#### Features

- **Channels**: Topic-based group conversations
- **Direct Messages**: Private 1:1 conversations
- **Message Features**: Pin, reactions, delete
- **Polling Updates**: Client-side polling (5s interval) for near-real-time messaging. WebSocket support is planned as a future enhancement.
- **Channel Management**: Create, edit, delete, manage members

#### Data Models

```prisma
model Channel {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  isPrivate   Boolean  @default(false)
  members     Json     // array of user IDs
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator  User      @relation(fields: [createdBy], references: [id])
  messages Message[]
}

model Message {
  id        String   @id @default(uuid())
  channelId String
  authorId  String
  content   String
  isPinned  Boolean  @default(false)
  reactions Json?    // { emoji: [userIds] }
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  channel Channel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  author  User    @relation(fields: [authorId], references: [id])
}
```

#### API Endpoints

| Method | Endpoint                                        | Description                      |
| ------ | ----------------------------------------------- | -------------------------------- |
| GET    | `/api/messages/channels`                        | List accessible channels         |
| POST   | `/api/messages/channels`                        | Create new channel               |
| GET    | `/api/messages/channels/:id`                    | Get channel details              |
| PUT    | `/api/messages/channels/:id`                    | Update channel                   |
| DELETE | `/api/messages/channels/:id`                    | Delete channel                   |
| GET    | `/api/messages/channels/:id/messages`           | Get channel messages (paginated) |
| POST   | `/api/messages/channels/:id/messages`           | Send message                     |
| DELETE | `/api/messages/channels/:cId/messages/:mId`     | Delete message                   |

#### UI Screens

| Screen           | Description                         |
| ---------------- | ----------------------------------- |
| Messaging        | Split view: channel list + messages |
| Channel Settings | Manage channel details and members  |

#### Permissions

| Code              | Description                         |
| ----------------- | ----------------------------------- |
| `messages:read`   | View channels and messages          |
| `messages:create` | Send messages                       |
| `messages:delete` | Delete own messages                 |
| `messages:admin`  | Manage channels, delete any message |

---

### 5. Projects

**Purpose**: Project and task management for team collaboration.

#### Features

- **Project List**: View all projects with status, progress
- **Project Details**: Description, owner, partner link, dates
- **Task Management**: Create, assign, track tasks
- **Kanban View**: Drag-and-drop task board
- **Progress Tracking**: Automatic progress calculation
- **Task assignee pickers (two distinct scopes)**:
  - **Assignee / owner** (single, `ProjectTask.ownerId`) — the picker lists **all workspace users**, not just project members. The board page fetches the pool from `GET /api/directory/assignable` (open to callers without `directory:read`) and merges it with the project's members; the owner can therefore be anyone with a User record.
  - **"+ Add assignee"** (multi, the `ProjectTaskAssignee` join) — still **limited to project members**. The picker is built from `members` only; to assign someone they must first be added via "Manage Members".

#### Data Models

```prisma
model Project {
  id          String    @id @default(cuid())
  name        String
  description String?
  status      String    @default("planning") // planning, active, on_hold, completed
  ownerId     String
  partnerId   String?
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  owner   User          @relation(fields: [ownerId], references: [id])
  partner Partner?      @relation(fields: [partnerId], references: [id])
  tasks   ProjectTask[]
}

model ProjectTask {
  id          String    @id @default(uuid())
  projectId   String
  title       String
  description String?
  status      String    @default("todo") // todo, in_progress, review, done
  priority    String    @default("medium") // low, medium, high, urgent
  ownerId     String?
  dueDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  owner   User?   @relation(fields: [ownerId], references: [id])
}
```

#### API Endpoints

| Method | Endpoint                  | Description                  |
| ------ | ------------------------- | ---------------------------- |
| GET    | `/api/projects`           | List projects (with filters) |
| POST   | `/api/projects`           | Create project               |
| GET    | `/api/projects/:id`       | Get project details          |
| PUT    | `/api/projects/:id`       | Update project               |
| DELETE | `/api/projects/:id`       | Delete project               |
| GET    | `/api/projects/:id/tasks` | Get project tasks            |
| POST   | `/api/projects/:id/tasks` | Create task                  |
| PUT    | `/api/projects/tasks/:id` | Update task                  |
| DELETE | `/api/projects/tasks/:id` | Delete task                  |

#### UI Screens

| Screen         | Description                |
| -------------- | -------------------------- |
| Project List   | Table/grid of all projects |
| Project Detail | Project info + task board  |
| Project Form   | Create/edit project modal  |
| Task Form      | Create/edit task modal     |

#### Permissions

| Code                    | Description                 |
| ----------------------- | --------------------------- |
| `projects:read`         | View projects               |
| `projects:create`       | Create projects             |
| `projects:update`       | Update projects             |
| `projects:delete`       | Delete projects             |
| `projects:manage-tasks` | Manage tasks in any project |

---

## Revenue Modules

### 6. Partner CRM

**Purpose**: Manage telecom and commercial partner relationships.

#### Features

- **Partner Pipeline**: Track partners by stage
- **Partner Profiles**: Company info, contacts, history
- **Deal Tracking**: Revenue, contract details
- **Activity Log**: Interactions and notes
- **Segmentation**: By type (Telco, Commercial), region

#### Data Models

```prisma
model Partner {
  id           String    @id @default(cuid())
  company      String
  type         String    // telco, commercial, strategic
  status       String    @default("prospect") // prospect, engaged, pilot, live, churned
  region       String?
  country      String?
  website      String?
  description  String?
  contractValue Decimal?
  contractStart DateTime?
  contractEnd   DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  contacts PartnerContact[]
  projects Project[]
  deals    Deal[]
}

model PartnerContact {
  id        String  @id @default(uuid())
  partnerId String
  name      String
  title     String?
  email     String?
  phone     String?
  isPrimary Boolean @default(false)

  partner Partner @relation(fields: [partnerId], references: [id], onDelete: Cascade)
}
```

#### API Endpoints

| Method | Endpoint                                | Description                  |
| ------ | --------------------------------------- | ---------------------------- |
| GET    | `/api/partners`                         | List partners (with filters) |
| POST   | `/api/partners`                         | Create partner               |
| GET    | `/api/partners/:id`                     | Get partner details          |
| PUT    | `/api/partners/:id`                     | Update partner               |
| DELETE | `/api/partners/:id`                     | Delete partner               |
| GET    | `/api/partners/:id/contacts`            | List contacts                |
| POST   | `/api/partners/:id/contacts`            | Add contact                  |
| PUT    | `/api/partners/:id/contacts/:contactId` | Update contact               |
| DELETE | `/api/partners/:id/contacts/:contactId` | Delete contact               |

#### Permissions

| Code              | Description     |
| ----------------- | --------------- |
| `partners:read`   | View partners   |
| `partners:create` | Create partners |
| `partners:update` | Update partners |
| `partners:delete` | Delete partners |

---

### 7. Sales CRM (Deals)

**Purpose**: Track sales opportunities and deal pipeline.

#### Features

- **Deal Pipeline**: Kanban view by stage with pipeline summary
- **Deal Management**: Value, probability, close date
- **Company/Contact Linking**: Associate with partners
- **Activity Tracking**: Notes, calls, meetings
- **Forecasting**: Weighted pipeline value

#### Data Models

```prisma
model Deal {
  id          String    @id @default(cuid())
  company     String
  contact     String?
  value       Decimal
  stage       String    @default("lead") // lead, qualified, proposal, negotiation, closed_won, closed_lost
  probability Int       @default(10)
  closeDate   DateTime?
  type        String?   // enterprise, smb, startup
  country     String?
  notes       String?
  partnerId   String?
  ownerId     String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  partner Partner? @relation(fields: [partnerId], references: [id])
  owner   User     @relation(fields: [ownerId], references: [id])
}
```

#### API Endpoints

| Method | Endpoint              | Description               |
| ------ | --------------------- | ------------------------- |
| GET    | `/api/deals`          | List deals (with filters) |
| GET    | `/api/deals/pipeline` | Get pipeline summary      |
| POST   | `/api/deals`          | Create deal               |
| GET    | `/api/deals/:id`      | Get deal details          |
| PUT    | `/api/deals/:id`      | Update deal               |
| DELETE | `/api/deals/:id`      | Delete deal               |

#### Permissions

| Code           | Description  |
| -------------- | ------------ |
| `deals:read`   | View deals   |
| `deals:create` | Create deals |
| `deals:update` | Update deals |
| `deals:delete` | Delete deals |

---

## People Modules

### 8. Leave Management

**Purpose**: Employee leave requests and approval workflow.

#### Features

- **Leave Types**: Annual, sick, personal, unpaid, maternity/paternity
- **Leave Balance**: Track entitlements and usage
- **Request Workflow**: Submit, approve, reject
- **Calendar View**: Team leave calendar
- **HR Dashboard**: Overview of all requests

#### Data Models

```prisma
model LeaveType {
  id             String  @id @default(cuid())
  name           String  @unique
  daysPerYear    Int     @default(0)
  requiresApproval Boolean @default(true)
  isPaid         Boolean @default(true)

  balances LeaveBalance[]
  requests LeaveRequest[]
}

model LeaveBalance {
  id          String @id @default(uuid())
  employeeId  String
  leaveTypeId String
  year        Int
  entitled    Int    @default(0)
  used        Int    @default(0)
  carried     Int    @default(0)

  employee  User      @relation(fields: [employeeId], references: [id])
  leaveType LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@unique([employeeId, leaveTypeId, year])
}

model LeaveRequest {
  id          String    @id @default(uuid())
  employeeId  String
  leaveTypeId String
  startDate   DateTime
  endDate     DateTime
  days        Decimal
  reason      String?
  status      String    @default("pending") // pending, approved, rejected, cancelled
  approvedBy  String?
  approvedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  employee  User      @relation("LeaveRequestEmployee", fields: [employeeId], references: [id])
  leaveType LeaveType @relation(fields: [leaveTypeId], references: [id])
  approver  User?     @relation("LeaveRequestApprover", fields: [approvedBy], references: [id])
}
```

#### API Endpoints

| Method | Endpoint                          | Description                              |
| ------ | --------------------------------- | ---------------------------------------- |
| GET    | `/api/leave/types`                | List leave types                         |
| GET    | `/api/leave/balances`             | Get leave balances (self or by employee) |
| GET    | `/api/leave/requests`             | List leave requests (with filters)       |
| POST   | `/api/leave/requests`             | Submit leave request                     |
| GET    | `/api/leave/requests/:id`         | Get request details                      |
| PUT    | `/api/leave/requests/:id/approve` | Approve request                          |
| PUT    | `/api/leave/requests/:id/reject`  | Reject request (with reason)             |
| PUT    | `/api/leave/requests/:id/cancel`  | Cancel own request                       |

#### UI Screens

| Screen         | Description                         |
| -------------- | ----------------------------------- |
| My Leave       | Personal leave balance and requests |
| Leave Requests | HR view of all requests             |
| Leave Calendar | Calendar view of team leave         |
| Request Form   | Submit leave request modal          |

#### Permissions

| Code            | Description             |
| --------------- | ----------------------- |
| `leave:read`    | View own leave          |
| `leave:create`  | Submit leave requests   |
| `leave:hr-read` | View all leave requests |
| `leave:approve` | Approve/reject requests |

---

### 9. Payroll

**Purpose**: Multi-country payroll processing and management.

#### Features

- **Payroll Runs**: Monthly processing by entity
- **Payslip Generation**: Automated calculations
- **Multi-country Support**: Thailand, UAE, Singapore, Portugal
- **Tax Calculations**: Country-specific deductions
- **Consultant Invoices**: Withholding tax management
- **Approval Workflow**: Review and approve runs

#### Data Models

```prisma
model PayrollRun {
  id          String    @id @default(cuid())
  entityId    String
  period      String    // YYYY-MM
  status      String    @default("draft") // draft, processing, approved, paid
  totalGross  Decimal   @default(0)
  totalNet    Decimal   @default(0)
  runBy       String
  approvedBy  String?
  approvedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  entity   Entity    @relation(fields: [entityId], references: [id])
  runner   User      @relation("PayrollRunner", fields: [runBy], references: [id])
  approver User?     @relation("PayrollApprover", fields: [approvedBy], references: [id])
  payslips Payslip[]
}

model Payslip {
  id             String   @id @default(uuid())
  payrollRunId   String
  employeeId     String
  baseSalary     Decimal
  allowances     Json?    // { housing: 0, transport: 0, ... }
  deductions     Json?    // { tax: 0, social: 0, ... }
  grossPay       Decimal
  netPay         Decimal
  currency       String

  payrollRun PayrollRun @relation(fields: [payrollRunId], references: [id])
  employee   User       @relation(fields: [employeeId], references: [id])
}

model ConsultantInvoice {
  id           String    @id @default(uuid())
  entityId     String
  consultantId String
  invoiceNo    String
  amount       Decimal
  whtRate      Decimal   @default(0)
  whtAmount    Decimal   @default(0)
  netAmount    Decimal
  period       String
  status       String    @default("pending") // pending, approved, paid
  certIssued   Boolean   @default(false)
  createdAt    DateTime  @default(now())

  entity     Entity @relation(fields: [entityId], references: [id])
  consultant User   @relation(fields: [consultantId], references: [id])
}
```

#### API Endpoints

| Method | Endpoint                            | Description               |
| ------ | ----------------------------------- | ------------------------- |
| GET    | `/api/payroll/runs`                 | List payroll runs         |
| POST   | `/api/payroll/runs`                 | Create payroll run        |
| GET    | `/api/payroll/runs/:id`             | Get run with payslips     |
| PUT    | `/api/payroll/runs/:id/approve`     | Approve payroll run       |
| GET    | `/api/payroll/consultants`          | List consultant invoices  |
| POST   | `/api/payroll/consultants`          | Create consultant invoice |
| PUT    | `/api/payroll/consultants/:id/cert` | Mark WHT cert issued      |

#### Permissions

| Code               | Description                 |
| ------------------ | --------------------------- |
| `payroll:read`     | View payroll data           |
| `payroll:create`   | Create payroll runs         |
| `payroll:approve`  | Approve payroll runs        |
| `payroll:hr-admin` | Full payroll administration |

---

### 10. HRMS (Human Resource Management System)

**Purpose**: Core HR functions including ESOP management, daily attendance, and employee records.

#### Features

- **ESOP Pool Management**: Track equity pool and allocations
- **ESOP Grants**: Individual grant records with vesting, sheet-aligned KPI cards, and a per-employee breakdown page
- **Attendance**: Daily check-in/out, corrections workflow, missed-attendance + manager cron alerts, shifts/policies/exceptions, calendar + analytics (see the Attendance subsection below)
- **Onboarding Management**: Track new hire onboarding tasks
- **Employee Records**: Comprehensive employee data

#### Data Models

```prisma
model EsopGrant {
  id              String    @id @default(uuid())
  employeeId      String
  grantDate       DateTime  @db.Date
  grantType       String    @default("equity")
  shares          Int       @default(0)
  // Lock / vesting / cliff are nullable so an imported ESOP sheet can be
  // reflected faithfully — a blank cell stays null (rendered "—") instead of
  // being rewritten with old defaults. A grant with vestingMonths null/<=0 has
  // NO vesting schedule (its full shares are treated as already vested).
  vestingMonths   Int?
  cliffMonths     Int?
  lockMonths      Int?
  strikePrice     Decimal   @default(0)
  // Allocation: one-time vs monthly accrual over a window.
  allocationMode       String    @default("one_time")
  monthlyAmount        Decimal?
  allocationStartMonth DateTime? @db.Date
  allocationEndMonth   DateTime? @db.Date
  source          String?
  status          String    @default("active") // active, vested, exercised, cancelled
  exercisedShares Int       @default(0)
  notes           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  employee User @relation(fields: [employeeId], references: [id], onDelete: Cascade)
}

model OnboardingRun {
  id          String    @id @default(uuid())
  employeeId  String?
  employeeName String
  startDate   DateTime
  department  String
  tasks       Json      // array of { name, done, doneAt }
  status      String    @default("in_progress") // in_progress, completed
  entityId    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  employee User?   @relation(fields: [employeeId], references: [id])
  entity   Entity? @relation(fields: [entityId], references: [id])
}
```

#### ESOP KPI cards (sheet-aligned)

The ESOP page's KPI cards are relabeled to match the Equity Summary Report sheet. All four are computed server-side by `rollupGrants()` in `esop-vesting.ts`, where a grant counts as "scheduled" when `vestingMonths > 0`:

| Card                       | Definition                                                               |
| -------------------------- | ------------------------------------------------------------------------ |
| **Grand Total**            | Σ shares across every instrument                                         |
| **Vested**                 | Σ shares of instruments with **no vesting schedule** (full shares vest immediately) |
| **Vesting**                | Σ full shares of **scheduled** instruments                               |
| **Total Vesting to date**  | Σ vested-so-far of the scheduled instruments (time-based, after cliff)   |

#### Per-employee ESOP breakdown

A breakdown page at `/hrms/esop/[employeeId]` shows the same four KPI cards scoped to one employee plus a per-instrument table (instrument, category Vesting/Vested, shares, vesting period, date range, vesting-to-date, % vested). Employee names in the main ESOP grants table link to this page. It is backed by `GET /api/hrms/esop-grants/by-employee/:employeeId`.

#### API Endpoints

| Method | Endpoint                                     | Description                          |
| ------ | -------------------------------------------- | ------------------------------------ |
| GET    | `/api/hrms/esop-pool`                        | Get ESOP pool summary (KPI rollup)   |
| GET    | `/api/hrms/esop-grants`                      | List ESOP grants                     |
| GET    | `/api/hrms/esop-grants/by-employee/:employeeId` | Per-employee KPIs + instruments   |
| POST   | `/api/hrms/esop-grants`                      | Create ESOP grant                    |
| PUT    | `/api/hrms/esop-grants/:id`                  | Update grant                         |
| DELETE | `/api/hrms/esop-grants/:id`                  | Delete grant                         |
| GET    | `/api/hrms/onboarding`                       | List onboarding runs                 |
| POST   | `/api/hrms/onboarding`                       | Create onboarding run                |
| PUT    | `/api/hrms/onboarding/:id/task`              | Update task status                   |

> ESOP discloses sensitive equity data: `/esop-pool` and `/esop-grants/by-employee/:employeeId` require `hrms:esop-manage`. The `/esop-grants` list lets an employee with `hrms:read` see their own grants.

#### Permissions

| Code                     | Description        |
| ------------------------ | ------------------ |
| `hrms:read`              | View HRMS data     |
| `hrms:esop-manage`       | Manage ESOP grants |
| `hrms:onboarding-manage` | Manage onboarding  |

---

### 10a. HRMS — Attendance

**Purpose**: Daily employee attendance (check-in / check-out) with a corrections workflow, missed-attendance + manager cron alerts, shifts, policies, exceptions, calendar views, and analytics. All routes mount under `/api/hrms` across three controllers (Phase 1 core, Phase 2 corrections/policy/shifts/exceptions, Phase 3 calendar/executive/bulk-shift).

#### Features

- **Daily attendance**: Employees check in (with `workMode` office/remote/hybrid) and check out. The service stores UTC timestamps + local wall-clock display strings, computes `totalHours` on check-out, derives `lateMinutes` against the policy shift start + grace, and resolves a status (`present`, `late`, `remote`, `hybrid`, `on_leave`, `absent`, plus virtual `public_holiday` / `weekend` / `on_exception` for non-working days). One record per `(employeeId, attendanceDate)`.
- **Corrections workflow**: An employee submits a correction (`check_in` / `check_out` / `work_mode` / `full_day`) with a reason and proposed values; one open request per employee per date. A manager/HR approver (not the requester) approves — applying the proposed times/mode to the record (creating one if missing) — or rejects with remarks. Email notifications fire to the manager on submit and to the employee on approve/reject.
- **Missed-attendance + manager cron alerts**: Two cron endpoints drive proactive nudges (idempotent via the attendance audit log so each subject is notified once per day):
  - `POST /api/cron/attendance-missed-checks` — for each active employee on a working day, emails a missed-check-in nudge once past `shiftStart + missedCheckInAfterMinutes` (default 120) and a missed-check-out nudge once past `shiftEnd + missedCheckOutAfterMinutes` (default 60); also alerts a manager when a report hits `consecutiveAbsenceAlertDays` (default 3) of absences.
  - `POST /api/cron/attendance-manager-alerts` — daily per-manager digest: team late arrivals, pending corrections, and a high-absenteeism alert. Both require the `X-Cron-Secret` header.
- **Timezone handling**: Attendance is timezone-aware (`attendance-timezone.util.ts`). The employee timezone is resolved from `User.timezone` → policy `defaultTimezone` → company default `Asia/Bangkok`; the "attendance date" is the calendar day in that zone, and shift start/grace are converted local→UTC so lateness is exact across zones (supported zones include Asia/Kolkata, Asia/Colombo, Asia/Bangkok, Asia/Dubai, Asia/Ho_Chi_Minh).
- **Shifts, policies, exceptions**: Entity-scoped (or global) attendance policy (shift window, grace, weekend days, thresholds, alert timings); named shifts with per-employee/bulk assignment over an effective date range; exceptions (business travel, training, field work, etc.) that mark days as non-working.
- **Views & analytics**: Personal history, today/live dashboards, monthly + department reports, a monthly calendar (P/A/L/R/H/E/– codes), manager team dashboard, analytics + executive analytics (top performers, absentees, trends), and CSV/XLSX exports.

#### Data Models

Models live in `hr.prisma`: `AttendancePolicy` (entity-scoped config), `AttendanceRecord` (daily record — UTC + local times, `workMode`, `status`, `totalHours`, `lateMinutes`), `AttendanceCorrection` (correction request + approval), `AttendanceShift` + `AttendanceEmployeeShift` (shifts + assignments), `AttendanceException` (non-working day spans), and `AttendanceAuditLog` (check-in/out, correction, and notification markers).

#### API Endpoints (selected)

| Method | Endpoint                                          | Description                                  |
| ------ | ------------------------------------------------- | -------------------------------------------- |
| POST   | `/api/hrms/attendance/check-in`                   | Record check-in (work mode + remarks)        |
| POST   | `/api/hrms/attendance/check-out`                  | Record check-out (computes total hours)      |
| GET    | `/api/hrms/attendance/today`                      | Today's own record                           |
| GET    | `/api/hrms/attendance/my-attendance`              | Own attendance history (paginated)           |
| GET    | `/api/hrms/attendance/live` · `/dashboard`        | Live monitor · today status summary          |
| GET    | `/api/hrms/attendance/report/monthly` · `/department` | Monthly / department reports             |
| POST   | `/api/hrms/attendance/corrections`                | Submit a correction request                  |
| GET    | `/api/hrms/attendance/corrections`                | List corrections (mine / team / all)         |
| POST   | `/api/hrms/attendance/corrections/:id/approve` · `/reject` | Approve / reject a correction       |
| GET/PUT | `/api/hrms/attendance/policy`                    | Read / update attendance policy              |
| GET/POST/PUT | `/api/hrms/attendance/shifts(/:id)`         | Shift CRUD                                    |
| POST   | `/api/hrms/attendance/shifts/assign`              | Assign a shift to an employee                |
| GET/POST | `/api/hrms/attendance/exceptions`               | List / create attendance exceptions          |
| GET    | `/api/hrms/attendance/calendar`                   | Monthly calendar view (employee/team/dept)   |
| GET    | `/api/hrms/attendance/analytics` · `/executive-analytics` | Analytics · executive analytics      |
| GET    | `/api/hrms/attendance/manager/dashboard`          | Manager team dashboard                       |
| GET    | `/api/hrms/attendance/export/daily` · `/monthly` · `/department` | CSV/XLSX exports               |
| POST   | `/api/hrms/attendance/shift-assignments/bulk`     | Bulk-assign a shift to many employees        |
| POST   | `/api/cron/attendance-missed-checks`              | Cron: missed check-in/out + absence alerts   |
| POST   | `/api/cron/attendance-manager-alerts`             | Cron: daily manager digest                   |

#### Permissions

| Code                                  | Description                                            |
| ------------------------------------- | ------------------------------------------------------ |
| `hrms:read`                           | Check in/out, view + request own corrections           |
| `hrms:attendance-read`                | Read records, reports, dashboards, live monitor        |
| `hrms:attendance-manage`              | Full attendance admin (superset of the codes below)    |
| `hrms:attendance-policy-manage`       | Manage policies, shifts, and shift assignments         |
| `hrms:attendance-correction-approve`  | Approve / reject correction requests                   |
| `hrms:attendance-report-export`       | Export attendance reports                              |

---

### 10b. Survey Forms (`/survey-forms`)

**Purpose**: A lightweight, Google-Forms-style form builder for internal surveys, nominations, and pulse questions — distinct from the xlsx-import "Survey" module (10c). Authors build a form, target an audience, publish it on a schedule, optionally broadcast an announcement, and review responses + analytics.

#### Features

- **Form builder**: A form has a title, description, anonymity flag, and an ordered list of questions. Question types: `info` (display-only section), `short_text`, `long_text`, `single_choice`, `multi_choice`, `rating` (1–5), `date`, `number`. Choice questions carry options; rating carries `{min, max}` settings.
- **Templates**: Two built-in templates ship in the web builder (`survey-form-templates.ts`): **"Go the Extra Mile Award — Nomination"** and **"Kudo Awards — Nomination"** (both non-anonymous nomination forms; nominator fields can be prefilled from the current user).
- **Targeting**: `targetAll` or any combination of `targetEntityIds` / `targetDepartments` / `targetUserIds`. Targeting drives both respondent access and the notification-bell nudge.
- **Schedule + availability gating**: Optional `startDate` / `endDate` (day granularity). A published form is only fillable while today is within the window (inclusive; null = unbounded). `PUT /survey-forms/:id/schedule` sets or extends the window on draft **and** published forms (HR "extend end date"), but not once closed/archived.
- **Publish + "announce on publish"**: `POST /survey-forms/:id/publish` flips status to `published` and, given an optional `announce` block, best-effort broadcasts to up to three surfaces — a **Company Wall** post (`wall:create`), a **Company News** item (`news:create`), and a **Company Dates** entry (`admin:manage`, requires a deadline). Each surface's `linkUrl` is set to `/survey-forms/:id/respond`; a surface failure is logged and never rolls back the publish. The notification-bell "Surveys to complete" group is automatic (a read-model, no flag).
- **Configurable announcement defaults**: Stored as one `SystemSetting` row, key **`survey.announcement_defaults`** (`{ wall, news, companyDate, messageTemplate, newsCategory }`). Read/written via `GET`/`PUT /survey-forms/announcement-settings`; the publish dialog seeds its checkboxes from these (intersected with the caller's permissions).
- **Manual "Announce"**: `POST /survey-forms/:id/announce` re-broadcasts an already-published form on demand (same `announce` block, reuses the publish broadcast path).
- **Archive / unarchive**: `archivedAt` on the form, toggled via `POST /survey-forms/:id/archive` · `/unarchive`. Archive is orthogonal to status; the list page exposes an **Archived** tab (HR) that shows only archived forms.
- **Per-user bell nudge**: The dashboard read-model (`getOpenSurveyFormsForUser`) returns the published, targeted, in-window forms the user has not answered (anonymous forms excluded — per-user completion can't be tracked); the bell renders these as "Surveys to complete".
- **Responses + analytics**: One response per user on non-anonymous forms (`(surveyFormId, respondentId)` unique). `GET /survey-forms/:id/responses` lists responses; `GET /survey-forms/:id/analytics` rolls up choice counts / numeric stats / text samples. CSV export is client-side (`survey-form-export.ts`, OWASP CSV-injection guarded) from the Responses tab.

#### Data Models

In `hr.prisma`: `SurveyForm` (title, description, status `draft|published|closed`, `isAnonymous`, targeting JSON arrays, `publishedAt`, `closedAt`, `startDate`, `endDate`, `archivedAt`, `createdById`), `SurveyFormQuestion` (`order`, `type`, `prompt`, `helperText`, `required`, `options`, `settings`), `SurveyFormResponse` (`respondentId` nullable, `submittedAt`), `SurveyFormAnswer` (`value` JSON — string / number / string[]).

#### API Endpoints

| Method | Endpoint                                  | Description                                          |
| ------ | ----------------------------------------- | ---------------------------------------------------- |
| GET    | `/api/survey-forms`                       | List forms scoped to caller (available/mine/all/archived) |
| POST   | `/api/survey-forms`                       | Create draft form                                    |
| GET/PUT | `/api/survey-forms/announcement-settings` | Read / write announcement defaults                  |
| GET    | `/api/survey-forms/:id`                   | Get form + questions (access gated by status/targeting) |
| PUT    | `/api/survey-forms/:id`                   | Update form metadata (draft only)                    |
| DELETE | `/api/survey-forms/:id`                   | Delete form (draft/closed only)                      |
| PUT    | `/api/survey-forms/:id/questions`         | Replace all questions (draft only)                   |
| POST   | `/api/survey-forms/:id/publish`           | Publish (+ optional announce broadcast)              |
| POST   | `/api/survey-forms/:id/announce`          | Re-broadcast a published form                        |
| PUT    | `/api/survey-forms/:id/schedule`          | Set / extend start & end dates                       |
| POST   | `/api/survey-forms/:id/close`             | Close a published form                               |
| POST   | `/api/survey-forms/:id/archive` · `/unarchive` | Archive / unarchive                            |
| POST   | `/api/survey-forms/:id/responses`         | Submit a response                                    |
| GET    | `/api/survey-forms/:id/my-response`       | Get caller's own response (non-anonymous)            |
| GET    | `/api/survey-forms/:id/responses`         | List responses (creator / manager)                   |
| GET    | `/api/survey-forms/:id/analytics`         | Response analytics rollup                            |

#### Permissions

Authoring/management routes are gated on **`survey:manage-wave`** (shared with the Survey module). List + detail + submit have no static gate — access is resolved in the service (managers + the creator see everything; everyone else sees only published, targeted, in-window forms). The three announcement surfaces are additionally checked at announce time against `wall:create` / `news:create` / `admin:manage` and skipped (not failed) if the caller lacks them.

---

### 10c. Survey (Engagement / xlsx waves) (`/survey`)

**Purpose**: Collect and analyze structured engagement-survey results imported from xlsx. A **Survey Definition** describes the questionnaire (sections + feedback columns); a **Survey Wave** is one run of it, populated by uploading a spreadsheet of responses.

#### Features

- **Create Wave (no definition picker)**: The Create Wave dialog asks only for name, description, dates, and status — it **no longer asks the user to pick a Survey Definition**. The server auto-resolves the active definition (`surveyRepository.findActiveDefinition()` — the most-recently-created `SurveyDefinition` with `isActive: true`); if none exists it returns a clear error.
- **Seeded starter definition**: A starter **"Pulse Engagement Survey"** definition is seeded so the active-definition resolution (and the legacy dropdown) is never empty. The seed is the idempotent migration `20261024000000_seed_survey_definition` (inserts only when the table is empty): 6 sections (Role Clarity, Manager Effectiveness, Team Dynamics, Org Effectiveness, Leadership Trust, Engagement & Retention) + 4 open-feedback columns, 35 questions, `isActive: true`.
- **xlsx import**: Upload → parse (validation + error report) → commit rows into the wave's responses; upload jobs are tracked.
- **Analytics**: Per-wave scores, demographic heatmap, wave-vs-wave compare, department list; CSV exports for raw responses and scores.

#### Data Models

In `hr.prisma`: `SurveyDefinition` (`versionName`, `sectionsSchema`, `demographicsSchema`, `feedbackColumns`, `totalQuestions`, `isActive`), `SurveyWave` (`name`, `description`, `definitionId`, `startDate`, `endDate`, `status`, `responseCount`, `createdBy`), `SurveyResponse` (`waveId`, demographics, `sections` JSON, four feedback text columns), `UploadJob` (parse/commit job with `errorReport`).

#### API Endpoints (selected)

| Method | Endpoint                              | Description                                  |
| ------ | ------------------------------------- | -------------------------------------------- |
| GET    | `/api/survey/definitions`             | List active definitions                      |
| GET    | `/api/survey/waves` · `/waves/all`    | List waves (paged) · all with status filter  |
| POST   | `/api/survey/waves`                   | Create wave (auto-resolves active definition)|
| GET/PUT/DELETE | `/api/survey/waves/:id`       | Get · update · delete a wave                 |
| POST   | `/api/survey/upload/parse` · `/commit` | Parse xlsx · commit parsed rows             |
| GET    | `/api/survey/upload/jobs`             | List upload jobs                             |
| GET    | `/api/survey/analytics(/heatmap` · `/compare` · `/departments)` | Wave analytics       |
| GET    | `/api/survey/export/raw` · `/scores`  | CSV exports                                  |

#### Permissions

Gated on **`survey:manage-wave`** (the same code used by Survey Forms).

---

### 11. Benefits

**Purpose**: Employee benefits catalog and enrollment.

#### Features

- **Benefits Catalog**: Insurance, wellness, perks
- **Eligibility Rules**: By entity, tenure, role
- **Enrollment Tracking**: Who has what benefits, with self-enrollment
- **Unenrollment**: Admin can unenroll employees
- **Cost Tracking**: Company cost per benefit

#### Data Models

```prisma
model Benefit {
  id          String  @id @default(cuid())
  name        String
  category    String  // insurance, wellness, perk, allowance
  description String?
  provider    String?
  cost        Decimal @default(0)
  currency    String  @default("THB")
  entityId    String?
  isActive    Boolean @default(true)

  entity      Entity?            @relation(fields: [entityId], references: [id])
  enrollments BenefitEnrollment[]
}

model BenefitEnrollment {
  id         String    @id @default(uuid())
  benefitId  String
  employeeId String
  startDate  DateTime
  endDate    DateTime?
  status     String    @default("active")

  benefit  Benefit @relation(fields: [benefitId], references: [id])
  employee User    @relation(fields: [employeeId], references: [id])

  @@unique([benefitId, employeeId])
}
```

#### API Endpoints

| Method | Endpoint                             | Description                  |
| ------ | ------------------------------------ | ---------------------------- |
| GET    | `/api/benefits`                      | List benefits (with filters) |
| GET    | `/api/benefits/my-enrollments`       | Get own enrollments          |
| POST   | `/api/benefits`                      | Create benefit               |
| GET    | `/api/benefits/:id`                  | Get benefit details          |
| PUT    | `/api/benefits/:id`                  | Update benefit               |
| DELETE | `/api/benefits/:id`                  | Delete benefit               |
| POST   | `/api/benefits/enroll`               | Enroll employee              |
| PUT    | `/api/benefits/enrollments/:id/unenroll` | Unenroll employee        |

#### Permissions

| Code              | Description             |
| ----------------- | ----------------------- |
| `benefits:read`   | View benefits           |
| `benefits:manage` | Manage benefits catalog |
| `benefits:enroll` | Manage enrollments      |

---

### 12. Onboarding

**Purpose**: Structured onboarding process for new employees.

#### Features

- **Onboarding Templates**: Checklist by department/role
- **Task Tracking**: IT setup, HR docs, training
- **Progress Dashboard**: Overview of all onboarding
- **Notifications**: Reminders for incomplete tasks

_(See HRMS module for data models)_

#### Permissions

| Code                | Description                  |
| ------------------- | ---------------------------- |
| `onboarding:read`   | View onboarding progress     |
| `onboarding:manage` | Create and manage onboarding |

---

### 13. Learning

**Purpose**: Training and development management.

#### Features

- **Training Modules**: Catalog of courses
- **Completion Tracking**: Who completed what
- **Progress Reports**: Learning analytics
- **Mandatory Training**: Compliance courses

#### Data Models

```prisma
model TrainingModule {
  id          String  @id @default(cuid())
  title       String
  description String?
  category    String  // compliance, technical, soft_skills, product
  duration    Int?    // minutes
  url         String? // link to training material
  isMandatory Boolean @default(false)
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())

  completions TrainingCompletion[]
}

model TrainingCompletion {
  employeeId String
  moduleId   String
  completedAt DateTime @default(now())
  score      Int?

  employee User           @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  module   TrainingModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@id([employeeId, moduleId])
}
```

#### API Endpoints

| Method | Endpoint                    | Description           |
| ------ | --------------------------- | --------------------- |
| GET    | `/api/learning/modules`     | List training modules |
| POST   | `/api/learning/modules`     | Create module         |
| PUT    | `/api/learning/modules/:id` | Update module         |
| GET    | `/api/learning/completions` | Get completions       |
| POST   | `/api/learning/completions` | Mark module complete  |

#### Permissions

| Code                | Description             |
| ------------------- | ----------------------- |
| `learning:read`     | View training modules   |
| `learning:complete` | Mark own completions    |
| `learning:manage`   | Manage training catalog |
| `learning:hr-read`  | View all completions    |

---

### 14. Immigration & Visa

**Purpose**: Track employee visa and work permit status.

#### Features

- **Visa Records**: Type, expiry, status
- **Expiry Alerts**: Upcoming expirations
- **Document Storage**: Visa copies, permits
- **Renewal Tracking**: Application status

#### Data Models

```prisma
model VisaRecord {
  id          String    @id @default(uuid())
  employeeId  String
  visaType    String    // B-Visa, Non-B, Work Permit, Residence, etc.
  country     String
  issueDate   DateTime?
  expiryDate  DateTime
  status      String    @default("active") // active, expiring, expired, renewing
  documentUrl String?
  notes       String?
  entityId    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  employee User    @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  entity   Entity? @relation(fields: [entityId], references: [id])
}
```

#### API Endpoints

| Method | Endpoint        | Description       |
| ------ | --------------- | ----------------- |
| GET    | `/api/visa`     | List visa records |
| POST   | `/api/visa`     | Create record     |
| PUT    | `/api/visa/:id` | Update record     |
| DELETE | `/api/visa/:id` | Delete record     |

#### Permissions

| Code           | Description           |
| -------------- | --------------------- |
| `visa:read`    | View own visa info    |
| `visa:hr-read` | View all visa records |
| `visa:manage`  | Create/update records |

---

### 15. Office Management

**Purpose**: Manage office spaces, desks, and meeting rooms.

#### Features

- **Office Directory**: List of office locations
- **Desk Booking**: Hot desk reservation
- **Meeting Rooms**: Room booking system
- **Asset Tracking**: Office equipment

#### Data Models

```prisma
model Office {
  id        String  @id @default(cuid())
  name      String
  address   String?
  city      String
  country   String
  timezone  String?
  capacity  Int     @default(0)
  isActive  Boolean @default(true)

  desks  OfficeDesk[]
  rooms  MeetingRoom[]
  assets Asset[]
}

model OfficeDesk {
  id       String  @id @default(uuid())
  officeId String
  name     String  // Desk A1, etc.
  floor    String?
  isActive Boolean @default(true)

  office   Office        @relation(fields: [officeId], references: [id])
  bookings DeskBooking[]
}

model DeskBooking {
  id         String   @id @default(uuid())
  deskId     String
  employeeId String
  date       DateTime @db.Date
  createdAt  DateTime @default(now())

  desk     OfficeDesk @relation(fields: [deskId], references: [id])
  employee User       @relation(fields: [employeeId], references: [id])

  @@unique([deskId, date])
}

model MeetingRoom {
  id       String  @id @default(uuid())
  officeId String
  name     String
  capacity Int     @default(0)
  amenities String? // projector, whiteboard, video
  isActive Boolean @default(true)

  office   Office        @relation(fields: [officeId], references: [id])
  bookings RoomBooking[]
}

model RoomBooking {
  id         String   @id @default(uuid())
  roomId     String
  employeeId String
  date       DateTime @db.Date
  timeSlot   String   // 09:00-10:00
  title      String?
  createdAt  DateTime @default(now())

  room     MeetingRoom @relation(fields: [roomId], references: [id])
  employee User        @relation(fields: [employeeId], references: [id])

  @@unique([roomId, date, timeSlot])
}

model Asset {
  id          String    @id @default(uuid())
  officeId    String
  name        String
  type        String    // laptop, monitor, chair, etc.
  serialNo    String?
  assignedTo  String?
  purchaseDate DateTime?
  status      String    @default("available")

  office   Office @relation(fields: [officeId], references: [id])
  assignee User?  @relation(fields: [assignedTo], references: [id])
}
```

#### API Endpoints

| Method | Endpoint                         | Description                |
| ------ | -------------------------------- | -------------------------- |
| GET    | `/api/office/offices`            | List offices               |
| GET    | `/api/office/desks`              | List desks (with bookings) |
| POST   | `/api/office/desks/book`         | Book desk                  |
| DELETE | `/api/office/desks/bookings/:id` | Cancel desk booking        |
| GET    | `/api/office/rooms`              | List meeting rooms         |
| POST   | `/api/office/rooms/book`         | Book room                  |
| DELETE | `/api/office/rooms/bookings/:id` | Cancel room booking        |
| GET    | `/api/office/assets`             | List assets (paginated)    |
| POST   | `/api/office/assets`             | Create asset               |
| GET    | `/api/office/assets/:id`         | Get asset details          |
| PUT    | `/api/office/assets/:id`         | Update asset               |
| DELETE | `/api/office/assets/:id`         | Delete asset               |

#### Permissions

| Code            | Description                  |
| --------------- | ---------------------------- |
| `office:read`   | View offices and bookings    |
| `office:book`   | Make bookings                |
| `office:manage` | Manage offices, desks, rooms |

---

### 16. Directory

**Purpose**: Employee directory and organizational structure.

#### Features

- **Employee List**: Searchable directory with filters
- **Profile View**: Contact info, role, department
- **Org Chart**: Hierarchical view
- **Department Filter**: Browse by team
- **Quick Contact**: Email, phone links

#### API Endpoints

| Method | Endpoint                      | Description                          |
| ------ | ----------------------------- | ------------------------------------ |
| GET    | `/api/directory`              | List employees (search, filter)      |
| GET    | `/api/directory/departments`  | List departments                     |
| GET    | `/api/directory/org-chart`    | Get organizational chart             |
| GET    | `/api/directory/:id`          | Get employee profile                 |

#### UI Screens

| Screen           | Description                |
| ---------------- | -------------------------- |
| Directory List   | Table with search/filter   |
| Employee Profile | Detail view                |
| Org Chart        | Hierarchical visualization |

#### Permissions

| Code                       | Description                        |
| -------------------------- | ---------------------------------- |
| `directory:read`           | View directory                     |
| `directory:view-sensitive` | View sensitive info (salary, etc.) |

---

## Fundraising Modules

### 17. Cap Table

**Purpose**: Equity management and cap table tracking.

#### Features

- **Investor List**: All investors with holdings
- **SAFE/Equity Tracking**: Investment instruments
- **Ownership Calculation**: Dilution modeling
- **Round Management**: Track funding rounds

#### Data Models

```prisma
model Investor {
  id           String    @id @default(cuid())
  name         String
  type         String    // angel, vc, strategic, family_office
  contactName  String?
  contactEmail String?
  website      String?
  notes        Json?     // array of { date, text, addedBy }
  visibility   String    @default("team") // team, ceo_only
  addedBy      String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  adder       User         @relation(fields: [addedBy], references: [id])
  investments Investment[]
}

model Investment {
  id          String    @id @default(uuid())
  investorId  String
  type        String    // safe, equity, convertible
  amount      Decimal
  currency    String    @default("USD")
  valuation   Decimal?
  shares      Int?
  date        DateTime
  round       String?   // pre-seed, seed, series-a
  status      String    @default("committed") // committed, received, converted
  notes       String?

  investor Investor @relation(fields: [investorId], references: [id])
}
```

#### API Endpoints

| Method | Endpoint                          | Description                                  |
| ------ | --------------------------------- | -------------------------------------------- |
| GET    | `/api/investors`                  | List investors (search / type / status / sort) |
| POST   | `/api/investors`                  | Create investor                              |
| PUT    | `/api/investors/:id`              | Update investor                              |
| DELETE | `/api/investors/:id`              | Delete investor                              |
| POST   | `/api/investors/import`           | Bulk import from xlsx / csv                  |
| POST   | `/api/investors/reorder`          | Drag-to-reorder (sortOrder)                  |
| GET    | `/api/investors/pipeline-totals`  | Per-stage count + summed est/act (column headers) |
| POST   | `/api/investors/bulk-update`      | Bulk set status / type / owner (ids OR allMatching) |
| POST   | `/api/investors/bulk-delete`      | Bulk delete (ids OR allMatching)             |
| GET    | `/api/investors/dashboard`        | KPI roll-up (legacy; tab removed)            |
| GET/POST/PUT/DELETE | `/api/investor/pipeline-stages` (+ `/reorder`) | Configurable pipeline stages |
| GET/POST/PUT/DELETE | `/api/investor/leads`     | Investor CRM Leads                           |
| GET/POST/PUT/DELETE | `/api/investor/accounts`  | Investor CRM Accounts                        |
| GET/POST/PUT/DELETE | `/api/investor/contacts`  | Investor CRM Contacts                        |
| GET/POST/PUT/DELETE (+ `/:id/complete`) | `/api/investor/tasks` | Investor CRM Tasks               |
| GET/POST/PUT/DELETE | `/api/investor/activities`| Investor CRM Activities                      |
| GET    | `/api/investments`                | List investments                             |
| POST   | `/api/investments`                | Create investment                            |

#### Permissions

| Code                 | Description                      |
| -------------------- | -------------------------------- |
| `investors:read`     | View investors (team visibility) |
| `investors:read-all` | View all including CEO-only      |
| `investors:create`   | Create investors                 |
| `investors:update`   | Update investors                 |
| `investors:delete`   | Delete investors                 |

---

### 18. Investor Dashboard / CRM workspace (`/investors`)

**Purpose**: One Sales-CRM-style workspace for investor relations + fundraising pipeline.

**Tabs** (landing = Pipeline): **Pipeline · Investors · Leads · Accounts · Contacts · Activities · Tasks**. The old standalone "Dashboard" tab was removed — its Total / Est / Act KPIs are superseded by per-column roll-ups on the Pipeline. (`/api/investors/dashboard` still exists for legacy callers, gated `investor-dashboard:read`.)

#### Features

- **Pipeline (kanban)** — investors grouped by fundraising stage.
  - **Configurable stages** (`InvestorPipelineStage`): reorder (dnd-kit grip), rename inline, add, delete (deleting reassigns its investors to the first stage; the last stage can't be deleted). `Investor.status` is an open stage key.
  - **"Investors" intake column** is the leftmost / default stage.
  - Cards drag between columns (native HTML5, optimistic + revert) to change stage.
  - Each column header shows count + **summed Est** + **summed Act** investment, computed server-side across the WHOLE stage via `/api/investors/pipeline-totals` (free-text amounts parsed in JS, scoped like the list).
- **Investors (list)** — dnd-kit table (column reorder/resize, row reorder), search + type/status filters, export/import.
  - **Group by** status / type / region / owner → collapsible (chevron) sections.
  - **Bulk selection + actions** — row checkboxes, header select-all, "select all N matching the filter"; bulk **set status / set type / reassign owner / delete**. Selection is explicit ids OR `allMatching`+filter; owner-scoped unless `investors:read-all`; owner reassignment requires `investors:read-all`.
- **Leads / Accounts / Contacts / Tasks / Activities** — five investor-scoped entities (each its own `/api/investor/<entity>` module). Tasks support complete/reopen; Contacts optionally link to an Account; Activities log call/email/meeting/note.
- **Configurable investor types** (`InvestorTypeOption` + `/api/investor/types`): Family Office, Private Equity, VC, Sovereign Wealth Fund, Corporate Capital, State Capital, Growth, Individual, … seeded from the TBH Pipeline Master sheet. `Investor.type` is an open key; every type picker (filter, form, bulk Set-type, group-by, pipeline card labels) reads the list via a shared `useInvestorTypes` hook + a Manage types dialog (add/rename/delete/reorder).

#### Permissions

All Investor-CRM surfaces (pipeline stages, leads, accounts, contacts, tasks, activities, bulk actions) reuse the core investor permissions — no new codes:

| Code                      | Description                                  |
| ------------------------- | -------------------------------------------- |
| `investors:read`          | View investors + all CRM sub-entities        |
| `investors:read-all`      | See every owner's rows; required for owner reassignment |
| `investors:create`        | Create investors / leads / accounts / contacts / tasks / activities |
| `investors:update`        | Edit + manage pipeline stages + bulk-update  |
| `investors:delete`        | Delete + bulk-delete                         |
| `investor-dashboard:read` | Legacy KPI endpoint                          |

#### Security note

Rich-text render sinks sanitize HTML via `sanitizeRichHtml` (`sanitize-html`) to mitigate the unpatched Quill 2.0.3 HTML-export XSS (GHSA-v3m3-f69x-jf25, Dependabot #40 — no upstream fix).

---

### 19. Cash Advance (`/cash-advance`)

**Purpose**: Employees request a cash advance against future salary; it runs through a configurable, conditional approval chain, then Finance disburses and clears it.

**Lifecycle**: `draft → submitted → approved → disbursed → cleared` (a `rejected` request bounces back to the submitter to edit + resubmit). While in the chain the request stays `submitted` and `currentStepOrder` points at the pending step.

#### Approval chain (mirrors Travel)

- **Config** (`CashAdvanceApprovalStep`, ordered) — each step is `approverType` `manager` (submitter's `reportingTo`) or `user` (a fixed person), with optional **conditions**: amount band (vs `requestedTotal` in the request's own currency), payout-mode filter (cash / bank-transfer), and submitter `skipWhen` / `onlyWhen`. Managed at `/cash-advance/approval` (add/edit/delete/reorder).
- **Per-request snapshot** (`CashAdvanceApprovalDecision`) — on submit, the steps whose conditions match are snapshotted as ordered decision rows (empty chain → single manager step).
- **Walk**: submit emails the first approver; each approval marks the current decision + advances to the next pending step (emailing that approver); the final approval finalises (`status=approved`) and emails the employee + the HR/Finance recipients with payout/bank detail to disburse. Reject acts on the current step + emails the employee.
- **Authz** (`assertCanActOnStep`): the step's manager / assigned user, or anyone with `cash-advance:approve`, may act. The approve/reject routes are open to readers; the service enforces who can actually act.
- **Notification recipients**: admin-managed list in `SystemSetting` key `cash-advance.notification_recipients` (managed on the approval page).

#### API Endpoints

| Method | Endpoint | Permission | Purpose |
| ------ | -------- | ---------- | ------- |
| GET/POST | `/api/cash-advance` | read / create | List · create draft |
| GET/PATCH/DELETE | `/api/cash-advance/:id` | read / create | Get · edit draft · delete |
| POST | `/api/cash-advance/:id/submit` | create | Submit → snapshot chain, email first approver |
| POST | `/api/cash-advance/:id/approve` | read (+ step authz) | Approve current step / advance / finalise |
| POST | `/api/cash-advance/:id/reject` | read (+ step authz) | Reject current step |
| POST | `/api/cash-advance/:id/disburse` · `/clear` | approve | Finance payout + close |
| GET/POST/PUT/DELETE | `/api/cash-advance/approval-steps` (+ `/reorder`) | approve | Chain config |
| GET/PUT | `/api/cash-advance/notification-recipients` | approve | HR/Finance email list |

#### Permissions

| Code | Description |
| ---- | ----------- |
| `cash-advance:read` | View own requests |
| `cash-advance:read-all` | View all requests |
| `cash-advance:create` | Create / edit / submit own |
| `cash-advance:approve` | Act on any step, disburse/clear, manage the chain + recipients |

#### Security note

All caller-supplied fields in the cash-advance emails (names, notes, reject reason, bank details) are `escapeHtml`'d in `templates.ts`.

---

### 20. Data Room

**Purpose**: Secure document sharing for due diligence.

#### Features

- **Document Categories**: Financials, legal, product, team, market
- **Version Control**: Track document versions
- **Category Summary**: Aggregated counts by category
- **Access Logging**: Who viewed what
- **Completeness Check**: Required document checklist

#### Data Models

```prisma
model DataRoomDocument {
  id          String   @id @default(uuid())
  category    String   // financials, legal, product, team, market
  name        String
  description String?
  fileUrl     String
  version     Int      @default(1)
  uploadedBy  String
  uploadedAt  DateTime @default(now())

  uploader User @relation(fields: [uploadedBy], references: [id])
}
```

#### API Endpoints

| Method | Endpoint               | Description                  |
| ------ | ---------------------- | ---------------------------- |
| GET    | `/api/dataroom`        | List documents (with filter) |
| GET    | `/api/dataroom/summary`| Get category summary         |
| POST   | `/api/dataroom`        | Upload document              |
| GET    | `/api/dataroom/:id`    | Get document details         |
| PUT    | `/api/dataroom/:id`    | Update document              |
| DELETE | `/api/dataroom/:id`    | Delete document              |

#### Permissions

| Code              | Description          |
| ----------------- | -------------------- |
| `dataroom:read`   | View data room       |
| `dataroom:upload` | Upload documents     |
| `dataroom:manage` | Manage all documents |

---

### 21. Investor Updates

**Purpose**: Compose and distribute investor newsletters.

#### Features

- **Update Templates**: Structured update format
- **Rich Editor**: Format content
- **Distribution List**: Select recipients
- **Send History**: Track sent updates

#### Data Models

```prisma
model InvestorUpdate {
  id          String    @id @default(uuid())
  title       String
  content     String    // HTML content
  period      String    // Q1 2025, etc.
  status      String    @default("draft") // draft, sent
  sentAt      DateTime?
  sentBy      String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  sender User? @relation(fields: [sentBy], references: [id])
}
```

#### API Endpoints

| Method | Endpoint                       | Description                 |
| ------ | ------------------------------ | --------------------------- |
| GET    | `/api/investor-updates`        | List updates (with filters) |
| POST   | `/api/investor-updates`        | Create update               |
| GET    | `/api/investor-updates/:id`    | Get update details          |
| PUT    | `/api/investor-updates/:id`    | Update draft                |
| DELETE | `/api/investor-updates/:id`    | Delete update               |
| POST   | `/api/investor-updates/:id/send` | Send update to investors  |

#### Permissions

| Code                      | Description         |
| ------------------------- | ------------------- |
| `investor-updates:read`   | View updates        |
| `investor-updates:create` | Create/edit updates |
| `investor-updates:send`   | Send updates        |

---

## Finance Modules

### 22. Revenue Analytics

**Purpose**: Revenue tracking and financial analytics.

#### Features

- **Revenue Dashboard**: MRR, ARR, growth metrics
- **Investment Summary**: Aggregated investment data
- **Expense Summary**: Expense breakdown by period
- **Invoice Summary**: AR/AP invoice overview
- **Trend Analysis**: Historical charts

#### API Endpoints

| Method | Endpoint                  | Description                |
| ------ | ------------------------- | -------------------------- |
| GET    | `/api/revenue/dashboard`  | Get revenue dashboard data |
| GET    | `/api/revenue/investments`| Get investment summary     |
| GET    | `/api/revenue/expenses`   | Get expense summary        |
| GET    | `/api/revenue/invoices`   | Get invoice summary        |

#### Permissions

| Code           | Description            |
| -------------- | ---------------------- |
| `revenue:read` | View revenue analytics |

---

### 23. Accounting

**Purpose**: Multi-entity general ledger and financial management.

#### Features

- **Multi-Entity**: Separate books per legal entity
- **Chart of Accounts**: Configurable COA per entity
- **Journal Entries**: Double-entry bookkeeping
- **Approval Workflow**: Draft → Approved → Posted
- **Invoices**: AR and AP management
- **Bank Reconciliation**: Import and map transactions
- **BNRY Ledger**: Token/crypto tracking
- **Fixed Asset Register**: Thailand statutory PPE ledger — see below

#### Fixed Asset Register

Sub-tab between **Expense** and **Bank Reconciliation**. Ships behind the
fail-closed flag pair `ACCOUNTING_FIXED_ASSETS` (API, runtime) +
`NEXT_PUBLIC_ACCOUNTING_FIXED_ASSETS` (web, build-time). On as of 2026-08-07 on
staging; prod reads the repo variable `vars.ACCOUNTING_FIXED_ASSETS`.

**Phase 1 — register, depreciation, disposal, reports** (shipped)

- Daily straight-line depreciation with a **1.00/unit memo value** (Thai tax
  register convention) and a final-period true-up so closing NBV lands exactly
  on the memo, never a rounding residue.
- **Opening-balance anchor**: an imported asset carries its Book Value as at the
  cut-over date and depreciates forward on the ORIGINAL daily rate, so the
  register does not restate pre-cut-over history.
- **Contra lines**: a credit note is a negative asset. It depreciates negatively
  and releases a credit; its memo value is −1.00/unit.
- **Partial disposal** removes cost, accumulated depreciation and memo pro rata,
  and books the gain or loss.
- Four reports: register, monthly depreciation schedule, disposal, movement
  (PPE note).
- 19-column xlsx import/export. Import is **all-or-nothing** in one transaction,
  and the dialog renders a **column-mapping panel** before commit — the client's
  real report file was never supplied, so header wording is verified by the
  operator rather than assumed.

**Phase 2 — posting and the four remeasurement workstreams** (API complete, no web UI)

| Workstream | State |
|---|---|
| Depreciation + disposal posting | preview + post endpoint; posting gated on `ACCOUNTING_GL_POSTING` |
| Revaluation / impairment (IAS 16 revaluation model) | submit/approve/reject; **no GL posting yet** |
| Transfers (location / custodian / cross-entity) | location + custodian complete; **cross-entity approval refuses** — needs intercompany accounts |
| Physical count | sessions, tag scanning, variance, close. Touches no GL |
| Deferred tax | effective-dated rates + schedule endpoint |

**Invariants that are easy to break and hard to notice**

- Depreciation for a period is the **difference between two point-in-time
  accumulations**, never `rate × days` — the latter disagrees with the register
  at the memo floor, the final-period true-up and the opening anchor.
- Any carrying-amount event (disposal, impairment, transfer) **snapshots the
  asset state before it** onto its own row. Reports rebuild a past date from the
  earliest event dated after it, so history is never restated by a later event.
- The account preflight is **fail-whole**: every in-scope category resolves both
  accounts before any line is written. Skipping an unmapped category would
  understate depreciation behind a successful-looking post.
- Deferred tax **excludes** an asset with no tax basis and reports coverage.
  Falling back to the book life yields a temporary difference of exactly zero —
  a clean, plausible, entirely wrong schedule.
- A physical count never writes off an asset. A shortfall is a recommendation
  routed through the existing disposal approval.

**Open (needs finance, not code)**: whether register additions double-count
against the AP bill; the disposal cash leg and its VAT treatment; a cut-over tax
written-down value per asset; per-entity corporate tax rates including BOI
promotion windows.

#### Data Models

```prisma
model Entity {
  id              String  @id @default(cuid())
  name            String
  code            String  @unique
  country         String
  currency        String
  accountingStd   String  @default("IFRS") // IFRS, GAAP
  taxId           String?
  isActive        Boolean @default(true)

  users           User[]
  accounts        ChartOfAccount[]
  journals        JournalEntry[]
  invoices        Invoice[]
  bankTransactions BankTransaction[]
  payrollRuns     PayrollRun[]
}

model ChartOfAccount {
  id          String  @id @default(cuid())
  entityId    String
  code        String
  name        String
  type        String  // asset, liability, equity, revenue, expense
  parentId    String?
  balance     Decimal @default(0)
  isActive    Boolean @default(true)

  entity Entity           @relation(fields: [entityId], references: [id])
  parent ChartOfAccount?  @relation("AccountHierarchy", fields: [parentId], references: [id])
  children ChartOfAccount[] @relation("AccountHierarchy")
  journalLines JournalEntryLine[]

  @@unique([entityId, code])
}

model JournalEntry {
  id          String    @id @default(cuid())
  entityId    String
  entryNo     String
  date        DateTime  @db.Date
  description String?
  status      String    @default("draft") // draft, approved, posted, rejected
  createdBy   String
  approvedBy  String?
  approvedAt  DateTime?
  postedAt    DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  entity   Entity             @relation(fields: [entityId], references: [id])
  creator  User               @relation("JournalCreator", fields: [createdBy], references: [id])
  approver User?              @relation("JournalApprover", fields: [approvedBy], references: [id])
  lines    JournalEntryLine[]
  invoices Invoice[]
}

model JournalEntryLine {
  id        String  @id @default(uuid())
  entryId   String
  accountId String
  debit     Decimal @default(0)
  credit    Decimal @default(0)
  memo      String?

  entry   JournalEntry   @relation(fields: [entryId], references: [id], onDelete: Cascade)
  account ChartOfAccount @relation(fields: [accountId], references: [id])
}

model Invoice {
  id          String    @id @default(cuid())
  entityId    String
  invoiceNo   String
  type        String    // receivable, payable
  counterparty String
  amount      Decimal
  currency    String
  issueDate   DateTime  @db.Date
  dueDate     DateTime  @db.Date
  status      String    @default("draft") // draft, sent, paid, overdue
  linkedJeId  String?
  createdAt   DateTime  @default(now())

  entity   Entity        @relation(fields: [entityId], references: [id])
  linkedJe JournalEntry? @relation(fields: [linkedJeId], references: [id])
}

model BankTransaction {
  id               String    @id @default(uuid())
  entityId         String
  date             DateTime  @db.Date
  description      String
  amount           Decimal
  balance          Decimal?
  reference        String?
  suggestedAccount String?
  mappedAccount    String?
  status           String    @default("unmatched") // unmatched, matched, ignored
  importedAt       DateTime  @default(now())

  entity Entity @relation(fields: [entityId], references: [id])
}

model BnryTransaction {
  id          String    @id @default(uuid())
  date        DateTime  @db.Date
  type        String    // receipt, revaluation, conversion, impairment
  amount      Decimal
  reference   String?
  description String?
  jeRef       String?
  createdAt   DateTime  @default(now())
}
```

#### API Endpoints

| Method | Endpoint                               | Description            |
| ------ | -------------------------------------- | ---------------------- |
| GET    | `/api/admin/entities`                  | List entities          |
| GET    | `/api/accounting/accounts`             | Get chart of accounts  |
| POST   | `/api/accounting/accounts`             | Create account         |
| GET    | `/api/accounting/accounts/:id`         | Get account details    |
| PUT    | `/api/accounting/accounts/:id`         | Update account         |
| DELETE | `/api/accounting/accounts/:id`         | Delete account         |
| GET    | `/api/accounting/journals`             | List journal entries   |
| POST   | `/api/accounting/journals`             | Create journal entry   |
| GET    | `/api/accounting/journals/:id`         | Get journal with lines |
| PUT    | `/api/accounting/journals/:id`         | Update journal draft   |
| DELETE | `/api/accounting/journals/:id`         | Delete journal         |
| PUT    | `/api/accounting/journals/:id/approve` | Approve journal        |
| PUT    | `/api/accounting/journals/:id/post`    | Post journal           |
| GET    | `/api/accounting/invoices`             | List invoices          |
| POST   | `/api/accounting/invoices`             | Create invoice         |
| GET    | `/api/accounting/invoices/:id`         | Get invoice details    |
| PUT    | `/api/accounting/invoices/:id`         | Update invoice         |
| DELETE | `/api/accounting/invoices/:id`         | Delete invoice         |
| GET    | `/api/accounting/bank`                 | List bank transactions |
| POST   | `/api/accounting/bank/import`          | Import bank statement  |

#### Permissions

| Code                 | Description               |
| -------------------- | ------------------------- |
| `accounting:read`    | View accounting data      |
| `accounting:create`  | Create journals, invoices |
| `accounting:approve` | Approve journals          |
| `accounting:post`    | Post journals             |
| `accounting:admin`   | Full accounting access    |

---

### 24. Expenses

**Purpose**: Employee expense management and reimbursement.

#### Features

- **Expense Submission**: Upload receipts, enter details
- **Category Management**: Expense categories
- **Approval Workflow**: Manager/HR approval
- **Receipt Storage**: GCS file storage
- **AI Parsing**: ARIA receipt parsing

#### Data Models

```prisma
model Expense {
  id          String    @id @default(uuid())
  employeeId  String
  entityId    String
  category    String
  description String
  amount      Decimal
  currency    String
  date        DateTime  @db.Date
  receiptUrl  String?
  status      String    @default("pending") // pending, approved, rejected, reimbursed
  approvedBy  String?
  approvedAt  DateTime?
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  employee User   @relation("ExpenseEmployee", fields: [employeeId], references: [id])
  entity   Entity @relation(fields: [entityId], references: [id])
  approver User?  @relation("ExpenseApprover", fields: [approvedBy], references: [id])
}

model ExpenseCategory {
  id          String  @id @default(cuid())
  name        String  @unique
  description String?
  glAccountId String? // link to chart of accounts
  isActive    Boolean @default(true)
}
```

#### API Endpoints

| Method | Endpoint                    | Description             |
| ------ | --------------------------- | ----------------------- |
| GET    | `/api/expenses`             | List expenses           |
| POST   | `/api/expenses`             | Create expense          |
| GET    | `/api/expenses/:id`         | Get expense details     |
| PUT    | `/api/expenses/:id`         | Update own expense      |
| DELETE | `/api/expenses/:id`         | Delete own expense      |
| PUT    | `/api/expenses/:id/approve` | Approve expense         |
| PUT    | `/api/expenses/:id/reject`  | Reject expense          |
| POST   | `/api/upload/receipt`       | Upload receipt          |

#### Permissions

| Code               | Description             |
| ------------------ | ----------------------- |
| `expenses:read`    | View own expenses       |
| `expenses:create`  | Submit expenses         |
| `expenses:hr-read` | View all expenses       |
| `expenses:approve` | Approve/reject expenses |

---

## Content Modules

### 25. Blog Management

**Purpose**: Internal and external blog content management. Separate from Company News (which is part of the Home Dashboard module for short announcements).

#### Features

- **Blog Posts**: Create, edit, publish blog content
- **Search & Pagination**: Filter blog posts
- **Author Tracking**: Track who created/updated posts

#### API Endpoints

| Method | Endpoint          | Description                |
| ------ | ----------------- | -------------------------- |
| GET    | `/api/blogs`      | List blog posts (paginated)|
| POST   | `/api/blogs`      | Create blog post           |
| GET    | `/api/blogs/:id`  | Get blog post details      |
| PUT    | `/api/blogs/:id`  | Update blog post           |
| DELETE | `/api/blogs/:id`  | Delete blog post           |

#### Permissions

| Code          | Description       |
| ------------- | ----------------- |
| `blog:read`   | View blog posts   |
| `blog:create` | Create blog posts |
| `blog:update` | Edit blog posts   |
| `blog:delete` | Delete blog posts |

---

### 26. PR / Article Management

**Purpose**: Press releases and PR article management. Separate from Company News (short internal announcements) and Blog (longer-form content).

#### Features

- **Article Management**: Create, edit, publish PR articles
- **Search & Pagination**: Filter articles
- **Author Tracking**: Track who created/updated articles

#### API Endpoints

| Method | Endpoint             | Description                  |
| ------ | -------------------- | ---------------------------- |
| GET    | `/api/articles`      | List articles (paginated)    |
| POST   | `/api/articles`      | Create article               |
| GET    | `/api/articles/:id`  | Get article details          |
| PUT    | `/api/articles/:id`  | Update article               |
| DELETE | `/api/articles/:id`  | Delete article               |

#### Permissions

| Code        | Description        |
| ----------- | ------------------ |
| `pr:read`   | View PR articles   |
| `pr:create` | Create PR articles |
| `pr:update` | Edit PR articles   |
| `pr:delete` | Delete PR articles |

> **Note on Content Modules**: Intranet has three separate content systems:
> - **Company News** (`/api/news`) — Short announcements on the Home Dashboard, managed via the Home module.
> - **Blog Management** (`/api/blogs`) — Longer-form blog posts for internal/external publishing.
> - **PR/Article Management** (`/api/articles`) — Press releases and PR content.

---

## Integration Modules

### 27. Gmail Integration

**Purpose**: Access Gmail within Intranet via Anthropic MCP.

#### Features

- **Inbox View**: List recent emails
- **Read Emails**: View email content
- **Compose**: Send emails
- **Search**: Find emails

#### Permissions

| Code        | Description              |
| ----------- | ------------------------ |
| `gmail:use` | Access Gmail integration |

---

### 28. Drive Integration

**Purpose**: Access Google Drive within Intranet via Anthropic MCP.

#### Features

- **File Browser**: List files and folders
- **Search**: Find files
- **Preview**: View file details
- **Link Sharing**: Get shareable links

#### Permissions

| Code        | Description              |
| ----------- | ------------------------ |
| `drive:use` | Access Drive integration |

---

## System Modules

### Authentication

**Purpose**: User login, session management, and password changes.

_(See AUTH_RBAC.md for detailed data models and RBAC flow)_

#### API Endpoints

| Method | Endpoint                    | Description              |
| ------ | --------------------------- | ------------------------ |
| POST   | `/api/auth/login`           | Login with email/password|
| POST   | `/api/auth/logout`          | Logout                   |
| GET    | `/api/auth/me`              | Get current user profile |
| POST   | `/api/auth/change-password` | Change own password      |

---

### 29. Settings

**Purpose**: User and application settings.

#### Features

- **Profile Settings**: Personal info, avatar
- **API Keys**: Anthropic key for ARIA
- **Preferences**: Theme, language, notifications

#### Permissions

| Code              | Description         |
| ----------------- | ------------------- |
| `settings:read`   | View settings       |
| `settings:update` | Update own settings |

---

### 30. Admin

**Purpose**: System administration and monitoring.

#### Features

- **Audit Log**: System activity tracking
- **Storage Stats**: Usage metrics
- **User Management**: Link to user admin
- **Module Owners**: Assign module ownership

#### Data Models

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String
  resource  String
  resourceId String?
  details   Json?
  ipAddress String?
  userAgent String?
  timestamp DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@index([timestamp(sort: Desc)])
  @@index([userId])
}

model ModuleOwner {
  moduleId String @id
  ownerId  String?

  owner User? @relation(fields: [ownerId], references: [id], onDelete: SetNull)
}
```

#### API Endpoints

| Method | Endpoint                             | Description            |
| ------ | ------------------------------------ | ---------------------- |
| GET    | `/api/admin/audit-log`               | Get audit log          |
| GET    | `/api/admin/settings`                | Get app settings       |
| PUT    | `/api/admin/settings`                | Update app settings    |
| GET    | `/api/admin/entities`                | List legal entities    |

#### Permissions

| Code              | Description       |
| ----------------- | ----------------- |
| `admin:read`      | View admin panel  |
| `admin:audit-log` | View audit logs   |
| `admin:manage`    | Full admin access |

---

### 31. Access Control

**Purpose**: RBAC management and user permissions.

#### Features

- **Role Management**: Create, edit, delete roles
- **Permission Assignment**: Assign permissions to roles
- **User Role Assignment**: Assign roles to users
- **Module Access**: Custom module access grants/denials

_(See AUTH_RBAC.md for detailed data models)_

#### API Endpoints

| Method | Endpoint                   | Description                  |
| ------ | -------------------------- | ---------------------------- |
| GET    | `/api/roles/permissions`   | List all permission definitions |
| GET    | `/api/roles`               | List roles                   |
| POST   | `/api/roles`               | Create role                  |
| GET    | `/api/roles/:id`           | Get role details             |
| PUT    | `/api/roles/:id`           | Update role                  |
| DELETE | `/api/roles/:id`           | Delete role                  |

#### Permissions

| Code                  | Description           |
| --------------------- | --------------------- |
| `access-control:read` | View access control   |
| `role:read`           | View roles            |
| `role:create`         | Create roles          |
| `role:update`         | Update roles          |
| `role:delete`         | Delete roles          |
| `user:assign-role`    | Assign roles to users |

---

### 32. IT CRM workspace & Intelligence dashboard (`/it-crm`)

**Purpose**: A standalone IT delivery workspace (its own `it_*` tables, isolated from the shared Projects graph) plus a management **Intelligence dashboard** at `/it-crm/dashboard` — a McKinsey-style, exhibit-driven report on delivery, flow and support health.

**Workspace**: `ItProject` list + per-project Kanban (`ItProjectColumn` / `ItProjectTask` with subtasks, assignees, comments, members). Owner/member access; `it-crm:read-all` (or `projects:read-all`) sees the whole portfolio. Migrated-from-Projects rows read their live board from the general `project_*` tables (lazy mirror — see CLAUDE.md "Native-table / shared-board mirror").

#### Intelligence dashboard (`GET /api/it-crm/dashboard`, read-only)

A single server snapshot drives the whole report (one `Promise.all`, bounded by the slowest query). Sections:

- **KPI bands** — portfolio (Total / In progress / Completed / Production live / At risk) + **flow** (Lead time, Task cycle, Avg days-in-stage, Avg slip, Resolution SLA %, First-fix %).
- **12 numbered Exhibits** — status mix, delivery throughput (6-mo), portfolio-health RAG strip, workload by department + owner, **schedule-slippage register**, **stage aging** (most-stuck active work), upcoming go-lives, risk register (blocked/commented), recently updated, execution (tasks/subtasks + overdue), and **Helpdesk SLA attainment**.
- **Daily catchup** (yesterday done / today in progress / next steps) + **IT Helpdesk service intelligence** (created-vs-resolved 7-day, priority/category mix, avg resolution, open-ticket spotlight).
- **Export** — self-contained HTML report (serif report styling) mirroring the on-screen exhibits.

#### Intelligence fields (auto-stamped, transition-triggered)

Added by migration `20261006000000_it_crm_intelligence_fields` (see DATABASE_SCHEMA):

- `ItProject.statusChangedAt` / `ItProjectTask.statusChangedAt` — set only on a real status change (not any edit), so stage-aging / cycle-time are exact rather than approximated from `updatedAt`.
- `ItProjectTask.completedAt` — set entering the terminal `done` column, cleared if it moves back out (so a reopened task drops out of throughput).
- `ItProject.healthStatus` (RAG: `green`/`yellow`/`red`) + `effortPoints`; `ItProjectTask.effortPoints`.
- `HelpdeskTicket.firstResponseAt` — first IT engagement (status leaves `open` or an assignee is set); `reopenedCount` — incremented when a resolved/closed ticket bounces back to active (resolution stamps cleared).

#### SLA policy

`apps/api/src/modules/helpdesk/helpdesk.sla.ts` — per-priority response + resolution targets (hours). Defaults follow a 4-tier ITSM ladder (urgent 1h/4h … low 24h/168h). These define "within SLA" vs "breached" for the attainment exhibit; tune to committed service levels (the shape is the contract — promotable to editable settings later without touching the maths).

#### API Endpoints

| Method | Endpoint | Permission | Purpose |
| ------ | -------- | ---------- | ------- |
| GET | `/api/it-crm` | read | List projects (paged, search, status/department filter) |
| POST | `/api/it-crm` · `/import` | create | Create · bulk import |
| GET | `/api/it-crm/dashboard` | read | Intelligence snapshot (literal route before `/:id`) |
| PUT | `/api/it-crm/reorder` | update | Reorder projects |
| GET/PUT/DELETE | `/api/it-crm/:id` | read / update / delete | Get · edit · delete |
| GET | `/api/it-crm/:id/board` | read | Kanban (columns + tasks + members) |
| POST/PUT/DELETE | `/api/it-crm/:id/tasks(/:taskId)` | update | Task CRUD (stamps flow timestamps) |
| POST/PUT/DELETE | `/api/it-crm/:id/columns(/:columnId)` | update | Column CRUD |
| GET/PUT | `/api/it-crm/:id/members` | read / update | Membership |

#### Permissions

Reuses the existing `it-crm:*` set with a `projects:*` fallback (admins / read-all holders work without an extra grant). The dashboard is gated on the read bundle (`it-crm:read` / `it-crm:read-all` / `projects:read` / `projects:read-all`) — no new permission codes.

#### Security note

Task titles + comments in IT CRM notification emails are `escapeHtml`'d (`it-crm.service.ts`). Dashboard is read-only.

---

### 33. Marketing Analytics (`/marketing-analytics`)

**Purpose**: Engagement analytics for the OneWave telco estate, sourced from the external BNII Analytics API.

**Permissions**: `marketing:dashboard:view`, `marketing:raw:view`, `marketing:reports:view`, `marketing:campaign:{view,create,update,delete}`. Org-wide config writes (host baselines, overview narrative, drift recipients) gate on `admin:manage`.

#### Surfaces

- **Overview** — holistic engagement view with an admin-editable narrative.
- **DAU / MAU** — the source workbook reimplemented as pure functions (Dashboard, DAU Explorer, 3-Day Trends, Forecast, Weekly Growth, Charts, Campaign Index, Daily Recap).
- **Traffic Dashboard** — per-metric time series with range presets plus a custom range, and per-partner drill-down.
- **Partner Workspaces** — per-partner Raw Data (31 fields) and Metrics (166 catalog metrics evaluated by a ported formula DSL).
- **Raw Data / Reports / Campaigns / Settings** — field explorer, exports, campaign CRM, host-baseline config.

#### Two readers, one upstream

`/marketing-analytics/dau-mau` queries BNII live per request and persists nothing; the OneWave dashboard and Partner Workspaces read `ow_daily_metrics`, written by the `ow-snapshot-refresh` cron. The same day can therefore read differently on two pages. `POST /api/cron/marketing-drift-check` (daily 09:00 Asia/Bangkok) reconciles them over the trailing 30 settled days and cross-foots each published total against its parts.

#### Rules that are easy to break

- **A blank day is `null`, never `0`** — blanks are ignored by every average, sum and percentage rather than dragging a mean down.
- **"Homepage views" is not sessions** — the exhibit plots `total_views_homepage`, roughly 2× BNII's `sessions_ga`, so it will not tie out to the Telco Reports Data Studio dashboard.
- **"Estate DAU, summed" is user-days**, not a headcount, over the loaded window only.

Full detail: **[MARKETING_ANALYTICS.md](./MARKETING_ANALYTICS.md)**.

---

### 34. Project Approval Workflow & Proposals

**Purpose**: A linear, auditable approval path for project requests, plus a two-tier proposal decision flow. Replaced the earlier AI Project Orchestrator.

**Permissions**: `projects:read`, `projects:manage`, `proposals:{read,create,review,approve}`.

#### Request workflow

Requests move through a coded state machine with a Request Tracking board (stage-column Kanban). Stage reviewers are **admin-configurable** rather than derived from permission holders; a request can be **sent back** to an earlier stage, and escalation is PM-gated. PM is optional at intake — a reviewer claims assignment at review time. Every transition emails the stage's configured reviewers, the submitter and an admin CC list, governed by per-user notification preferences.

#### Configurable approval chains

A generic `approval_chains` / `approval_chain_steps` config pair keyed by a `scope` string, plus an **`approval_chain_decisions` per-record snapshot taken on submit**. The snapshot is the point: editing a chain must never move a record already in flight.

- Scope is an explicit union — only `project_request` and `proposal` use this. The HR/Finance chains (travel, leave, expenses, cash advance) keep their own tables deliberately.
- The chain owns the **approval segment only**. `escalate` / `return` / `reopen` / `complete` stay coded transitions.
- **Authority becomes identity**: being the person the current stage names *is* the authority, so it maps to a `null` permission code; the module super-grant still unsticks a chain whose approver left.
- **Zero stages must never read as approved** — a snapshot of `stages: 0` falls back to the coded default, and deleting the last active stage is refused.

#### Proposals

Two-tier decision flow where a reviewer can ask a question **without stalling the record**: a question writes a row in `proposal_information_requests` and moves nothing, so "waiting on 2 answers" is a filtered relation count rather than a status. Answering gates on `assignedToId === actorId` — identity, not permission, so the module super-grant does not satisfy it. Approvers resolve from `SystemSetting` on every read, so a setting naming somebody who left resolves to nobody rather than a stale name. A declined record is re-raised, not reopened.

---

### 35. Certificates (`/certificates`)

**Purpose**: Admin/HR issue recognition certificates to employees, generated as PDFs and emailed out.

**Permissions**: `certificate:read`, `certificate:manage`.

#### Features

- Certificate templates rendered to PDF and emailed to the recipient.
- **Signature images** — signatories upload PNG/JPG signatures rather than typed names.
- **Revert / restore / permanent delete** for admin and HR, following the platform soft-delete convention below.

---

### 36. Sales Revenue CRM (`/sales-revenue`)

**Purpose**: An independent revenue CRM, separate from the Sales CRM graph, with its own accounts, contacts, leads, opportunities, activities and tasks.

**Permissions**: `sales-revenue:{read,create,delete,export,admin,reassign,team-read,settings-manage}`.

Mounted as a family of routes under `/api/sales-revenue/*` (accounts, contacts, leads, opportunities, activities, tasks, lead-sources, lost-reasons, settings), each with its own configurable list (sources, lost reasons) following the admin-editable-enum pattern.

---

## Cross-cutting: Active / Archived

Every CRM surface (Project, IT, QA, Legal, Accounting, Product, Voucher) presents **Active** and **Archived** tabs over both primary and secondary records. Archiving is distinct from soft delete: an archived record is intentionally set aside and remains listable under its tab, whereas a soft-deleted one is hidden from normal reads entirely (see below).

## Cross-cutting: Table layouts & tab persistence

- **Customizable columns** — users reorder, show and hide columns on module tables, with drag-and-drop for both columns and rows. Admin defaults are stored server-side (`/api/table-layouts`) so a team can be given a sensible starting layout.
- **`?tab=` URL persistence** — the active tab of a module page lives in the query string, so a tabbed view is linkable and survives reload.

---

## Cross-cutting: Soft Delete & Restore

Many records are **soft-deleted** rather than physically removed: the model carries a nullable `deletedAt` column, a `DELETE` stamps it (`deletedAt = now()`), and normal reads exclude stamped rows. The shared helpers live in `apps/api/src/infrastructure/soft-delete.ts` (`excludeDeleted` / `softDeleteUpdate` / `restoreUpdate`, and a `SoftDeleteQuery` with `onlyDeleted()`); each repository applies them in its where/update clauses (this is a convention, not a global Prisma client extension).

Models with `deletedAt` span core (`User`, `Entity`, `Department`), HR (e.g. `LeaveRequest`, `TravelRequest`, `EmployeeAgreement`, `OnboardingRun`, `OffboardingRun`, `VisaRecord`, `SurveyForm`/`SurveyFormQuestion`/`SurveyFormResponse`/`SurveyFormAnswer`, `UploadJob`), finance (`JournalEntry`, `Invoice`, `Expense`/`ExpenseReport`, `Vendor`, `CashAdvanceRequest`, …), and RBAC (`Role`, `UserRole`, `RolePermission`, `ModuleAccess`, `UserGroup`).

**Restore / remove ownership rule (owner-or-HR)**: restore (clear `deletedAt`) and permanent delete (hard `prisma.delete`) are guarded so only the record **owner** or an **HR / read-all** holder can act. Each module enforces this in its service against its own HR permission — e.g. Travel uses `travel:hr-read` and Leave uses `leave:hr-read`: `if (!isHr && record.employeeId !== userId) throw ForbiddenException(...)`. The canonical endpoint shape (Travel / Leave) is:

| Method | Endpoint (per module)         | Effect                                  |
| ------ | ----------------------------- | --------------------------------------- |
| DELETE | `/requests/:id`               | Soft delete (stamp `deletedAt`)         |
| POST   | `/requests/:id/restore`       | Restore (owner or HR; 409 if not deleted) |
| DELETE | `/requests/:id/permanent`     | Permanent hard delete (HR-gated)        |

---

## Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                        Core Dependencies                         │
├─────────────────────────────────────────────────────────────────┤
│  Auth & RBAC ──► All Modules                                    │
│  User/Employee ──► Most Modules                                 │
│  Entity ──► Accounting, Payroll, Expenses, Visa                │
│  Partner ──► Projects, Deals                                    │
│  Investor ──► Investments, DataRoom, Updates                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Related Documents

- [Project Overview](./PROJECT_OVERVIEW.md)
- [Marketing Analytics](./MARKETING_ANALYTICS.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Authentication & RBAC](./AUTH_RBAC.md)
- [API Specification](./API_SPECIFICATION.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Task Planning](./TASK_PLANNING.md)
