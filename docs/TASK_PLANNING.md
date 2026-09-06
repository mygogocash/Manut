# Intranet - Task Planning

> Comprehensive task breakdown for rebuilding Intranet from demo to production. Tasks are organized by phase and module, with granular subtasks for implementation.

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 0: Project Setup](#phase-0-project-setup)
3. [Phase 1: Core Infrastructure](#phase-1-core-infrastructure)
4. [Phase 2: Authentication & RBAC](#phase-2-authentication--rbac)
5. [Phase 3: Core Modules](#phase-3-core-modules)
6. [Phase 4: HR Modules](#phase-4-hr-modules)
7. [Phase 5: Finance Modules](#phase-5-finance-modules)
8. [Phase 6: Operations Modules](#phase-6-operations-modules)
9. [Phase 7: Communication Modules](#phase-7-communication-modules)
10. [Phase 8: Investor Modules](#phase-8-investor-modules)
11. [Phase 9: System Modules](#phase-9-system-modules)
12. [Phase 10: Integration & Testing](#phase-10-integration--testing)
13. [Phase 11: Deployment](#phase-11-deployment)

---

## Overview

### Task Status Legend

- `[ ]` - Not started
- `[~]` - In progress
- `[x]` - Completed
- `[-]` - Blocked/Skipped

### Estimation Guidelines

Each task includes a rough complexity indicator:

- **S** (Small): < 2 hours
- **M** (Medium): 2-4 hours
- **L** (Large): 4-8 hours
- **XL** (Extra Large): 1-2 days

### Backend Module Convention (Clean Architecture)

Each backend module follows this structure:

```
modules/{module-name}/
├── {module}.controller.ts    # HTTP route handlers
├── {module}.service.ts       # Business logic
├── {module}.repository.ts    # Database operations (Prisma)
├── {module}.validation.ts    # Zod schemas (request/response DTOs)
├── {module}.types.ts         # Module-specific TypeScript types
├── {module}.constants.ts     # Module constants (optional)
└── index.ts                  # Exports & route registration
```

**Flow:** `Controller → Service → Repository → Database`

- **Controller**: Handles HTTP requests, calls service, returns response
- **Service**: Contains business logic, calls repository
- **Repository**: Database queries via Prisma, no business logic
- **Validation**: Zod schemas for input/output validation
- **Types**: Interfaces and types specific to the module

---

## Phase 0: Project Setup

### 0.1 Monorepo Initialization

- [x] **[M]** Initialize Turborepo with pnpm workspace
- [x] **[S]** Create root `package.json` with workspace scripts
- [x] **[S]** Create `turbo.json` configuration
- [x] **[S]** Create `pnpm-workspace.yaml`
- [x] **[S]** Setup `.gitignore` for monorepo
- [x] **[S]** Create root `README.md`

### 0.2 Apps Setup

- [x] **[M]** Create `apps/web` - Next.js 15 frontend
  - [x] Initialize with `create-next-app`
  - [x] Configure App Router
  - [x] Setup `next.config.ts`
  - [x] Configure path aliases (`@/*`)
- [x] **[M]** Create `apps/api` - Express backend
  - [x] Initialize Express with TypeScript
  - [x] Setup folder structure (`routes`, `middleware`, `services`, `repos`)
  - [x] Configure `tsconfig.json`
  - [x] Setup nodemon for development

### 0.3 Packages Setup

- [x] **[M]** Create `packages/database`
  - [x] Initialize Prisma
  - [x] Setup split schema structure
  - [x] Configure `prisma.config.ts`
  - [x] Setup seed script
- [x] **[S]** Create `packages/types`
  - [x] Setup shared TypeScript types
  - [x] Configure exports
- [x] **[M]** Create `packages/ui`
  - [x] Initialize shadcn/ui
  - [x] Setup component exports
  - [x] Configure Tailwind
- [x] **[S]** Create `packages/utils`
  - [x] Setup shared utilities
  - [x] Date formatters, validators, etc.

### 0.4 Configuration Files

- [x] **[M]** Setup ESLint (copy from CRM repo)
  - [x] Create `eslint.config.mjs`
  - [x] Install required plugins
  - [x] Configure for TypeScript strict mode
- [x] **[S]** Setup Prettier
  - [x] Create `.prettierrc`
  - [x] Create `.prettierignore`
- [x] **[M]** Setup TypeScript
  - [x] Create root `tsconfig.json`
  - [x] Create app-specific configs extending root
  - [x] Enable strict mode
- [x] **[S]** Setup Git hooks
  - [x] Install Husky
  - [x] Configure pre-commit hooks
  - [x] Setup lint-staged

### 0.5 Environment Setup

- [x] **[S]** Create `.env.example` files
- [x] **[S]** Setup environment validation (t3-env)
- [x] **[S]** Document required environment variables

---

## Phase 1: Core Infrastructure

### 1.1 Design System Implementation

- [x] **[L]** Configure Tailwind CSS
  - [x] Setup CSS variables from demo
  - [x] Configure color system (light/dark)
  - [x] Configure typography scale
  - [x] Configure spacing/radius
- [x] **[M]** Setup Google Fonts (DM Sans, DM Serif Display, DM Mono)
- [x] **[L]** Customize shadcn/ui components
  - [x] Button variants (primary, secondary, destructive, ghost)
  - [x] Input styles
  - [x] Card styles
  - [x] Badge variants
  - [x] Table styles
  - [x] Modal/Dialog styles
  - [x] Tabs styles

### 1.2 Layout Components

- [x] **[L]** Create AppShell component
  - [x] Full-height layout with sidebar + main
  - [x] Responsive handling
- [x] **[M]** Create Sidebar component
  - [x] Logo section
  - [x] Navigation groups
  - [x] User section at bottom
  - [x] Active state styling
  - [x] Permission-based filtering
- [x] **[M]** Create Topbar component
  - [x] Page title (serif font)
  - [x] Date display
  - [x] Search input
  - [x] User avatar
- [x] **[S]** Create PageHeader component
  - [x] Title with optional subtitle
  - [x] Action buttons slot

### 1.3 Shared Components

- [x] **[M]** Create Avatar component
- [x] **[M]** Create KPI Card component
- [x] **[M]** Create DataTable component with sorting/filtering
- [x] **[M]** Create Modal/Dialog wrapper
- [x] **[M]** Create Form components (InputGroup, FormActions)
- [x] **[S]** Create Badge component with status mapping
- [x] **[S]** Create Progress bar component
- [x] **[S]** Create Empty state component
- [x] **[S]** Create Loading skeleton components

### 1.4 Backend Setup (Clean Architecture)

- [x] **[L]** Setup Express app with module-based structure
  - [x] Create `src/modules/` folder structure
  - [x] Create `src/core/` for shared middleware/guards
  - [x] Create `src/common/` for utilities/constants
  - [x] Create `src/config/` for configuration
  - [x] Create `src/infrastructure/` for external services
  - [x] Setup module auto-registration pattern
- [x] **[M]** Setup core middleware stack
  - [x] Configure CORS, Helmet, compression
  - [x] Configure rate limiting
  - [x] Create request ID middleware
- [x] **[M]** Setup core exception handling
  - [x] Create `HttpException` base class
  - [x] Create specific exceptions (NotFound, Validation, etc.)
  - [x] Create global exception filter
- [x] **[M]** Setup core interceptors
  - [x] Response transform interceptor
  - [x] Logging interceptor
  - [x] Timeout interceptor
- [x] **[M]** Setup logging (Winston)
  - [x] Configure log levels
  - [x] Setup request logging
- [x] **[S]** Setup health check module

### 1.5 Database Setup

- [x] **[M]** Create Prisma schema (base)
  - [x] Entity model
  - [x] User model
  - [x] Session model
- [x] **[S]** Run initial migration
- [x] **[M]** Create seed script for entities
- [x] **[S]** Setup Prisma client singleton

### 1.6 API Client Setup

- [x] **[M]** Configure fetch wrapper (`api-client.ts`)
  - [x] Base URL configuration
  - [x] Request interceptors (auth header via Bearer token)
  - [x] Response interceptors (error handling)
- [x] **[S]** Setup API types generation
- [x] **[S]** Create API hooks pattern

---

## Phase 2: Authentication & RBAC

### 2.1 Supabase Setup

- [x] **[M]** Create Supabase project
- [x] **[S]** Configure environment variables
- [x] **[M]** Create Supabase clients
  - [x] Browser client
  - [x] Server client (cookies)
  - [x] Admin client (service role)

### 2.2 Auth Module (`modules/auth/`)

- [x] **[M]** Create core auth guards (`core/guards/`)
  - [x] `AuthGuard` - JWT verification
  - [x] `ActiveGuard` - User status check
  - [x] `PermissionGuard` - RBAC check
- [x] **[L]** Create auth module
  - [x] `auth.controller.ts` - Route handlers
  - [x] `auth.service.ts` - Business logic
  - [x] `auth.repository.ts` - User/session queries
  - [x] `auth.validation.ts` - Zod schemas
  - [x] `auth.types.ts` - Module types
- [x] **[L]** Implement auth service methods
  - [x] `login` - Supabase signIn + session
  - [x] `logout` - Clear session
  - [x] `createUser` - Supabase + Prisma
  - [x] `resetPassword` - Admin reset
  - [x] `changePassword` - User self-service
  - [x] `getMe` - Current user profile
- [x] **[M]** Implement auth controller routes
  - [x] `POST /api/auth/login`
  - [x] `POST /api/auth/logout`
  - [x] `GET /api/auth/me`
  - [x] `POST /api/auth/change-password`
  - [-] `POST /api/auth/refresh` *(not implemented — Supabase handles refresh internally)*

### 2.3 RBAC Database

- [x] **[M]** Create RBAC Prisma schema
  - [x] Role model
  - [x] UserRole model
  - [x] RolePermission model
  - [x] ModuleAccess model
  - [x] ModuleOwner model
- [x] **[S]** Run RBAC migration
- [x] **[L]** Create permission constants file
  - [x] Define all permission codes
  - [x] Group by module
  - [x] Create validation helpers
- [x] **[M]** Create RBAC seed script
  - [x] System roles (Admin, HR Manager, Employee, etc.)
  - [x] Role-permission mappings

### 2.4 Roles Module (`modules/roles/`)

- [x] **[L]** Create roles module
  - [x] `roles.controller.ts` - Route handlers
  - [x] `roles.service.ts` - Business logic
  - [x] `roles.repository.ts` - Role/permission queries
  - [x] `roles.validation.ts` - Zod schemas
  - [x] `roles.types.ts` - Module types
- [x] **[M]** Implement roles service methods
  - [x] `findAll` - List roles
  - [x] `findById` - Get role with permissions
  - [x] `create` - Create role with permissions
  - [x] `update` - Update role & permissions
  - [x] `delete` - Delete role (non-system)
  - [x] `getUserPermissions` - Aggregate user permissions
- [x] **[M]** Implement roles controller routes
  - [x] `GET /api/roles`
  - [x] `GET /api/roles/:id`
  - [x] `POST /api/roles`
  - [x] `PUT /api/roles/:id`
  - [x] `DELETE /api/roles/:id`

### 2.5 Auth Frontend

- [x] **[L]** Create AuthProvider
  - [x] User state management
  - [x] Permission state
  - [x] Login/logout functions
  - [x] `hasPermission` helper
- [x] **[M]** Create sign-in page
  - [x] Login form
  - [x] Error handling
  - [x] Redirect logic
- [x] **[M]** Create change-password page
  - [x] Current + new password form
  - [x] Validation
- [x] **[S]** Create auth guard component
- [x] **[S]** Setup route protection

### 2.6 User Management

- [x] **[M]** Create user repository
- [x] **[L]** Create user admin routes
  - [x] `GET /api/admin/users`
  - [x] `POST /api/admin/users`
  - [x] `GET /api/admin/users/:id`
  - [x] `PUT /api/admin/users/:id`
  - [x] `DELETE /api/admin/users/:id`
  - [x] `POST /api/admin/users/:id/reset-password`
  - [x] `PUT /api/admin/users/:id/roles`
- [x] **[L]** Create user management UI
  - [x] User list with filters
  - [x] User detail/edit form
  - [x] Create user modal
  - [x] Role assignment UI

---

## Phase 3: Core Modules

### 3.1 Home Dashboard

- [x] **[M]** Create dashboard page layout
- [x] **[M]** Create KPI row component
  - [x] Revenue KPI
  - [x] MRR KPI
  - [x] Partner pipeline KPI
  - [x] ESOP pool KPI
- [x] **[M]** Create urgent items widget
  - [x] Expiring visas
  - [x] Pending expenses
  - [x] Draft journals
- [x] **[L]** Create company wall widget
  - [x] Wall post list
  - [x] Create post modal
  - [x] Like/react functionality
- [x] **[M]** Create company news widget
  - [x] News list
  - [x] Create news modal
- [x] **[M]** Create company dates widget
  - [x] Calendar-style display
  - [x] Add date modal
- [x] **[S]** Create quick ARIA prompt

### 3.2 Wall Module (`modules/wall/`)

- [x] **[S]** Create wall Prisma schema
- [x] **[L]** Create wall module
  - [x] `wall.controller.ts`
  - [x] `wall.service.ts`
  - [x] `wall.repository.ts`
  - [x] `wall.validation.ts`
  - [x] `wall.types.ts`
- [x] **[M]** Implement wall endpoints
  - [x] `GET /api/wall`
  - [x] `POST /api/wall`
  - [x] `PUT /api/wall/:id/like`
  - [x] `PUT /api/wall/:id/react`
  - [x] `POST /api/wall/:id/comment`
  - [x] `DELETE /api/wall/:id`

### 3.3 News Module (`modules/news/`)

- [x] **[S]** Create news Prisma schema
- [x] **[M]** Create news module
  - [x] `news.controller.ts`
  - [x] `news.service.ts`
  - [x] `news.repository.ts`
  - [x] `news.validation.ts`
- [x] **[M]** Implement news endpoints
  - [x] `GET /api/news`
  - [x] `POST /api/news`
  - [x] `DELETE /api/news/:id`

### 3.4 Company Dates Module (`modules/company-dates/`)

- [x] **[S]** Create company dates Prisma schema
- [x] **[M]** Create company-dates module
  - [x] `company-dates.controller.ts`
  - [x] `company-dates.service.ts`
  - [x] `company-dates.repository.ts`

---

## Phase 4: HR Modules

### 4.1 Leave Module (`modules/leave/`)

#### Database

- [x] **[M]** Create leave Prisma schema
  - [x] LeaveType
  - [x] LeaveBalance
  - [x] LeaveRequest
- [x] **[S]** Run leave migration
- [x] **[M]** Create leave seed data (leave types)

#### Backend Module

- [x] **[L]** Create leave module structure
  - [x] `leave.controller.ts` - Route handlers
  - [x] `leave.service.ts` - Business logic
  - [x] `leave.repository.ts` - Database queries
  - [x] `leave.validation.ts` - Zod schemas
  - [x] `leave.types.ts` - Module types
  - [x] `leave.constants.ts` - Leave type enums
- [x] **[L]** Implement leave service methods
  - [x] `getTypes` - List leave types
  - [x] `getBalances` - Get user balances
  - [x] `calculateBalance` - Available days calculation
  - [x] `getRequests` - List requests (own/all)
  - [x] `createRequest` - Submit with validation
  - [x] `approve` - Approve & deduct balance
  - [x] `reject` - Reject with reason
  - [x] `cancel` - Cancel own pending request
  - [x] `checkOverlap` - Detect overlapping requests
- [x] **[M]** Implement leave controller routes
  - [x] `GET /api/leave/types`
  - [x] `GET /api/leave/balances`
  - [x] `GET /api/leave/requests`
  - [x] `POST /api/leave/requests`
  - [x] `PUT /api/leave/requests/:id/approve`
  - [x] `PUT /api/leave/requests/:id/reject`
  - [x] `PUT /api/leave/requests/:id/cancel`

#### Frontend

- [x] **[L]** Create leave list page
  - [x] Filter by status
  - [x] Filter by employee (HR)
  - [x] Table with actions
- [x] **[M]** Create leave request form
  - [x] Leave type select
  - [x] Date range picker
  - [x] Balance display
- [x] **[M]** Create leave balance card
- [x] **[M]** Create leave calendar view
- [x] **[S]** Create approval actions component

### 4.2 Payroll Module (`modules/payroll/`)

#### Database

- [x] **[M]** Create payroll Prisma schema
  - [x] PayrollRun
  - [x] Payslip
  - [x] ConsultantInvoice
- [x] **[S]** Run payroll migration

#### Backend Module

- [x] **[L]** Create payroll module structure
  - [x] `payroll.controller.ts`
  - [x] `payroll.service.ts`
  - [x] `payroll.repository.ts`
  - [x] `payroll.validation.ts`
  - [x] `payroll.types.ts`
  - [x] `payroll.calculator.ts` - Country-specific calculations
- [x] **[XL]** Implement payroll service methods
  - [x] Multi-country calculations (TH, AE, SG, PT)
  - [x] Tax calculations per country
  - [x] Allowances/deductions calculation
  - [x] Payslip generation
- [x] **[L]** Implement payroll controller routes
  - [x] `GET /api/payroll/runs`
  - [x] `POST /api/payroll/runs`
  - [x] `GET /api/payroll/runs/:id`
  - [x] `PUT /api/payroll/runs/:id/approve`
  - [x] `GET /api/payroll/consultants`
  - [x] `POST /api/payroll/consultants`

#### Frontend

- [x] **[L]** Create payroll runs list
- [x] **[L]** Create payroll run detail
  - [x] Payslips table
  - [x] Summary totals
  - [x] Approve action
- [x] **[M]** Create run payroll modal
- [x] **[M]** Create consultant invoices list
- [x] **[M]** Create consultant invoice form

### 4.3 HRMS (ESOP + Onboarding)

#### Backend

- [x] **[M]** Create HRMS Prisma schema
  - [x] EsopGrant
  - [x] OnboardingRun
- [x] **[M]** Create HRMS repository
- [x] **[M]** Create HRMS service
  - [x] Vesting calculation
  - [x] Pool summary
- [x] **[M]** Create HRMS routes
  - [x] `GET /api/hrms/esop-pool`
  - [x] `GET /api/hrms/esop-grants`
  - [x] `POST /api/hrms/esop-grants`
  - [x] `PUT /api/hrms/esop-grants/:id`
  - [x] `DELETE /api/hrms/esop-grants/:id`
  - [x] `GET /api/hrms/onboarding`
  - [x] `POST /api/hrms/onboarding`
  - [x] `PUT /api/hrms/onboarding/:id/task`

#### Frontend

- [x] **[L]** Create ESOP dashboard
  - [x] Pool summary
  - [x] Grants table
  - [x] Create grant modal
- [x] **[M]** Create vesting chart component
- [x] **[L]** Create onboarding list
- [x] **[M]** Create onboarding detail
  - [x] Task checklist
  - [x] Progress indicator

### 4.4 Benefits

#### Backend

- [x] **[S]** Create benefits Prisma schema
- [x] **[M]** Create benefits repository
- [x] **[M]** Create benefits routes

#### Frontend

- [x] **[M]** Create benefits catalog page
- [x] **[M]** Create enrollment management

### 4.5 Learning

#### Backend

- [x] **[M]** Create learning Prisma schema
- [x] **[M]** Create learning repository
- [x] **[M]** Create learning routes

#### Frontend

- [x] **[L]** Create training modules list
- [x] **[M]** Create module detail page
- [x] **[M]** Create completions tracking
- [x] **[M]** Create completion report

### 4.6 Visa Management

#### Backend

- [x] **[S]** Create visa Prisma schema
- [x] **[M]** Create visa repository
- [x] **[M]** Create visa routes

#### Frontend

- [x] **[L]** Create visa records list
  - [x] Expiry alerts
  - [x] Status badges
- [x] **[M]** Create visa record form
- [x] **[S]** Create expiry dashboard widget

### 4.7 Directory

#### Frontend

- [x] **[L]** Create employee directory
  - [x] Search/filter
  - [x] Grid/list view toggle
- [x] **[M]** Create employee profile view
- [x] **[L]** Create org chart visualization

---

## Phase 5: Finance Modules

### 5.1 Accounting

#### Backend

- [x] **[L]** Create accounting Prisma schema
  - [x] ChartOfAccount
  - [x] JournalEntry
  - [x] JournalEntryLine
  - [x] Invoice
  - [x] BankTransaction
  - [x] BnryTransaction
- [x] **[M]** Run accounting migration
- [x] **[L]** Create accounting repository
- [x] **[L]** Create accounting service
  - [x] Journal posting (balance updates)
  - [x] Trial balance
- [x] **[XL]** Create accounting routes
  - [x] `GET /api/accounting/entities`
  - [x] `GET /api/accounting/accounts`
  - [x] `POST /api/accounting/accounts`
  - [x] `GET /api/accounting/journals`
  - [x] `POST /api/accounting/journals`
  - [x] `GET /api/accounting/journals/:id`
  - [x] `PUT /api/accounting/journals/:id/approve`
  - [x] `PUT /api/accounting/journals/:id/post`
  - [x] `GET /api/accounting/invoices`
  - [x] `POST /api/accounting/invoices`
  - [x] `GET /api/accounting/bank`
  - [x] `POST /api/accounting/bank/import`
  - [x] `PUT /api/accounting/bank/:id/map`

#### Frontend

- [x] **[L]** Create chart of accounts page
  - [x] Tree view
  - [x] Account balances
  - [x] Create account modal
- [x] **[L]** Create journal entries list
  - [x] Filter by status
  - [x] Filter by entity
- [x] **[L]** Create journal entry form
  - [x] Dynamic lines
  - [x] Debit/credit balance validation
- [x] **[M]** Create journal detail view
- [x] **[L]** Create invoices list
- [x] **[M]** Create invoice form
- [x] **[L]** Create bank reconciliation page
  - [x] Import bank statement
  - [x] Transaction matching
- [x] **[M]** Create BNRY ledger view

### 5.2 Expenses

#### Backend

- [x] **[M]** Create expense Prisma schema
  - [x] ExpenseCategory
  - [x] Expense
- [x] **[M]** Create expense repository
- [x] **[M]** Create expense service
- [x] **[L]** Create expense routes

#### Frontend

- [x] **[L]** Create expense list
  - [x] Own expenses (employee)
  - [x] All expenses (HR)
- [x] **[M]** Create expense form
  - [x] Receipt upload
  - [x] Category select
- [x] **[M]** Create expense detail view
- [x] **[S]** Create approval actions

### 5.3 Revenue Analytics

#### Backend

- [x] **[M]** Create revenue analytics service
  - [x] MRR/ARR calculation
  - [x] Partner revenue breakdown

#### Frontend

- [x] **[L]** Create revenue dashboard
  - [x] Revenue charts
  - [x] Partner breakdown
  - [x] Trend analysis

---

## Phase 6: Operations Modules

### 6.1 Partner CRM

#### Backend

- [x] **[M]** Create partner Prisma schema
  - [x] Partner
  - [x] PartnerContact
- [x] **[M]** Create partner repository
- [x] **[M]** Create partner routes

#### Frontend

- [x] **[L]** Create partner list
  - [x] Pipeline view
  - [x] Filter by type/status
- [x] **[M]** Create partner detail
  - [x] Contacts list
  - [x] Activity timeline
- [x] **[M]** Create partner form
- [x] **[M]** Create contact form

### 6.2 Sales CRM

#### Backend

- [x] **[M]** Create deal Prisma schema
- [x] **[M]** Create deal repository
- [x] **[M]** Create deal routes

#### Frontend

- [x] **[L]** Create deal pipeline (Kanban)
- [x] **[M]** Create deal detail
- [x] **[M]** Create deal form
- [x] **[M]** Create pipeline forecast

### 6.3 Projects

#### Backend

- [x] **[M]** Create project Prisma schema
  - [x] Project
  - [x] ProjectTask
- [x] **[M]** Create project repository
- [x] **[M]** Create project routes

#### Frontend

- [x] **[L]** Create project list
- [x] **[L]** Create project detail
  - [x] Task board (Kanban)
  - [x] Progress bar
- [x] **[M]** Create project form
- [x] **[M]** Create task form
- [x] **[M]** Implement drag-and-drop tasks

### 6.4 Office Management

#### Backend

- [x] **[M]** Create office Prisma schema
  - [x] Office
  - [x] OfficeDesk
  - [x] DeskBooking
  - [x] MeetingRoom
  - [x] RoomBooking
  - [x] Asset
- [x] **[M]** Create office repository
- [x] **[L]** Create office routes

#### Frontend

- [x] **[M]** Create office list
- [x] **[L]** Create desk booking page
  - [x] Floor plan view
  - [x] Date selector
  - [x] Booking calendar
- [x] **[L]** Create room booking page
  - [x] Time slot grid
  - [x] Booking form
- [x] **[M]** Create asset management page

---

## Phase 7: Communication Modules

### 7.1 Messaging

#### Backend

- [x] **[M]** Create messaging Prisma schema
  - [x] Channel
  - [x] Message
- [x] **[M]** Create messaging repository
- [x] **[L]** Create messaging routes
- [x] **[L]** Setup WebSocket server _(socket.io — `apps/api/src/modules/messages/messages.socket.ts`)_
  - [x] Connection handling
  - [x] Authentication
  - [x] Message broadcast

#### Frontend

- [x] **[L]** Create messaging layout
  - [x] Channel sidebar
  - [x] Message area
  - [x] Input bar
- [x] **[M]** Create channel list
- [x] **[M]** Create message list
  - [x] Infinite scroll
  - [x] Message grouping
- [x] **[M]** Create message input
  - [x] Send on enter
  - [x] Emoji support
- [x] **[M]** Create channel settings
- [x] **[L]** Integrate WebSocket client _(socket.io client; polling retained as fallback)_
  - [x] Real-time messages
  - [~] Online presence

### 7.2 ARIA (AI Assistant)

#### Backend

- [x] **[M]** Create ARIA Prisma schema
  - [x] AriaConversation
  - [x] AriaMessage
- [x] **[M]** Create ARIA repository
- [x] **[L]** Create ARIA service
  - [x] Anthropic API integration
  - [x] Context building
  - [x] Streaming response
- [x] **[L]** Create ARIA routes
  - [x] `POST /api/aria/chat`
  - [x] `POST /api/aria/parse-receipt`
  - [x] `POST /api/aria/parse-invoice`

#### Frontend

- [x] **[L]** Create ARIA chat page
  - [x] Conversation list
  - [x] Chat interface
  - [x] Streaming response display
- [x] **[M]** Create quick prompt component
- [x] **[M]** Create receipt parser UI
- [x] **[M]** Create invoice parser UI

---

## Phase 8: Investor Modules

### 8.1 Cap Table

#### Backend

- [x] **[M]** Create investor Prisma schema
  - [x] Investor
  - [x] Investment
- [x] **[M]** Create investor repository
- [x] **[L]** Create investor routes

#### Frontend

- [x] **[L]** Create cap table page
  - [x] Investor list
  - [x] Investment summary
  - [x] Ownership breakdown
- [x] **[M]** Create investor detail
  - [x] Investments list
  - [x] Notes timeline
- [x] **[M]** Create investor form
- [x] **[M]** Create investment form

### 8.2 Investor CRM

#### Frontend

- [x] **[L]** Create investor CRM page
  - [x] Pipeline view
  - [x] Contact management
  - [x] Activity tracking
- [x] **[M]** Create interaction log

### 8.3 Data Room

#### Backend

- [x] **[M]** Create data room Prisma schema
- [x] **[M]** Create data room repository
- [x] **[M]** Create data room routes

#### Frontend

- [x] **[L]** Create data room page
  - [x] Category folders
  - [x] Document list
  - [x] Completeness checklist
- [x] **[M]** Create document upload
- [x] **[M]** Create version history

### 8.4 Investor Updates

#### Backend

- [x] **[M]** Create investor update Prisma schema
- [x] **[M]** Create investor update repository
- [x] **[M]** Create investor update routes

#### Frontend

- [x] **[L]** Create investor updates list
- [x] **[L]** Create update composer
  - [x] Rich text editor
  - [x] Template support
- [x] **[M]** Create distribution UI

### 8.5 Investor Dashboard

#### Frontend

- [x] **[L]** Create investor dashboard
  - [x] Funding summary
  - [x] Pipeline metrics
  - [x] Recent activity

---

## Phase 9: System Modules

### 9.1 Admin Panel

#### Backend

- [x] **[M]** Create admin routes
  - [x] `GET /api/admin/audit-log`
  - [x] `GET /api/admin/storage-stats`
  - [x] `GET /api/admin/module-owners`
  - [x] `PUT /api/admin/module-owners/:id`

#### Frontend

- [x] **[M]** Create admin dashboard
- [x] **[L]** Create audit log viewer
  - [x] Filter by user/action/resource
  - [x] Time range filter
- [x] **[M]** Create module owners management
- [x] **[M]** Create storage stats display

### 9.2 Access Control

#### Frontend

- [x] **[L]** Create access control page
- [x] **[L]** Create role management
  - [x] Role list
  - [x] Permission assignment UI
- [x] **[M]** Create user role assignment UI
- [x] **[M]** Create module access overrides UI

### 9.3 Settings

#### Backend

- [x] **[S]** Create user settings routes
- [x] **[S]** Create system settings routes

#### Frontend

- [x] **[M]** Create settings page
  - [x] Profile settings
  - [x] Theme toggle
  - [x] API keys (ARIA)
- [x] **[S]** Create theme persistence

---

## Phase 10: Integration & Testing

### 10.1 File Upload

- [x] **[M]** Setup Google Cloud Storage
- [x] **[M]** Create upload service
- [x] **[M]** Create upload routes
  - [x] `POST /api/upload/receipt`
  - [x] `POST /api/upload/document`
- [x] **[S]** Create upload component with preview

### 10.2 Email Service

> Shipped as an HTTP email microservice (`EMAIL_SERVICE_URL` + `EMAIL_SERVICE_API_KEY`, POSTs to
> `/api/emails`), not the Resend SDK directly. See `apps/api/src/infrastructure/email/`.

- [x] **[M]** Setup email integration (HTTP email service)
- [x] **[M]** Create email templates (`infrastructure/email/templates.ts`)
  - [x] Welcome email
  - [x] Password reset / recovery (see `docs/ops/auth-recovery-fraud-prevention.md`)
  - [x] Notifications (leave / travel / expense workflow events)
- [x] **[M]** Create email service (`email.service.ts`, fire-and-forget, graceful skip when unconfigured)

### 10.3 Audit Logging

- [x] **[M]** Create audit log service
- [x] **[M]** Integrate audit logging in routes
- [x] **[S]** Create audit log viewer component

### 10.4 Testing

> Vitest runs in CI (`pnpm test` gate in `pr-checks.yml`); ~80+ `*.test.ts` suites across api +
> web, including the ARIA eval suites. Playwright is set up (`playwright.config.ts`, `e2e/`,
> `pnpm test:e2e`) but is **not** wired into the staging/PR pipeline yet.

- [x] **[L]** Setup Vitest for unit tests
- [x] **[L]** Write auth tests
- [x] **[L]** Write RBAC tests
- [~] **[XL]** Write API integration tests _(broad unit/service coverage; ongoing)_
- [x] **[L]** Setup Playwright for E2E
- [~] **[XL]** Write E2E tests for critical flows _(suite exists; not run in CI)_
  - [~] Login flow
  - [~] Leave request flow
  - [~] Expense submission flow

### 10.5 Data Migration

- [ ] **[M]** Create demo data export script
- [ ] **[M]** Create data transformation script
- [ ] **[M]** Create data import script
- [ ] **[L]** Test data migration

---

## Phase 11: Deployment

### 11.1 Docker Setup

- [x] **[M]** Create `Dockerfile.web`
- [x] **[M]** Create `Dockerfile.api`
- [x] **[M]** Create `docker-compose.yml`
  - [x] Frontend service
  - [x] Backend service
  - [x] PostgreSQL service (local dev)
- [x] **[S]** Create `.dockerignore` files
- [x] **[M]** Test local Docker deployment

### 11.2 CI/CD

> GitHub Actions: `pr-checks.yml` (type-check + lint + test + brand-drift on PRs to main/dev),
> `deploy.yml` (push to `main` → migrate-deploy → build → Cloud Run), `deploy-staging.yml`
> (push to `dev` → `db:push` → build → staging Cloud Run).

- [x] **[M]** Create GitHub Actions workflow
  - [x] Lint on PR
  - [x] Test on PR
  - [x] Build + deploy on merge
- [x] **[M]** Setup Docker image build (Artifact Registry, per-target change detection)
- [x] **[M]** Setup deployment pipeline (prod + staging, WIF auth, retry-on-propagation)

### 11.3 GCP Setup

> Live on project `tbh-nexora`, region `asia-southeast1`. See `docs/GCP_DEPLOYMENT.md`.

- [x] **[M]** Create GCP project (`tbh-nexora`)
- [x] **[M]** Setup Cloud Run for API (`nexora-api` + `nexora-api-staging`)
- [x] **[M]** Setup Cloud Run for Web (`nexora-web` + `nexora-web-staging`)
- [-] **[M]** Setup Cloud SQL _(not used — DB is Supabase Postgres, Singapore)_
- [x] **[S]** Setup Cloud Storage bucket _(Supabase Storage buckets; see CLAUDE.md)_
- [-] **[M]** Configure Nginx/Load Balancer _(Cloud Run serves directly; not needed)_
- [x] **[M]** Setup domain and SSL (`manut.xyz`)
- [x] **[S]** Configure environment variables (`--set-env-vars` from GitHub Secrets)

### 11.4 Monitoring

- [ ] **[S]** Setup error tracking (Sentry) _(not integrated)_
- [~] **[S]** Setup performance monitoring _(PostHog product analytics + telemetry sync wired; no APM)_
- [ ] **[S]** Setup uptime monitoring
- [x] **[S]** Create health check endpoints _(health module — Phase 1.5)_

### 11.5 Documentation

- [x] **[M]** Create deployment documentation
- [x] **[M]** Create API documentation
- [x] **[S]** Create user guide
- [x] **[S]** Create admin guide

---

## Summary

### Phase Overview

| Phase     | Description           | Est. Tasks     |
| --------- | --------------------- | -------------- |
| 0         | Project Setup         | 25             |
| 1         | Core Infrastructure   | 35             |
| 2         | Authentication & RBAC | 30             |
| 3         | Core Modules          | 20             |
| 4         | HR Modules            | 50             |
| 5         | Finance Modules       | 35             |
| 6         | Operations Modules    | 30             |
| 7         | Communication Modules | 25             |
| 8         | Investor Modules      | 25             |
| 9         | System Modules        | 15             |
| 10        | Integration & Testing | 25             |
| 11        | Deployment            | 25             |
| **Total** |                       | **~340 tasks** |

### Priority Modules

For initial MVP, focus on these modules in order:

1. **Authentication & RBAC** - Foundation for everything
2. **Home Dashboard** - Landing experience
3. **Directory** - Employee lookup
4. **Leave Management** - High usage HR feature
5. **Expenses** - Finance essentials
6. **Messaging** - Team communication
7. **Accounting** - Core finance

### Dependencies

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► All other phases
                           │
                           ├──► Phase 3 (Core)
                           ├──► Phase 4 (HR)
                           ├──► Phase 5 (Finance)
                           ├──► Phase 6 (Operations)
                           ├──► Phase 7 (Communication)
                           ├──► Phase 8 (Investor)
                           └──► Phase 9 (System)
                                      │
                                      ▼
                              Phase 10 (Testing)
                                      │
                                      ▼
                              Phase 11 (Deployment)
```

---

## Related Documents

- [Project Overview](./PROJECT_OVERVIEW.md)
- [Modules Specification](./MODULES_SPECIFICATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Authentication & RBAC](./AUTH_RBAC.md)
- [API Specification](./API_SPECIFICATION.md)
- [Design System](./DESIGN_SYSTEM.md)
