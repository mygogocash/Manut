# Intranet - Database Schema

> **Partial, and superseded for reference purposes. Measured 2026-08-26.**
>
> This document describes **84** models. The live schema
> (`packages/database/prisma/schema/*.prisma`) has **274** — so about 69% of the
> database is not covered here. Three models it still documents were dropped
> from the schema: `Channel`, `SurveyDefinition`, `SurveyWave`.
>
> For the authoritative current structure use the **generated** pack, which is
> rebuilt from the schema rather than hand-maintained:
>
> | Need | Use |
> |---|---|
> | Every table, column, type, default, FK, index | [`migration/02-data-dictionary.md`](migration/02-data-dictionary.md) |
> | Runnable DDL | [`migration/03-schema.sql`](migration/03-schema.sql) + [`migration/04-schema-addendum.sql`](migration/04-schema-addendum.sql) |
> | Sortable per-table summary | [`migration/05-tables-index.csv`](migration/05-tables-index.csv) |
>
> Keep this file for the *design rationale* — why models are shaped the way they
> are — and stop treating it as an inventory. See [`DOCS_PLAN.md`](DOCS_PLAN.md).

---

## Table of Contents

1. [Overview](#overview)
2. [Schema Organization](#schema-organization)
3. [Core Models](#core-models)
4. [RBAC Models](#rbac-models)
5. [HR Models](#hr-models)
6. [Finance Models](#finance-models)
7. [Operations Models](#operations-models)
8. [Communication Models](#communication-models)
9. [Investor Models](#investor-models)
10. [Content Models](#content-models)
11. [System Models](#system-models)
12. [Relationships Diagram](#relationships-diagram)
13. [Migration Strategy](#migration-strategy)

---

## Overview

### Database Technology

- **Database**: PostgreSQL 15+ (via Supabase)
- **ORM**: Prisma 6.x
- **Extensions**: `uuid-ossp`, `pgcrypto`

### Design Principles

1. **UUID Primary Keys**: Use UUIDs for most tables (compatibility with Supabase Auth)
2. **Soft Deletes**: Critical data uses `isActive` flag instead of hard delete
3. **Audit Trail**: Timestamps on all tables, separate audit log
4. **Multi-tenancy**: Entity-based separation for accounting/HR data
5. **Normalized Design**: Proper foreign keys with cascading rules

---

## Schema Organization

Prisma schemas are split across multiple files in `packages/database/prisma/schema/`:

```
prisma/
├── schema/
│   ├── base.prisma      # Datasource, generator
│   ├── core.prisma      # User, Entity, Session
│   ├── rbac.prisma      # Role, UserRole, RolePermission
│   ├── hr.prisma        # Leave, Payroll, Benefits, etc.
│   ├── finance.prisma   # Accounting, Expenses, etc.
│   ├── operations.prisma # Projects, Partners, Office
│   ├── comms.prisma     # Messaging, Wall, News
│   ├── investors.prisma # Cap Table, Investments
│   ├── content.prisma   # Blogs, Articles
│   └── system.prisma    # AuditLog, Settings
├── migrations/
└── seed.ts
```

---

## Core Models

### base.prisma

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../src/generated/prisma"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### core.prisma

```prisma
// ============================================================================
// ENTITY - Legal entities for multi-company support
// ============================================================================

model Entity {
  id            String   @id @default(cuid())
  name          String
  code          String   @unique // TH, AE, SG, PT
  country       String
  currency      String   // THB, AED, SGD, EUR
  accountingStd String   @default("IFRS") @map("accounting_std")
  taxId         String?  @map("tax_id")
  address       String?
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  users              User[]
  chartOfAccounts    ChartOfAccount[]
  journalEntries     JournalEntry[]
  invoices           Invoice[]
  bankTransactions   BankTransaction[]
  payrollRuns        PayrollRun[]
  consultantInvoices ConsultantInvoice[]
  expenses           Expense[]
  visaRecords        VisaRecord[]
  onboardingRuns     OnboardingRun[]
  benefits           Benefit[]
  leaveRequests      LeaveRequest[]

  @@map("entities")
}

// ============================================================================
// USER - Core user/employee model (linked to Supabase Auth)
// ============================================================================

model User {
  id                 String    @id @db.Uuid // Same as Supabase auth.users.id
  email              String    @unique
  name               String
  avatarUrl          String?   @map("avatar_url")
  phone              String?

  // Employment info
  entityId           String?   @map("entity_id")
  department         String?
  jobTitle           String?   @map("job_title")
  employeeId         String?   @unique @map("employee_id") // Internal ID like EMP001
  reportingTo        String?   @map("reporting_to") @db.Uuid
  employmentType     String    @default("full_time") @map("employment_type") // full_time, part_time, contractor
  startDate          DateTime? @map("start_date")
  endDate            DateTime? @map("end_date")

  // Compensation
  salary             Decimal?  @db.Decimal(15, 2)
  currency           String?

  // Location
  location           String?
  country            String?
  timezone           String?

  // Status
  isActive           Boolean   @default(true) @map("is_active")
  mustChangePassword Boolean   @default(false) @map("must_change_password")

  // Metadata
  metadata           Json?
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  // Relations
  entity        Entity? @relation(fields: [entityId], references: [id])
  manager       User?   @relation("UserManager", fields: [reportingTo], references: [id])
  directReports User[]  @relation("UserManager")

  // RBAC
  userRoles               UserRole[]

  // Created/Owned records
  sessions                Session[]
  channelsCreated         Channel[]
  messagesAuthored        Message[]
  projectsOwned           Project[]
  tasksOwned              ProjectTask[]
  projectMemberships      ProjectMember[]
  dealsOwned              Deal[]
  wallPostsAuthored       WallPost[]
  wallCommentsAuthored    WallComment[]
  newsAuthored            CompanyNews[]
  companyDatesAdded       CompanyDate[]
  investorsAdded          Investor[]
  investorUpdatesCreated  InvestorUpdate[]
  dataRoomDocsUploaded    DataRoomDocument[]

  // HR records
  leaveBalances           LeaveBalance[]
  leaveRequestsSubmitted  LeaveRequest[] @relation("LeaveRequestEmployee")
  leaveRequestsApproved   LeaveRequest[] @relation("LeaveRequestApprover")
  payslips                Payslip[]
  consultantInvoices      ConsultantInvoice[]
  esopGrants              EsopGrant[]
  onboardingRuns          OnboardingRun[]
  trainingCompletions     TrainingCompletion[]
  visaRecords             VisaRecord[]
  benefitEnrollments      BenefitEnrollment[]
  deskBookings            DeskBooking[]
  roomBookings            RoomBooking[]
  assetsAssigned          Asset[]

  // Finance records
  expensesSubmitted       Expense[]      @relation("ExpenseEmployee")
  expensesApproved        Expense[]      @relation("ExpenseApprover")
  journalsCreated         JournalEntry[] @relation("JournalCreator")
  journalsApproved        JournalEntry[] @relation("JournalApprover")
  payrollRunsCreated      PayrollRun[]   @relation("PayrollRunner")
  payrollRunsApproved     PayrollRun[]   @relation("PayrollApprover")

  // System
  auditLogs               AuditLog[]
  moduleOwnerships        ModuleOwner[]
  moduleAccessGrants      ModuleAccess[] @relation("ModuleAccessUser")
  moduleAccessGrantedBy   ModuleAccess[] @relation("ModuleAccessGranter")
  ariaConversations       AriaConversation[]

  // Content
  blogsAuthored           Blog[]
  articlesAuthored        Article[]

  @@index([entityId])
  @@index([email])
  @@index([isActive])
  @@map("users")
}

// ============================================================================
// SESSION - User sessions (managed alongside Supabase)
// ============================================================================

model Session {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  ipAddress String?  @map("ip_address")
  userAgent String?  @map("user_agent")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@map("sessions")
}
```

---

## RBAC Models

### rbac.prisma

```prisma
// ============================================================================
// ROLE - System and custom roles
// ============================================================================

model Role {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String   @unique @db.VarChar(50)
  description String?
  isSystem    Boolean  @default(false) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  rolePermissions RolePermission[]
  userRoles       UserRole[]

  @@map("roles")
}

// ============================================================================
// USER_ROLE - Many-to-many user-role assignment
// ============================================================================

model UserRole {
  userId     String   @map("user_id") @db.Uuid
  roleId     String   @map("role_id") @db.Uuid
  assignedAt DateTime @default(now()) @map("assigned_at")
  assignedBy String?  @map("assigned_by") @db.Uuid

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

// ============================================================================
// ROLE_PERMISSION - Permissions assigned to roles
// ============================================================================

model RolePermission {
  roleId         String @map("role_id") @db.Uuid
  permissionCode String @map("permission_code") @db.VarChar(100)

  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionCode])
  @@map("role_permissions")
}

// ============================================================================
// MODULE_ACCESS - Custom per-user module grants/denials
// ============================================================================

model ModuleAccess {
  userId    String   @map("user_id") @db.Uuid
  moduleId  String   @map("module_id") @db.VarChar(50)
  granted   Boolean  @default(true)
  grantedBy String?  @map("granted_by") @db.Uuid
  grantedAt DateTime @default(now()) @map("granted_at")

  user    User  @relation("ModuleAccessUser", fields: [userId], references: [id], onDelete: Cascade)
  granter User? @relation("ModuleAccessGranter", fields: [grantedBy], references: [id])

  @@id([userId, moduleId])
  @@map("module_access")
}

// ============================================================================
// MODULE_OWNER - Module ownership for escalation
// ============================================================================

model ModuleOwner {
  moduleId String  @id @map("module_id") @db.VarChar(50)
  ownerId  String? @map("owner_id") @db.Uuid

  owner User? @relation(fields: [ownerId], references: [id], onDelete: SetNull)

  @@map("module_owners")
}
```

---

## HR Models

### hr.prisma

```prisma
// ============================================================================
// LEAVE MANAGEMENT
// ============================================================================

model LeaveType {
  id               String  @id @default(cuid())
  name             String  @unique
  code             String  @unique @db.VarChar(20)
  daysPerYear      Int     @default(0) @map("days_per_year")
  requiresApproval Boolean @default(true) @map("requires_approval")
  isPaid           Boolean @default(true) @map("is_paid")
  isActive         Boolean @default(true) @map("is_active")

  balances LeaveBalance[]
  requests LeaveRequest[]

  @@map("leave_types")
}

model LeaveBalance {
  id          String @id @default(uuid()) @db.Uuid
  employeeId  String @map("employee_id") @db.Uuid
  leaveTypeId String @map("leave_type_id")
  year        Int
  entitled    Int    @default(0)
  used        Int    @default(0)
  carried     Int    @default(0)
  adjustment  Int    @default(0)

  employee  User      @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  leaveType LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@unique([employeeId, leaveTypeId, year])
  @@map("leave_balances")
}

model LeaveRequest {
  id           String    @id @default(uuid()) @db.Uuid
  employeeId   String    @map("employee_id") @db.Uuid
  leaveTypeId  String    @map("leave_type_id")
  entityId     String?   @map("entity_id")
  startDate    DateTime  @map("start_date") @db.Date
  endDate      DateTime  @map("end_date") @db.Date
  days         Decimal   @db.Decimal(4, 1)
  reason       String?
  status       String    @default("pending") // pending, approved, rejected, cancelled
  approvedBy   String?   @map("approved_by") @db.Uuid
  approvedAt   DateTime? @map("approved_at")
  rejectReason String?   @map("reject_reason")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  employee  User      @relation("LeaveRequestEmployee", fields: [employeeId], references: [id])
  leaveType LeaveType @relation(fields: [leaveTypeId], references: [id])
  approver  User?     @relation("LeaveRequestApprover", fields: [approvedBy], references: [id])
  entity    Entity?   @relation(fields: [entityId], references: [id])

  @@index([employeeId])
  @@index([status])
  @@map("leave_requests")
}

// ============================================================================
// PAYROLL
// ============================================================================

model PayrollRun {
  id         String    @id @default(cuid())
  entityId   String    @map("entity_id")
  period     String    // YYYY-MM
  status     String    @default("draft") // draft, processing, approved, paid
  totalGross Decimal   @default(0) @map("total_gross") @db.Decimal(15, 2)
  totalNet   Decimal   @default(0) @map("total_net") @db.Decimal(15, 2)
  totalTax   Decimal   @default(0) @map("total_tax") @db.Decimal(15, 2)
  runBy      String    @map("run_by") @db.Uuid
  approvedBy String?   @map("approved_by") @db.Uuid
  approvedAt DateTime? @map("approved_at")
  paidAt     DateTime? @map("paid_at")
  notes      String?
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  entity   Entity    @relation(fields: [entityId], references: [id])
  runner   User      @relation("PayrollRunner", fields: [runBy], references: [id])
  approver User?     @relation("PayrollApprover", fields: [approvedBy], references: [id])
  payslips Payslip[]

  @@unique([entityId, period])
  @@map("payroll_runs")
}

model Payslip {
  id           String  @id @default(uuid()) @db.Uuid
  payrollRunId String  @map("payroll_run_id")
  employeeId   String  @map("employee_id") @db.Uuid
  baseSalary   Decimal @map("base_salary") @db.Decimal(15, 2)
  allowances   Json?   // { housing: 0, transport: 0, ... }
  deductions   Json?   // { tax: 0, social: 0, provident: 0, ... }
  grossPay     Decimal @map("gross_pay") @db.Decimal(15, 2)
  netPay       Decimal @map("net_pay") @db.Decimal(15, 2)
  currency     String

  payrollRun PayrollRun @relation(fields: [payrollRunId], references: [id], onDelete: Cascade)
  employee   User       @relation(fields: [employeeId], references: [id])

  @@unique([payrollRunId, employeeId])
  @@map("payslips")
}

model ConsultantInvoice {
  id           String   @id @default(uuid()) @db.Uuid
  entityId     String   @map("entity_id")
  consultantId String   @map("consultant_id") @db.Uuid
  invoiceNo    String   @map("invoice_no")
  amount       Decimal  @db.Decimal(15, 2)
  whtRate      Decimal  @default(0) @map("wht_rate") @db.Decimal(5, 2)
  whtAmount    Decimal  @default(0) @map("wht_amount") @db.Decimal(15, 2)
  netAmount    Decimal  @map("net_amount") @db.Decimal(15, 2)
  period       String   // YYYY-MM
  status       String   @default("pending") // pending, approved, paid
  certIssued   Boolean  @default(false) @map("cert_issued")
  createdAt    DateTime @default(now()) @map("created_at")

  entity     Entity @relation(fields: [entityId], references: [id])
  consultant User   @relation(fields: [consultantId], references: [id])

  @@map("consultant_invoices")
}

// ============================================================================
// ESOP
// ============================================================================

model EsopGrant {
  id              String   @id @default(uuid()) @db.Uuid
  employeeId      String   @map("employee_id") @db.Uuid
  grantDate       DateTime @map("grant_date") @db.Date
  shares          Int
  vestingMonths   Int      @default(48) @map("vesting_months")
  cliffMonths     Int      @default(12) @map("cliff_months")
  strikePrice     Decimal  @map("strike_price") @db.Decimal(10, 4)
  status          String   @default("active") // active, vested, exercised, cancelled
  exercisedShares Int      @default(0) @map("exercised_shares")
  notes           String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  employee User @relation(fields: [employeeId], references: [id])

  @@map("esop_grants")
}

// ============================================================================
// ONBOARDING
// ============================================================================

model OnboardingRun {
  id           String   @id @default(uuid()) @db.Uuid
  employeeId   String?  @map("employee_id") @db.Uuid
  employeeName String   @map("employee_name")
  department   String
  startDate    DateTime @map("start_date") @db.Date
  tasks        Json     // [{ name: string, done: boolean, doneAt?: string }]
  status       String   @default("in_progress") // in_progress, completed
  entityId     String?  @map("entity_id")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  employee User?   @relation(fields: [employeeId], references: [id])
  entity   Entity? @relation(fields: [entityId], references: [id])

  @@map("onboarding_runs")
}

// ============================================================================
// LEARNING
// ============================================================================

model TrainingModule {
  id          String   @id @default(cuid())
  title       String
  description String?
  category    String   // compliance, technical, soft_skills, product
  duration    Int?     // minutes
  url         String?
  isMandatory Boolean  @default(false) @map("is_mandatory")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")

  completions TrainingCompletion[]

  @@map("training_modules")
}

model TrainingCompletion {
  employeeId  String   @map("employee_id") @db.Uuid
  moduleId    String   @map("module_id")
  completedAt DateTime @default(now()) @map("completed_at")
  score       Int?

  employee User           @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  module   TrainingModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@id([employeeId, moduleId])
  @@map("training_completions")
}

// ============================================================================
// VISA & IMMIGRATION
// ============================================================================

model VisaRecord {
  id          String    @id @default(uuid()) @db.Uuid
  employeeId  String    @map("employee_id") @db.Uuid
  visaType    String    @map("visa_type") // B-Visa, Non-B, Work Permit, Residence
  country     String
  issueDate   DateTime? @map("issue_date") @db.Date
  expiryDate  DateTime  @map("expiry_date") @db.Date
  status      String    @default("active") // active, expiring, expired, renewing
  documentUrl String?   @map("document_url")
  notes       String?
  entityId    String?   @map("entity_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  employee User    @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  entity   Entity? @relation(fields: [entityId], references: [id])

  @@index([employeeId])
  @@index([expiryDate])
  @@map("visa_records")
}

// ============================================================================
// BENEFITS
// ============================================================================

model Benefit {
  id          String  @id @default(cuid())
  name        String
  category    String  // insurance, wellness, perk, allowance
  description String?
  provider    String?
  cost        Decimal @default(0) @db.Decimal(15, 2)
  currency    String  @default("THB")
  entityId    String? @map("entity_id")
  isActive    Boolean @default(true) @map("is_active")

  entity      Entity?             @relation(fields: [entityId], references: [id])
  enrollments BenefitEnrollment[]

  @@map("benefits")
}

model BenefitEnrollment {
  id         String    @id @default(uuid()) @db.Uuid
  benefitId  String    @map("benefit_id")
  employeeId String    @map("employee_id") @db.Uuid
  startDate  DateTime  @map("start_date") @db.Date
  endDate    DateTime? @map("end_date") @db.Date
  status     String    @default("active")

  benefit  Benefit @relation(fields: [benefitId], references: [id])
  employee User    @relation(fields: [employeeId], references: [id])

  @@unique([benefitId, employeeId])
  @@map("benefit_enrollments")
}
```

---

## Finance Models

### finance.prisma

```prisma
// ============================================================================
// CHART OF ACCOUNTS
// ============================================================================

model ChartOfAccount {
  id       String  @id @default(cuid())
  entityId String  @map("entity_id")
  code     String  @db.VarChar(20)
  name     String
  type     String  // asset, liability, equity, revenue, expense
  parentId String? @map("parent_id")
  balance  Decimal @default(0) @db.Decimal(18, 2)
  isActive Boolean @default(true) @map("is_active")

  entity        Entity             @relation(fields: [entityId], references: [id])
  parent        ChartOfAccount?    @relation("AccountHierarchy", fields: [parentId], references: [id])
  children      ChartOfAccount[]   @relation("AccountHierarchy")
  journalLines  JournalEntryLine[]
  bankSuggested BankTransaction[]  @relation("BankSuggested")
  bankMapped    BankTransaction[]  @relation("BankMapped")

  @@unique([entityId, code])
  @@map("chart_of_accounts")
}

// ============================================================================
// JOURNAL ENTRIES
// ============================================================================

model JournalEntry {
  id          String    @id @default(cuid())
  entityId    String    @map("entity_id")
  entryNo     String    @map("entry_no")
  date        DateTime  @db.Date
  description String?
  reference   String?
  status      String    @default("draft") // draft, approved, posted, rejected
  fromExpense String?   @map("from_expense") @db.Uuid
  createdBy   String    @map("created_by") @db.Uuid
  approvedBy  String?   @map("approved_by") @db.Uuid
  approvedAt  DateTime? @map("approved_at")
  postedAt    DateTime? @map("posted_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  entity   Entity             @relation(fields: [entityId], references: [id])
  creator  User               @relation("JournalCreator", fields: [createdBy], references: [id])
  approver User?              @relation("JournalApprover", fields: [approvedBy], references: [id])
  lines    JournalEntryLine[]
  invoices Invoice[]

  @@index([entityId, status])
  @@map("journal_entries")
}

model JournalEntryLine {
  id        String  @id @default(uuid()) @db.Uuid
  entryId   String  @map("entry_id")
  accountId String  @map("account_id")
  debit     Decimal @default(0) @db.Decimal(18, 2)
  credit    Decimal @default(0) @db.Decimal(18, 2)
  memo      String?

  entry   JournalEntry   @relation(fields: [entryId], references: [id], onDelete: Cascade)
  account ChartOfAccount @relation(fields: [accountId], references: [id])

  @@index([entryId])
  @@map("journal_entry_lines")
}

// ============================================================================
// INVOICES
// ============================================================================

model Invoice {
  id           String    @id @default(cuid())
  entityId     String    @map("entity_id")
  invoiceNo    String    @map("invoice_no")
  type         String    // receivable, payable
  counterparty String
  amount       Decimal   @db.Decimal(15, 2)
  currency     String
  issueDate    DateTime  @map("issue_date") @db.Date
  dueDate      DateTime  @map("due_date") @db.Date
  paidDate     DateTime? @map("paid_date") @db.Date
  status       String    @default("draft") // draft, sent, paid, overdue, cancelled
  linkedJeId   String?   @map("linked_je_id")
  notes        String?
  createdAt    DateTime  @default(now()) @map("created_at")

  entity   Entity        @relation(fields: [entityId], references: [id])
  linkedJe JournalEntry? @relation(fields: [linkedJeId], references: [id])

  @@unique([entityId, invoiceNo])
  @@map("invoices")
}

// ============================================================================
// BANK TRANSACTIONS
// ============================================================================

model BankTransaction {
  id               String   @id @default(uuid()) @db.Uuid
  entityId         String   @map("entity_id")
  date             DateTime @db.Date
  description      String
  amount           Decimal  @db.Decimal(15, 2)
  balance          Decimal? @db.Decimal(15, 2)
  reference        String?
  bankAccount      String?  @map("bank_account")
  suggestedAccount String?  @map("suggested_account")
  mappedAccount    String?  @map("mapped_account")
  jeRef            String?  @map("je_ref")
  status           String   @default("unmatched") // unmatched, matched, ignored
  importedAt       DateTime @default(now()) @map("imported_at")

  entity    Entity          @relation(fields: [entityId], references: [id])
  suggested ChartOfAccount? @relation("BankSuggested", fields: [suggestedAccount], references: [id])
  mapped    ChartOfAccount? @relation("BankMapped", fields: [mappedAccount], references: [id])

  @@index([entityId, date])
  @@map("bank_transactions")
}

// ============================================================================
// BNRY TRANSACTIONS (Token/Crypto)
// ============================================================================

model BnryTransaction {
  id          String   @id @default(uuid()) @db.Uuid
  date        DateTime @db.Date
  type        String   // receipt, revaluation, conversion, impairment
  amount      Decimal  @db.Decimal(18, 4)
  reference   String?
  description String?
  jeRef       String?  @map("je_ref") @db.VarChar(30)
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([date])
  @@map("bnry_transactions")
}

// ============================================================================
// EXPENSES
// ============================================================================

model ExpenseCategory {
  id          String  @id @default(cuid())
  name        String  @unique
  description String?
  glAccountId String? @map("gl_account_id")
  isActive    Boolean @default(true) @map("is_active")

  expenses Expense[]

  @@map("expense_categories")
}

model Expense {
  id           String    @id @default(uuid()) @db.Uuid
  employeeId   String    @map("employee_id") @db.Uuid
  entityId     String    @map("entity_id")
  categoryId   String?   @map("category_id")
  description  String
  amount       Decimal   @db.Decimal(15, 2)
  currency     String
  date         DateTime  @db.Date
  receiptUrl   String?   @map("receipt_url")
  status       String    @default("pending") // pending, approved, rejected, reimbursed
  approvedBy   String?   @map("approved_by") @db.Uuid
  approvedAt   DateTime? @map("approved_at")
  rejectReason String?   @map("reject_reason")
  notes        String?
  jeRef        String?   @map("je_ref")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  employee User             @relation("ExpenseEmployee", fields: [employeeId], references: [id])
  entity   Entity           @relation(fields: [entityId], references: [id])
  category ExpenseCategory? @relation(fields: [categoryId], references: [id])
  approver User?            @relation("ExpenseApprover", fields: [approvedBy], references: [id])

  @@index([employeeId])
  @@index([status])
  @@map("expenses")
}
```

---

## Operations Models

### operations.prisma

```prisma
// ============================================================================
// PARTNERS
// ============================================================================

model Partner {
  id            String    @id @default(cuid())
  company       String
  type          String    // telco, commercial, strategic
  status        String    @default("prospect") // prospect, engaged, pilot, live, churned
  region        String?
  country       String?
  website       String?
  description   String?
  contractValue Decimal?  @map("contract_value") @db.Decimal(15, 2)
  contractStart DateTime? @map("contract_start") @db.Date
  contractEnd   DateTime? @map("contract_end") @db.Date
  notes         String?
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  contacts PartnerContact[]
  projects Project[]
  deals    Deal[]

  @@map("partners")
}

model PartnerContact {
  id        String  @id @default(uuid()) @db.Uuid
  partnerId String  @map("partner_id")
  name      String
  title     String?
  email     String?
  phone     String?
  isPrimary Boolean @default(false) @map("is_primary")

  partner Partner @relation(fields: [partnerId], references: [id], onDelete: Cascade)

  @@map("partner_contacts")
}

// ============================================================================
// DEALS (Sales CRM)
// ============================================================================

model Deal {
  id          String    @id @default(cuid())
  company     String
  contact     String?
  value       Decimal   @db.Decimal(15, 2)
  stage       String    @default("lead") // lead, qualified, proposal, negotiation, closed_won, closed_lost
  probability Int       @default(10)
  closeDate   DateTime? @map("close_date") @db.Date
  type        String?   // enterprise, smb, startup
  country     String?
  notes       String?
  partnerId   String?   @map("partner_id")
  ownerId     String    @map("owner_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  partner Partner? @relation(fields: [partnerId], references: [id])
  owner   User     @relation(fields: [ownerId], references: [id])

  @@index([stage])
  @@map("deals")
}

// ============================================================================
// PROJECTS
// ============================================================================

model Project {
  id          String    @id @default(cuid())
  name        String
  description String?
  status      String    @default("planning") // planning, active, on_hold, completed
  ownerId     String    @map("owner_id") @db.Uuid
  partnerId   String?   @map("partner_id")
  startDate   DateTime? @map("start_date") @db.Date
  endDate     DateTime? @map("end_date") @db.Date
  budget      Decimal?  @db.Decimal(15, 2)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  owner   User              @relation(fields: [ownerId], references: [id])
  partner Partner?          @relation(fields: [partnerId], references: [id])
  tasks   ProjectTask[]
  members ProjectMember[]
  columns ProjectColumn[]

  @@map("projects")
}

model ProjectMember {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @map("project_id")
  userId    String   @map("user_id") @db.Uuid
  role      String   @default("member")
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
  @@map("project_members")
}

model ProjectColumn {
  id        String @id @default(uuid()) @db.Uuid
  projectId String @map("project_id")
  key       String
  label     String
  color     String @default("bg-zinc-500")
  sortOrder Int    @default(0) @map("sort_order")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, key])
  @@index([projectId])
  @@map("project_columns")
}

model ProjectTask {
  id          String    @id @default(uuid()) @db.Uuid
  projectId   String    @map("project_id")
  title       String
  description String?
  status      String    @default("todo") // todo, in_progress, review, done
  priority    String    @default("medium") // low, medium, high, urgent
  ownerId     String?   @map("owner_id") @db.Uuid
  dueDate     DateTime? @map("due_date") @db.Date
  sortOrder   Int       @default(0) @map("sort_order")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  owner   User?   @relation(fields: [ownerId], references: [id])

  @@index([projectId])
  @@map("project_tasks")
}

// ============================================================================
// OFFICE MANAGEMENT
// ============================================================================

model Office {
  id       String  @id @default(cuid())
  name     String
  address  String?
  city     String
  country  String
  timezone String?
  capacity Int     @default(0)
  isActive Boolean @default(true) @map("is_active")

  desks  OfficeDesk[]
  rooms  MeetingRoom[]
  assets Asset[]

  @@map("offices")
}

model OfficeDesk {
  id       String  @id @default(uuid()) @db.Uuid
  officeId String  @map("office_id")
  name     String
  floor    String?
  zone     String?
  isActive Boolean @default(true) @map("is_active")

  office   Office        @relation(fields: [officeId], references: [id])
  bookings DeskBooking[]

  @@map("office_desks")
}

model DeskBooking {
  id         String   @id @default(uuid()) @db.Uuid
  deskId     String   @map("desk_id") @db.Uuid
  employeeId String   @map("employee_id") @db.Uuid
  date       DateTime @db.Date
  createdAt  DateTime @default(now()) @map("created_at")

  desk     OfficeDesk @relation(fields: [deskId], references: [id])
  employee User       @relation(fields: [employeeId], references: [id])

  @@unique([deskId, date])
  @@map("desk_bookings")
}

model MeetingRoom {
  id        String  @id @default(uuid()) @db.Uuid
  officeId  String  @map("office_id")
  name      String
  capacity  Int     @default(0)
  amenities String?
  isActive  Boolean @default(true) @map("is_active")

  office   Office        @relation(fields: [officeId], references: [id])
  bookings RoomBooking[]

  @@map("meeting_rooms")
}

model RoomBooking {
  id         String   @id @default(uuid()) @db.Uuid
  roomId     String   @map("room_id") @db.Uuid
  employeeId String   @map("employee_id") @db.Uuid
  date       DateTime @db.Date
  timeSlot   String   @map("time_slot") // 09:00-10:00
  title      String?
  createdAt  DateTime @default(now()) @map("created_at")

  room     MeetingRoom @relation(fields: [roomId], references: [id])
  employee User        @relation(fields: [employeeId], references: [id])

  @@unique([roomId, date, timeSlot])
  @@map("room_bookings")
}

model Asset {
  id           String    @id @default(uuid()) @db.Uuid
  officeId     String    @map("office_id")
  name         String
  type         String    // laptop, monitor, chair, keyboard, etc.
  serialNo     String?   @map("serial_no")
  assignedTo   String?   @map("assigned_to") @db.Uuid
  purchaseDate DateTime? @map("purchase_date") @db.Date
  purchaseCost Decimal?  @map("purchase_cost") @db.Decimal(15, 2)
  status       String    @default("available") // available, assigned, maintenance, retired
  notes        String?

  office   Office @relation(fields: [officeId], references: [id])
  assignee User?  @relation(fields: [assignedTo], references: [id])

  @@map("assets")
}
```

---

## Communication Models

### comms.prisma

```prisma
// ============================================================================
// MESSAGING
// ============================================================================

model Channel {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  isPrivate   Boolean  @default(false) @map("is_private")
  members     Json?    // array of user IDs for private channels
  createdBy   String   @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  creator  User      @relation(fields: [createdBy], references: [id])
  messages Message[]

  @@map("channels")
}

model Message {
  id        String   @id @default(uuid()) @db.Uuid
  channelId String   @map("channel_id")
  authorId  String   @map("author_id") @db.Uuid
  content   String
  isPinned  Boolean  @default(false) @map("is_pinned")
  reactions Json?    // { "👍": ["userId1", "userId2"], ... }
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  channel Channel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  author  User    @relation(fields: [authorId], references: [id])

  @@index([channelId])
  @@index([channelId, createdAt(sort: Desc)])
  @@map("messages")
}

// ============================================================================
// WALL (Social Feed)
// ============================================================================

model WallPost {
  id        String   @id @default(uuid()) @db.Uuid
  authorId  String   @map("author_id") @db.Uuid
  content   String
  type      String   @default("post") // post, announcement, celebration
  likes     Json?    // array of user IDs
  reactions Json?    // { "🎉": ["userId1"], ... }
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  author   User          @relation(fields: [authorId], references: [id])
  comments WallComment[]

  @@index([createdAt(sort: Desc)])
  @@map("wall_posts")
}

model WallComment {
  id        String   @id @default(uuid()) @db.Uuid
  postId    String   @map("post_id") @db.Uuid
  authorId  String   @map("author_id") @db.Uuid
  content   String
  type      String   @default("comment") // comment, wish
  createdAt DateTime @default(now()) @map("created_at")

  post   WallPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  author User     @relation(fields: [authorId], references: [id])

  @@index([postId])
  @@map("wall_comments")
}

// ============================================================================
// NEWS
// ============================================================================

model CompanyNews {
  id        String   @id @default(uuid()) @db.Uuid
  title     String
  content   String
  category  String?  // company, product, team, industry
  authorId  String   @map("author_id") @db.Uuid
  isPinned  Boolean  @default(false) @map("is_pinned")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  author User @relation(fields: [authorId], references: [id])

  @@index([createdAt(sort: Desc)])
  @@map("company_news")
}

// ============================================================================
// COMPANY DATES (Calendar)
// ============================================================================

model CompanyDate {
  id        String   @id @default(uuid()) @db.Uuid
  title     String
  date      DateTime @db.Date
  type      String   // holiday, event, deadline, birthday
  location  String?
  addedBy   String   @map("added_by") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")

  adder User @relation(fields: [addedBy], references: [id])

  @@index([date])
  @@map("company_dates")
}

// ============================================================================
// ARIA (AI Assistant)
// ============================================================================

model AriaConversation {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  title     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user     User          @relation(fields: [userId], references: [id])
  messages AriaMessage[]

  @@index([userId])
  @@map("aria_conversations")
}

model AriaMessage {
  id             String   @id @default(uuid()) @db.Uuid
  conversationId String   @map("conversation_id") @db.Uuid
  role           String   // user, assistant
  content        String
  metadata       Json?    // parsed data, attachments, tokens
  createdAt      DateTime @default(now()) @map("created_at")

  conversation AriaConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("aria_messages")
}
```

---

## Investor Models

### investors.prisma

```prisma
// ============================================================================
// INVESTORS
// ============================================================================

model Investor {
  id           String   @id @default(cuid())
  name         String
  type         String   // angel, vc, corporate, family_office, other
  contactName  String?  @map("contact_name")
  contactEmail String?  @map("contact_email")
  contactPhone String?  @map("contact_phone")
  website      String?
  location     String?
  notes        Json?    // [{ date, text, addedBy }]
  visibility   String   @default("team") // team, private, public
  // Pipeline stage key — references InvestorPipelineStage.key (no FK so
  // stages stay editable). Open string, NOT an enum. Default = leftmost
  // intake stage ("investors").
  status       String   @default("investors")
  // Pipeline-master columns (free text; parsed for est/act roll-ups).
  title          String?  @map("title")
  linkedinUrl    String?  @map("linkedin_url")
  revenueStream  String?  @map("revenue_stream")
  lastContactDate DateTime? @map("last_contact_date") @db.Date
  nextAction     String?  @map("next_action")
  actInvestment  String?  @map("act_investment")
  estInvestment  String?  @map("est_investment")
  crossSell      String?  @map("cross_sell")
  region         String?
  notesText      String?  @map("notes_text")
  sortOrder      Int      @default(0) @map("sort_order")
  addedBy      String   @map("added_by") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  adder       User               @relation(fields: [addedBy], references: [id])
  investments Investment[]
  tasks       InvestorTask[]
  activities  InvestorActivity[]

  @@map("investors")
}

// ============================================================================
// INVESTOR CRM — configurable pipeline + investor-scoped sub-entities
// Tabs: Pipeline · Investors · Leads · Accounts · Contacts · Activities · Tasks
// All gated on the existing investors:* permissions (no new perm codes).
// ============================================================================

// Configurable fundraising pipeline columns. `key` is the stable value
// stored on Investor.status; `label` is the editable display name.
// Reorder / rename / add / delete via the board's Manage stages UI.
model InvestorPipelineStage {
  key       String   @id
  label     String
  color     String   @default("border-t-zinc-500")
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([sortOrder])
  @@map("investor_pipeline_stages")
}

// Raw fundraising prospect (Leads tab) — status: new | qualified |
// converted | disqualified. Owner-scoped like Investor.
model InvestorLead {
  id        String   @id @default(cuid())
  name      String
  company   String?
  email     String?
  phone     String?
  source    String?
  status    String   @default("new")
  notes     String?
  ownerId   String   @map("owner_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  owner User @relation("InvestorLeadOwner", fields: [ownerId], references: [id])

  @@index([ownerId, status])
  @@map("investor_leads")
}

// Investor organisation / fund (Accounts tab).
model InvestorAccount {
  id        String   @id @default(cuid())
  name      String
  type      String?
  website   String?
  location  String?
  region    String?
  notes     String?
  ownerId   String   @map("owner_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  owner    User              @relation("InvestorAccountOwner", fields: [ownerId], references: [id])
  contacts InvestorContact[]

  @@index([ownerId])
  @@map("investor_accounts")
}

// Person, optionally tied to an account (Contacts tab).
model InvestorContact {
  id        String   @id @default(cuid())
  firstName String   @map("first_name")
  lastName  String?  @map("last_name")
  email     String?
  phone     String?
  title     String?
  accountId String?  @map("account_id")
  ownerId   String   @map("owner_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  owner   User             @relation("InvestorContactOwner", fields: [ownerId], references: [id])
  account InvestorAccount? @relation(fields: [accountId], references: [id], onDelete: SetNull)

  @@index([ownerId])
  @@index([accountId])
  @@map("investor_contacts")
}

// Investor-scoped to-do (Tasks tab) — status: open | done | cancelled.
model InvestorTask {
  id          String    @id @default(cuid())
  subject     String
  status      String    @default("open")
  dueDate     DateTime  @map("due_date") @db.Date
  investorId  String    @map("investor_id")
  ownerId     String    @map("owner_id") @db.Uuid
  completedAt DateTime? @map("completed_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  investor Investor @relation(fields: [investorId], references: [id], onDelete: Cascade)
  owner    User     @relation("InvestorTaskOwner", fields: [ownerId], references: [id])

  @@index([investorId])
  @@index([ownerId, status, dueDate])
  @@map("investor_tasks")
}

// Investor-scoped logged interaction (Activities tab) — type: call |
// email | meeting | note.
model InvestorActivity {
  id           String   @id @default(cuid())
  type         String
  subject      String
  body         String?
  occurredAt   DateTime @map("occurred_at")
  durationMins Int?     @map("duration_mins")
  investorId   String   @map("investor_id")
  ownerId      String   @map("owner_id") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")

  investor Investor @relation(fields: [investorId], references: [id], onDelete: Cascade)
  owner    User     @relation("InvestorActivityOwner", fields: [ownerId], references: [id])

  @@index([investorId])
  @@index([occurredAt])
  @@map("investor_activities")
}

// Configurable investor type / category (Family Office, Private Equity,
// VC, SWF, Corporate Capital, State Capital, Growth, Individual, ...).
// `key` is the value stored on Investor.type (no FK — open string).
// Seeded from the TBH Pipeline Master sheet; admins manage via the
// Investors tab "Manage types" UI.
model InvestorTypeOption {
  key       String   @id
  label     String
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([sortOrder])
  @@map("investor_type_options")
}

// ============================================================================
// INVESTMENTS
// ============================================================================

model Investment {
  id         String   @id @default(uuid()) @db.Uuid
  investorId String   @map("investor_id")
  type       String   // safe, equity, convertible_note
  amount     Decimal  @db.Decimal(15, 2)
  currency   String   @default("USD")
  valuation  Decimal? @db.Decimal(15, 2)
  shares     Int?
  date       DateTime @db.Date
  round      String?  // pre-seed, seed, series-a
  status     String   @default("committed") // committed, received, converted
  terms      Json?    // discount, cap, etc.
  notes      String?
  createdAt  DateTime @default(now()) @map("created_at")

  investor Investor @relation(fields: [investorId], references: [id])

  @@map("investments")
}

// ============================================================================
// DATA ROOM
// ============================================================================

model DataRoomDocument {
  id          String   @id @default(uuid()) @db.Uuid
  category    String   // financials, legal, product, team, market
  name        String
  description String?
  fileUrl     String   @map("file_url")
  fileSize    Int?     @map("file_size")
  mimeType    String?  @map("mime_type")
  version     Int      @default(1)
  uploadedBy  String   @map("uploaded_by") @db.Uuid
  uploadedAt  DateTime @default(now()) @map("uploaded_at")

  uploader User @relation(fields: [uploadedBy], references: [id])

  @@map("data_room_documents")
}

// ============================================================================
// INVESTOR UPDATES
// ============================================================================

model InvestorUpdate {
  id        String    @id @default(uuid()) @db.Uuid
  title     String
  content   String    // HTML content
  period    String    // Q1 2025, Monthly Jan 2025, etc.
  status    String    @default("draft") // draft, sent
  sentAt    DateTime? @map("sent_at")
  sentBy    String?   @map("sent_by") @db.Uuid
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  sender User? @relation(fields: [sentBy], references: [id])

  @@map("investor_updates")
}
```

---

## Cash Advance — Approval Chain (finance.prisma)

Cash-advance requests run through a configurable, conditional approval
chain (mirrors the Travel chain). `CashAdvanceRequest` gained
`currentStepOrder Int?` — while in the chain the request stays
`status='submitted'` and this points at the pending step.

```prisma
// Configurable approval-chain step. Steps run in `order`; each carries
// optional conditions — amount band (compared against requestedTotal in
// the request's own currency), submitter skip/only-when, payout-mode
// filter — so a step only fires when its conditions match.
model CashAdvanceApprovalStep {
  id                   String   @id @default(uuid()) @db.Uuid
  order                Int      @unique
  name                 String   @db.VarChar(100)
  description          String?
  approverType         String   @default("manager") @map("approver_type") // manager | user
  approverUserId       String?  @map("approver_user_id") @db.Uuid
  skipWhenSubmitterIds Json     @default("[]") @map("skip_when_submitter_ids")
  onlyWhenSubmitterIds Json     @default("[]") @map("only_when_submitter_ids")
  payoutModeFilter     Json     @default("[]") @map("payout_mode_filter") // [] = any, else cash|bank-transfer
  amountMin            Decimal? @map("amount_min") @db.Decimal(15, 2)
  amountMax            Decimal? @map("amount_max") @db.Decimal(15, 2)
  isActive             Boolean  @default(true) @map("is_active")
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  approverUser User? @relation("CashAdvanceApprovalStepUser", fields: [approverUserId], references: [id], onDelete: SetNull)

  @@map("cash_advance_approval_steps")
}

// Per-request snapshot of a chain step + its decision.
// status: pending | approved | rejected.
model CashAdvanceApprovalDecision {
  id             String    @id @default(uuid()) @db.Uuid
  requestId      String    @map("cash_advance_request_id") @db.Uuid
  order          Int
  name           String    @db.VarChar(100)
  approverType   String    @map("approver_type")
  approverUserId String?   @map("approver_user_id") @db.Uuid
  status         String    @default("pending")
  decidedById    String?   @map("decided_by_id") @db.Uuid
  decidedAt      DateTime? @map("decided_at")
  notes          String?
  createdAt      DateTime  @default(now()) @map("created_at")

  request      CashAdvanceRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  approverUser User?              @relation("CashAdvanceApprovalDecisionApprover", fields: [approverUserId], references: [id], onDelete: SetNull)
  decidedBy    User?              @relation("CashAdvanceApprovalDecisionDecidedBy", fields: [decidedById], references: [id], onDelete: SetNull)

  @@unique([requestId, order])
  @@index([approverUserId, status])
  @@index([requestId])
  @@map("cash_advance_approval_decisions")
}
```

HR/Finance notification recipients (emailed a payout summary on full
approval) are stored in `SystemSetting` under key
`cash-advance.notification_recipients` (JSON array of emails) — the same
mechanism as `travel.notification_recipients`.

---

## IT CRM & Helpdesk — Intelligence Fields (operations.prisma / helpdesk.prisma)

Lifecycle / SLA / health columns added by migration
`20261006000000_it_crm_intelligence_fields` to power the IT CRM Intelligence
dashboard. All are nullable (or default 0) and **auto-stamped on
transitions** by the services — never written directly by the client.

```prisma
// it_projects (additions)
model ItProject {
  // ...existing fields...
  statusChangedAt    DateTime? @map("status_changed_at") // set on a real status change → stage-aging / cycle-time
  healthStatus       String?   @map("health_status")     // RAG rating: green | yellow | red (null = unrated)
  effortPoints       Int?      @map("effort_points")      // relative sizing (points / person-days)
}

// it_project_tasks (additions)
model ItProjectTask {
  // ...existing fields...
  statusChangedAt DateTime? @map("status_changed_at") // last status transition
  completedAt     DateTime? @map("completed_at")       // set entering `done`, cleared if it leaves done
  effortPoints    Int?      @map("effort_points")
}

// helpdesk_tickets (additions)
model HelpdeskTicket {
  // ...existing fields...
  firstResponseAt DateTime? @map("first_response_at") // first IT engagement (leaves `open` or assignee set) → response-SLA
  reopenedCount   Int       @default(0) @map("reopened_count") // resolved/closed → active bounces → first-fix rate
}
```

**Stamping rules** (transition-triggered, not edit-triggered):

- `statusChangedAt` moves only when `status` actually differs from the stored value — an unrelated edit doesn't reset stage-aging.
- Task `completedAt` is set when the task enters the terminal `done` column and cleared when it moves back out, so a reopened task drops out of throughput / cycle-time.
- `HelpdeskTicket.firstResponseAt` stamps once (first IT engagement) and is never moved by later transitions; a reopen increments `reopenedCount` and nulls `resolvedAt` / `closedAt` so the ticket re-enters the open pool cleanly.

**Backfill** (idempotent, guarded on the seed value): `statusChangedAt = updatedAt`; done-task `completedAt = updatedAt`; a starting RAG `healthStatus` (green=terminal, red=slipped/blocked active, yellow=other). No `firstResponseAt` backfill — history is unknowable, so attainment is computed only over tickets carrying a real stamp going forward.

**SLA policy**: per-priority response + resolution targets live in code at
`apps/api/src/modules/helpdesk/helpdesk.sla.ts` (not the DB) — a tunable
operations constant the dashboard measures attainment against.

---

## Soft Delete (core.prisma / rbac.prisma / finance.prisma / hr.prisma)

A subset of high-value models now carry a nullable `deletedAt DateTime?`
(`@map("deleted_at")`) column for **soft delete** — rows are hidden by
setting the timestamp, not removed. This supersedes the original "use the
`isActive` flag" note for these tables (the `isActive` flag, where present,
stays as a separate operational toggle). The shared helpers live in
`apps/api/src/infrastructure/soft-delete.ts`:

- `excludeDeleted("deletedAt")` → `{ deletedAt: null }` — ANDed into every
  list / `findById` query so deleted rows never surface.
- `softDeleteUpdate("deletedAt")` → `{ deletedAt: new Date() }`.
- `restoreUpdate("deletedAt")` / `SoftDeleteQuery.onlyDeleted()` for the
  restore + trash views.

Models with `deletedAt` (per the live schema on `dev`):

| Model               | File              | `@@index([deletedAt])` |
| ------------------- | ----------------- | ---------------------- |
| `User`              | core.prisma       | yes                    |
| `Entity`            | core.prisma       | no                     |
| `Department`        | core.prisma       | no                     |
| `Role`              | rbac.prisma       | no                     |
| `UserGroup`         | rbac.prisma       | no                     |
| `ChartOfAccount`    | finance.prisma    | no                     |
| `JournalEntry`      | finance.prisma    | no                     |
| `Invoice`           | finance.prisma    | no                     |
| `Expense`           | finance.prisma    | yes                    |
| `ExpenseReport`     | finance.prisma    | yes                    |
| `CashAdvanceRequest`| finance.prisma    | yes                    |
| `TravelRequest`     | hr.prisma         | yes                    |
| `LeaveRequest`      | hr.prisma         | yes                    |
| `VisaRecord`        | hr.prisma         | yes                    |

The `@@index([deletedAt])` on the high-churn request tables (expenses,
expense reports, cash advances, travel, leave, visa) plus `users` backs the
`deletedAt IS NULL` predicate that every list query carries.

**`deletedBy`**: there is **no** separate `deletedBy` column on the soft-delete
models above. The only `deletedBy` in the schema is on chat `Message`
(comms.prisma), which is a distinct "delete-for-everyone" feature, not the
`deletedAt` soft-delete pattern:

```prisma
model Message {
  // ...existing fields...
  deletedForEveryoneAt DateTime? @map("deleted_for_everyone_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid

  deleter User? @relation("MessageDeleter", fields: [deletedBy], references: [id])
  // (relation is implicitly SetNull — no onDelete: Cascade — so deleting the
  // deleter user keeps the message but nulls the link)
}
```

Authz for restore / permanent-delete is enforced in the service layer — see
the **owner-or-HR restore rule** in `AUTH_RBAC.md`.

---

## Survey Forms (hr.prisma)

A Google-Forms-style, in-platform survey builder that runs **alongside** the
xlsx-import pulse system (`SurveyDefinition` / `SurveyWave`, below). HR composes
a form with mixed question types, targets a slice of the workforce, publishes
it, and responses + analytics are collected in-app. Four models:

```prisma
model SurveyForm {
  id          String   @id @default(uuid()) @db.Uuid
  title       String   @db.VarChar(200)
  description String?
  status      String   @default("draft") @db.VarChar(20) // draft | published | closed
  isAnonymous Boolean  @default(false) @map("is_anonymous")
  // Targeting. When `targetAll` is true the targeting arrays are ignored and
  // every active employee can respond; otherwise the audience is the union
  // of the three lists.
  targetAll         Boolean   @default(true) @map("target_all")
  targetEntityIds   Json      @default("[]") @map("target_entity_ids")
  targetDepartments Json      @default("[]") @map("target_departments")
  targetUserIds     Json      @default("[]") @map("target_user_ids")
  publishedAt DateTime? @map("published_at")
  closedAt    DateTime? @map("closed_at")
  // Optional open/close window. A published form is only "available" between
  // startDate and endDate (inclusive); HR can extend endDate after publish.
  startDate   DateTime? @map("start_date") @db.Date
  endDate     DateTime? @map("end_date") @db.Date
  // Orthogonal to status — archiving hides a form from the active lists (and
  // the notification bell) without changing its lifecycle state.
  archivedAt  DateTime? @map("archived_at")
  createdById String    @map("created_by_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  createdBy User                 @relation("SurveyFormCreator", fields: [createdById], references: [id])
  questions SurveyFormQuestion[]
  responses SurveyFormResponse[]

  @@index([status])
  @@index([createdById])
  @@index([archivedAt])
  @@index([endDate])
  @@map("survey_forms")
}

model SurveyFormQuestion {
  id           String  @id @default(uuid()) @db.Uuid
  surveyFormId String  @map("survey_form_id") @db.Uuid
  order        Int
  // short_text | long_text | single_choice | multi_choice | rating | date | number
  type         String  @db.VarChar(30)
  prompt       String
  helperText   String? @map("helper_text")
  required     Boolean @default(false)
  options      Json    @default("[]") // choice questions: ordered string[]
  settings     Json    @default("{}") // per-type knobs, e.g. {"min":1,"max":5}

  surveyForm SurveyForm         @relation(fields: [surveyFormId], references: [id], onDelete: Cascade)
  answers    SurveyFormAnswer[]

  @@index([surveyFormId, order])
  @@map("survey_form_questions")
}

model SurveyFormResponse {
  id           String   @id @default(uuid()) @db.Uuid
  surveyFormId String   @map("survey_form_id") @db.Uuid
  // Null when the survey is anonymous. Multiple anonymous responses from the
  // same user are allowed; non-anonymous surveys enforce one-per-user via the
  // composite @@unique below.
  respondentId String?  @map("respondent_id") @db.Uuid
  submittedAt  DateTime @default(now()) @map("submitted_at")

  surveyForm SurveyForm         @relation(fields: [surveyFormId], references: [id], onDelete: Cascade)
  respondent User?              @relation("SurveyFormRespondent", fields: [respondentId], references: [id], onDelete: SetNull)
  answers    SurveyFormAnswer[]

  @@unique([surveyFormId, respondentId])
  @@index([surveyFormId])
  @@map("survey_form_responses")
}

model SurveyFormAnswer {
  id         String @id @default(uuid()) @db.Uuid
  responseId String @map("response_id") @db.Uuid
  questionId String @map("question_id") @db.Uuid
  // Polymorphic value: text/single → string · multi → string[] ·
  // rating/number → number · date → "YYYY-MM-DD" string.
  value      Json

  response SurveyFormResponse @relation(fields: [responseId], references: [id], onDelete: Cascade)
  question SurveyFormQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([responseId, questionId])
  @@index([questionId])
  @@map("survey_form_answers")
}
```

- `respondentId` is nullable + `onDelete: SetNull` so anonymous responses
  carry no author and a deleted user leaves their non-anonymous responses
  intact (just unlinked).
- `@@unique([surveyFormId, respondentId])` enforces one response per user on
  non-anonymous forms; anonymous forms (all `respondentId = NULL`) skip the
  constraint since multiple NULLs don't collide in Postgres.
- Auto-posted survey announcements deep-link to `/survey-forms/:id/respond`
  via the new `linkUrl` column on `WallPost` / `CompanyNews` / `CompanyDate`
  (see **Comms deep links**, below).

---

## Survey (xlsx import) + Pulse seed (hr.prisma)

The original pulse-survey module — schema-driven `.xlsx` upload + analytics —
remains in `hr.prisma`. `SurveyDefinition` holds the versioned sections /
demographics / feedback-column schema; `SurveyWave` is one fielding of a
definition with an open/close window and a status; `SurveyResponse` and
`UploadJob` carry the imported rows + audit trail.

```prisma
model SurveyDefinition {
  id                 String   @id @default(uuid()) @db.Uuid
  versionName        String   @unique @map("version_name") @db.VarChar(100)
  description        String?
  sectionsSchema     Json     @map("sections_schema")
  demographicsSchema Json     @default("{}") @map("demographics_schema")
  feedbackColumns    Json     @default("[]") @map("feedback_columns")
  totalQuestions     Int      @map("total_questions")
  isActive           Boolean  @default(true) @map("is_active")
  createdAt          DateTime @default(now()) @map("created_at")

  waves SurveyWave[]

  @@map("survey_definitions")
}

model SurveyWave {
  id            String    @id @default(uuid()) @db.Uuid
  name          String    @db.VarChar(80)
  description   String?
  definitionId  String    @map("definition_id") @db.Uuid
  startDate     DateTime? @map("start_date") @db.Date
  endDate       DateTime? @map("end_date") @db.Date
  status        String    @default("draft") @db.VarChar(20)
  responseCount Int       @default(0) @map("response_count")
  createdBy     String    @map("created_by") @db.Uuid
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  definition SurveyDefinition @relation(fields: [definitionId], references: [id])
  creator    User             @relation(fields: [createdBy], references: [id])
  responses  SurveyResponse[]
  uploadJobs UploadJob[]

  @@index([status])
  @@index([createdBy])
  @@index([definitionId])
  @@map("survey_waves")
}
```

`SurveyResponse` (mapped `survey_responses`) stores per-respondent demographic
slices (`department`, `tenure`, `roleLevel`, `workSetup`), a `sections` JSON
score blob, four optional free-text feedback columns, and cascades on wave
delete. `UploadJob` (mapped `upload_jobs`) records each `.xlsx` import —
file name/size, row/valid/error counts, an `errorReport` JSON, and a status.

**Seed**: `seed.ts` creates a **Pulse Engagement Survey** — `SurveyDefinition`
rows named `Pulse engagement {year}-v{i}` (35 questions, seeded from
`ESS_V2_SECTIONS_SEED` / `ESS_V2_FEEDBACK_COLUMNS_SEED`) and matching
`SurveyWave` rows `{year} pulse wave {i}` (alternating `active` / `closed`,
60-day-ago start, 30-day-out end), plus bulk `SurveyResponse` rows for local
analytics. Access is gated by the `survey:*` permission codes (see
`AUTH_RBAC.md`); wave management is `survey:manage-wave`.

---

## ESOP Grant — extended fields (hr.prisma)

`EsopGrant` has grown well past the original `shares` / `vestingMonths` /
`cliffMonths` / `strikePrice` shape to faithfully mirror HR's imported equity
spreadsheet. The lock / vesting / cliff periods are now **nullable** (blank
xlsx cells render as "—" instead of being rewritten with the old PRD defaults
of lock 0 / vesting 48 / cliff 12).

```prisma
model EsopGrant {
  id              String    @id @default(uuid()) @db.Uuid
  employeeId      String    @map("employee_id") @db.Uuid
  grantDate       DateTime  @map("grant_date") @db.Date
  grantType       String    @default("equity") @map("grant_type")
  valueType       String    @default("shares") @map("value_type")
  shares          Int       @default(0)
  currencyCode    String?   @map("currency_code")
  currencyAmount  Decimal?  @map("currency_amount") @db.Decimal(15, 2)
  percentOfBase   Decimal?  @map("percent_of_base") @db.Decimal(5, 2)
  vestingMonths   Int?      @map("vesting_months") // nullable now
  cliffMonths     Int?      @map("cliff_months")   // nullable now
  lockMonths      Int?      @map("lock_months")    // nullable now
  strikePrice     Decimal   @default(0) @map("strike_price") @db.Decimal(10, 4)
  // Allocation mode: one_time | monthly. Monthly grants drip `monthlyAmount`
  // between allocationStartMonth and allocationEndMonth.
  allocationMode       String    @default("one_time") @map("allocation_mode")
  monthlyAmount        Decimal?  @map("monthly_amount") @db.Decimal(15, 2)
  allocationStartMonth DateTime? @map("allocation_start_month") @db.Date
  allocationEndMonth   DateTime? @map("allocation_end_month") @db.Date
  source          String?
  status          String    @default("active")
  exercisedShares Int       @default(0) @map("exercised_shares")
  notes           String?
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  employee User @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@map("esop_grants")
}
```

- `grantType` (default `equity`) + `valueType` (default `shares`) classify the
  grant; `valueType` drives whether `shares`, `currencyAmount`/`currencyCode`,
  or `percentOfBase` is the meaningful magnitude.
- `allocationMode` = `one_time` (default) or `monthly`. Monthly grants use
  `monthlyAmount` + `allocationStartMonth` / `allocationEndMonth`.
- A sibling model, **`EquityMonthlySalary`** (`equity_monthly_salary`), holds
  HR's name-keyed "Equity Monthly Salary" sheet (per-month share counts in a
  `monthlyShares` JSON map; not FK'd to `User` since the sheet can list people
  outside the user table).

---

## Comms deep links (comms.prisma)

`WallPost`, `CompanyNews`, and `CompanyDate` each gained an optional
`linkUrl String? @map("link_url")` column — an in-app deep link rendered as a
"View" affordance on the home feed. It is `NULL` for ordinary posts/news/dates
and set to a path like `/survey-forms/:id/respond` on auto-posted survey
announcements and "closing soon" reminders.

```prisma
model WallPost {
  // ...existing fields (content, type, likes, reactions, attachments)...
  linkUrl   String?  @map("link_url")
}

model CompanyNews {
  // ...existing fields (title, content, category, isPinned, attachments)...
  linkUrl   String?  @map("link_url")
}

model CompanyDate {
  // ...existing fields (title, date, type, location, attachments)...
  linkUrl   String?  @map("link_url")
}
```

(The same three models also carry an `attachments Json?` column — an array of
`{ name, url, mimeType, size }` for files uploaded via the shared public
`uploads` Supabase bucket.)

---

## Fixed Asset Register (finance.prisma)

Thailand statutory PPE ledger. Depreciation is **never stored** — it is derived
from the register row on read, so the figures cannot drift from the register.

```prisma
model FixedAsset {
  assetNo               String    // FA-{IT|PFA|FF}-{YYYY}-NNN, annual reset
  quantity              Int       // memo value is 1.00 PER UNIT
  purchasePrice         Decimal   // negative = contra line (credit note)
  startDate             DateTime  @db.Date
  usefulLifeMonths      Int

  // Cut-over anchor. Both set = imported opening balance: NBV is anchored here
  // and depreciates forward on the ORIGINAL daily rate. All-or-nothing pair —
  // a value with no date makes the engine depreciate from startDate instead.
  openingBookValue      Decimal?
  openingAsOfDate       DateTime? @db.Date

  // TAX basis, parallel to the book basis. Null means "unknown", NOT "same as
  // book" — the deferred tax schedule excludes the asset and says so.
  taxUsefulLifeMonths   Int?
  openingTaxWdv         Decimal?
  openingTaxAsOfDate    DateTime? @db.Date

  // IAS 16.39/40 running balances. NOT derivable from the carrying amount:
  // two assets at the same carrying amount split the same movement differently.
  revaluationSurplus    Decimal   @default(0)
  impairmentPlLoss      Decimal   @default(0)
}
```

### The snapshot rule

Every table that records a carrying-amount event carries `*Before` columns
holding the asset state **immediately before** it. Reports rebuild a past date
from the EARLIEST event dated after it, so a later event never restates an
earlier report. Legacy rows with null snapshots fall back to live values.

| Model | Purpose | Snapshot columns |
| ----- | ------- | ---------------- |
| `FixedAssetDisposal` | disposal / write-off + approval | `quantityBefore`, `costBefore`, `openingBookValueBefore`, `accumulatedTaxRemoved`, `openingTaxWdvBefore` |
| `FixedAssetRemeasurement` | revaluation / impairment / reversal | same, plus `openingAsOfDateBefore` (an impairment RE-ANCHORS the asset, so it must record its own anchor date) |
| `FixedAssetTransfer` | location / custodian / cross-entity | `costTransferred`, `accumulatedTransferred`, `remainingLifeMonths` |

`FixedAssetRemeasurement` also persists the recognition split (`movement`,
`profitOrLoss`, `oci`) **and** the balances after the event (`surplusAfter`,
`plLossAfter`), so the next remeasurement does not re-derive history.

### Supporting models

| Model | Notes |
| ----- | ----- |
| `FixedAssetCategory` | `@@unique([entityId, code])`, **no seed** — create per entity before importing. `assetClass` drives the asset-number prefix and is allocated at create time, never retro-renumbered. Four `*GlAccountId` columns are the per-category posting override |
| `FixedAssetCountSession` / `FixedAssetCountLine` | Count is dated **as-of**, not "today". A line may have a null `assetId` for something found that is not in the register |
| `EntityTaxRate` | Effective-dated per entity. Absence is a hard stop for the deferred tax schedule, never a cue to assume a headline rate |

### GL account routing

Posting resolves an account in two levels: the category's own `*GlAccountId`
column, then the entity-level `AccountMapping` role (`fa_asset_cost`,
`fa_depreciation_expense`, `fa_accumulated_depreciation`, `fa_disposal_gain`,
`fa_disposal_loss`), then a hard throw. Those five roles are **situational** —
deliberately not in `REQUIRED_MAPPING_ROLES`, which would flip every configured
entity to "not ready" and stop AR/AP posting for entities owning no fixed assets.

## Content Models

### content.prisma

```prisma
// ============================================================================
// BLOGS
// ============================================================================

model Blog {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title      String
  content    String
  coverImage String   @map("cover_image")
  slug       String?
  active     Boolean  @default(true)
  authorId   String   @map("author_id") @db.Uuid
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  author User @relation(fields: [authorId], references: [id])

  @@index([createdAt(sort: Desc)])
  @@map("blogs")
}

// ============================================================================
// ARTICLES
// ============================================================================

model Article {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title     String
  date      String
  link      String
  img       String
  authorId  String   @map("author_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  author User @relation(fields: [authorId], references: [id])

  @@index([createdAt(sort: Desc)])
  @@map("articles")
}
```

---

## System Models

### system.prisma

```prisma
// ============================================================================
// AUDIT LOG
// ============================================================================

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String?  @map("user_id") @db.Uuid
  action     String   // create, update, delete, login, logout, etc.
  resource   String   // user, leave_request, journal_entry, etc.
  resourceId String?  @map("resource_id")
  details    Json?    // { before: {}, after: {}, changes: [] }
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  timestamp  DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@index([timestamp(sort: Desc)])
  @@index([userId])
  @@index([resource, resourceId])
  @@map("audit_log")
}

// ============================================================================
// USER SETTINGS
// ============================================================================

model UserSetting {
  userId String @map("user_id") @db.Uuid
  key    String @db.VarChar(50)
  value  Json

  @@id([userId, key])
  @@map("user_settings")
}

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

model SystemSetting {
  key       String   @id @db.VarChar(100)
  value     Json
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("system_settings")
}

// ============================================================================
// FILE UPLOADS
// ============================================================================

model FileUpload {
  id           String   @id @default(uuid()) @db.Uuid
  filename     String
  originalName String   @map("original_name")
  mimeType     String   @map("mime_type")
  size         Int
  path         String   // GCS path or URL
  bucket       String?
  uploadedBy   String   @map("uploaded_by") @db.Uuid
  purpose      String?  // receipt, document, avatar, etc.
  linkedTo     String?  @map("linked_to") // resource type
  linkedId     String?  @map("linked_id") // resource ID
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([uploadedBy])
  @@index([linkedTo, linkedId])
  @@map("file_uploads")
}
```

---

## Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CORE RELATIONSHIPS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                            │
│  │  Entity  │────<│   User   │>────│   Role   │                            │
│  └──────────┘     └──────────┘     └──────────┘                            │
│       │                │                │                                   │
│       │                │                │                                   │
│       ▼                ▼                ▼                                   │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                            │
│  │ Accounts │     │UserRole  │     │RolePerm  │                            │
│  │ Journals │     │ModAccess │     │          │                            │
│  │ Payroll  │     │          │     │          │                            │
│  └──────────┘     └──────────┘     └──────────┘                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                           HR RELATIONSHIPS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User ─────< LeaveBalance                                                   │
│  User ─────< LeaveRequest >───── LeaveType                                 │
│               LeaveRequest >───── Entity (optional)                        │
│  User ─────< Payslip >────────── PayrollRun >───── Entity                  │
│  User ─────< EsopGrant                                                      │
│  User ─────< VisaRecord                                                     │
│  User ─────< TrainingCompletion >── TrainingModule                         │
│  User ─────< BenefitEnrollment >─── Benefit                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         FINANCE RELATIONSHIPS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Entity ────< ChartOfAccount (self-referencing parent)                     │
│  Entity ────< JournalEntry ────< JournalEntryLine >─── ChartOfAccount      │
│  Entity ────< Invoice >──────── JournalEntry (optional)                    │
│  Entity ────< BankTransaction                                               │
│  Entity ────< Expense >──────── User (employee + approver)                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                       OPERATIONS RELATIONSHIPS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Partner ────< PartnerContact                                               │
│  Partner ────< Project ────< ProjectTask >───── User                       │
│                Project ────< ProjectMember >──── User                      │
│                Project ────< ProjectColumn                                  │
│  Partner ────< Deal >──────── User                                          │
│  Office ─────< OfficeDesk ──< DeskBooking >──── User                       │
│  Office ─────< MeetingRoom ─< RoomBooking >──── User                       │
│  Office ─────< Asset >─────── User (assignee)                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         COMMS RELATIONSHIPS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User ────< Channel ────< Message >───── User                              │
│  User ────< WallPost ───< WallComment >── User                             │
│  User ────< CompanyNews                                                     │
│  User ────< AriaConversation ──< AriaMessage                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                        INVESTOR RELATIONSHIPS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User ────< Investor ────< Investment                                       │
│  User ────< DataRoomDocument                                                │
│  User ────< InvestorUpdate                                                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                        CONTENT RELATIONSHIPS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User ────< Blog                                                            │
│  User ────< Article                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Migration Strategy

All tables have been created and are live in production. The schema was rolled out in phases:

### Phase 1: Core Tables (Complete)

1. Created extensions (`uuid-ossp`, `pgcrypto`)
2. Created `entities` table with seed data (TH, AE, SG, PT)
3. Created `users` table
4. Created RBAC tables (`roles`, `user_roles`, `role_permissions`)
5. Seeded system roles (Admin, HR Manager, Employee, Manager)

### Phase 2: HR Tables (Complete)

1. Leave management (`leave_types`, `leave_balances`, `leave_requests`)
2. Payroll (`payroll_runs`, `payslips`, `consultant_invoices`)
3. ESOP (`esop_grants`)
4. Supporting HR (`onboarding_runs`, `training_modules`, `training_completions`, `visa_records`, `benefits`, `benefit_enrollments`)

### Phase 3: Finance Tables (Complete)

1. Accounting (`chart_of_accounts`, `journal_entries`, `journal_entry_lines`)
2. AR/AP (`invoices`)
3. Banking (`bank_transactions`, `bnry_transactions`)
4. Expenses (`expense_categories`, `expenses`)

### Phase 4: Operations Tables (Complete)

1. Partners (`partners`, `partner_contacts`)
2. Sales (`deals`)
3. Projects (`projects`, `project_members`, `project_columns`, `project_tasks`)
4. Office (`offices`, `office_desks`, `desk_bookings`, `meeting_rooms`, `room_bookings`, `assets`)

### Phase 5: Communication Tables (Complete)

1. Messaging (`channels`, `messages`)
2. Social (`wall_posts`, `wall_comments`)
3. News (`company_news`, `company_dates`)
4. AI (`aria_conversations`, `aria_messages`)

### Phase 6: Investor Tables (Complete)

1. Cap table (`investors`, `investments`)
2. Data room (`data_room_documents`)
3. Updates (`investor_updates`)

### Phase 7: Content Tables (Complete)

1. Blogs (`blogs`)
2. Articles (`articles`)

### Phase 8: System Tables (Complete)

1. Audit (`audit_log`)
2. Settings (`user_settings`, `system_settings`)
3. Files (`file_uploads`)

### Phase 9: Row-Level Security (Complete)

Applied via `20260423_enable_rls` migration:

1. Enabled RLS on **all** tables
2. Revoked direct table access from `anon` and `authenticated` Supabase roles (prevents Data API / PostgREST access)
3. Revoked default privileges on future tables for `anon` and `authenticated`
4. Created `is_service_role()` helper function to identify `service_role` / `supabase_admin` / `postgres`
5. Created `service_role_full_access` policy on every table for backend access via Prisma

This enforces the backend-only architecture: `Browser → Express API (service_role via Prisma) → PostgreSQL`.

---

## Related Documents

- [Project Overview](./PROJECT_OVERVIEW.md)
- [Modules Specification](./MODULES_SPECIFICATION.md)
- [Authentication & RBAC](./AUTH_RBAC.md)
- [API Specification](./API_SPECIFICATION.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Task Planning](./TASK_PLANNING.md)
