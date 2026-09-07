# Intranet - Project Overview

> **Intranet** is an enterprise resource planning (ERP) and internal operations platform for Manut. This document describes the production rebuild of the demo portal into a scalable, maintainable system.

---

## Table of Contents

1. [Project Description](#project-description)
2. [Goals & Objectives](#goals--objectives)
3. [Tech Stack](#tech-stack)
4. [Architecture Overview](#architecture-overview)
5. [Monorepo Structure](#monorepo-structure)
6. [Development Principles](#development-principles)

---

## Project Description

Intranet is designed to replace Zoho as TBH's primary internal operations platform. It consolidates multiple business functions into a single, unified system:

- **Human Resources**: Employee management, leave, payroll, benefits, onboarding, learning, recognition certificates
- **Finance**: A full Thai accounting suite (GL posting engine, AR/AP, tax filings, bank reconciliation, fixed assets), expenses, cash advances, revenue analytics, multi-entity bookkeeping
- **Operations**: Project management with a linear approval workflow and configurable approval chains, office/desk booking, immigration tracking
- **Sales & Partnerships**: CRM for sales deals and telecom partner relationships, plus an independent Sales Revenue CRM and a family of board CRMs (IT, Legal, QA, Product, Accounting, Voucher)
- **Marketing**: OneWave engagement analytics over the external BNII Analytics API — DAU/MAU exhibits, traffic, partner workspaces, and a daily drift check
- **Investor Relations**: Cap table management, investor CRM, data room, updates
- **Communication**: Internal messaging, company wall, news, AI assistant (ARIA) with document, image, audio and video attachments

The system supports **multi-entity operations** across eight entities — Thailand, UAE, Singapore, Portugal, India, Indonesia, Vietnam and Bangladesh — each with its own reporting currency, localized payroll calculations and compliance requirements. A **multi-company membership** layer lets one person belong to several companies and switch between them.

---

## Goals & Objectives

### Primary Goals

1. **Replace Zoho** - Full feature parity with current Zoho usage plus TBH-specific modules
2. **Production-Ready** - Scalable, secure, maintainable codebase for long-term use
3. **Unified Experience** - Single platform for all internal operations
4. **Role-Based Access** - Granular permissions matching organizational structure

### Technical Objectives

1. **Type Safety** - Strict TypeScript with minimal `any`/`unknown`
2. **Code Quality** - Consistent ESLint rules across frontend and backend
3. **Scalability** - Monorepo architecture for shared code and independent deployments
4. **Security** - Supabase Auth with the JWT in an httpOnly cookie (`credentials: "include"`), RBAC enforcement
5. **Maintainability** - Clear separation of concerns, documented APIs, comprehensive tests

---

## Tech Stack

### Source Management

| Tool          | Version | Purpose               |
| ------------- | ------- | --------------------- |
| **Turborepo** | Latest  | Monorepo build system |
| **pnpm**      | 10.x    | Package manager       |
| **Git**       | -       | Version control       |

### Frontend (`apps/web`)

| Technology          | Version | Purpose                         |
| ------------------- | ------- | ------------------------------- |
| **Next.js**         | 15.x    | React framework with App Router |
| **React**           | 19.x    | UI library                      |
| **TypeScript**      | 5.x     | Type safety                     |
| **Tailwind CSS**    | 4.x     | Utility-first CSS               |
| **shadcn/ui**       | Latest  | Component library (Radix-based) |
| **fetch API**       | Native  | HTTP client (`api-client.ts` wrapper) |
| **React Context**   | -       | State management (AuthProvider, etc.) |
| **Zod**             | 3.x     | Schema validation               |

### Backend (`apps/api`)

| Technology     | Version | Purpose                       |
| -------------- | ------- | ----------------------------- |
| **Express.js** | 5.x     | HTTP server framework         |
| **TypeScript** | 5.x     | Type safety                   |
| **Prisma**     | 6.x     | ORM and database toolkit      |
| **Supabase**   | Latest  | Auth, Storage, Realtime       |
| **Zod**        | 3.x     | Request/response validation   |
| **Winston**    | 3.x     | Logging                       |
| **Helmet**     | 8.x     | Security headers              |
| **CORS**       | 2.x     | Cross-origin resource sharing |

### Database

| Technology     | Purpose                                |
| -------------- | -------------------------------------- |
| **PostgreSQL** | Primary database (via Supabase)        |
| **Prisma**     | Schema management, migrations, queries |

### Authentication & Authorization

| Technology        | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| **Supabase Auth** | User authentication (email/password)                |
| **Custom RBAC**   | Role-based access control with granular permissions |
| **JWT**           | Session tokens (managed by Supabase)                |

### Deployment

| Technology                | Purpose                         |
| ------------------------- | ------------------------------- |
| **Docker**                | Containerization                |
| **Nginx**                 | Reverse proxy, load balancing   |
| **Google Cloud Platform** | Cloud infrastructure            |
| **Cloud Run**             | Serverless container deployment |
| **Cloud SQL**             | Managed PostgreSQL (optional)   |

### Development Tools

| Tool            | Purpose            |
| --------------- | ------------------ |
| **ESLint**      | Code linting       |
| **Prettier**    | Code formatting    |
| **Husky**       | Git hooks          |
| **lint-staged** | Pre-commit linting |
| **Vitest**      | Unit testing       |
| **Playwright**  | E2E testing        |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TURBOREPO MONOREPO                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        apps/                                 │   │
│  │  ┌─────────────────┐         ┌─────────────────┐            │   │
│  │  │    apps/web     │         │    apps/api     │            │   │
│  │  │   (Next.js)     │ ──────► │   (Express)     │            │   │
│  │  │                 │  HTTP   │                 │            │   │
│  │  │  - App Router   │         │  - REST API     │            │   │
│  │  │  - React 19     │         │  - Middleware   │            │   │
│  │  │  - Tailwind     │         │  - Services     │            │   │
│  │  │  - shadcn/ui    │         │  - Repos        │            │   │
│  │  └─────────────────┘         └────────┬────────┘            │   │
│  └───────────────────────────────────────┼─────────────────────┘   │
│                                          │                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      packages/                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │   │
│  │  │ database │  │  types   │  │    ui    │  │  utils   │    │   │
│  │  │ (Prisma) │  │ (Shared) │  │(shadcn)  │  │ (Common) │    │   │
│  │  └────┬─────┘  └──────────┘  └──────────┘  └──────────┘    │   │
│  └───────┼─────────────────────────────────────────────────────┘   │
│          │                                                         │
└──────────┼─────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   PostgreSQL    │  │    Supabase     │  │   Anthropic     │     │
│  │   (Database)    │  │  Auth/Storage   │  │   (ARIA AI)     │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

### Other external dependencies

Beyond Postgres, Supabase and the AI providers above:

| Service | Used by | Failure behaviour |
|---|---|---|
| **BNII Analytics API** | Marketing Analytics; the OneWave ingest | Unauthenticated HTTP. A flaky read yields an empty or partial result and never throws — a bad upstream day leaves the last good snapshot in place rather than blanking the dashboard |
| **Bank of Thailand FX** | Expenses, Accounting multi-currency | Daily `<CUR>` → THB sync. No-ops without `BOT_API_CLIENT_ID`; a fallback provider covers gaps |
| **Email service** | Every notification path | Never throws to the caller. A missing `templateId` fails silently upstream, which is why new emails reuse already-registered templates |

### Scheduled work

An `/api/cron/*` surface, gated by a shared `X-Cron-Secret` header and driven
by Cloud Scheduler jobs provisioned by hand. Jobs are written to be
**idempotent and debounced** — re-running one is always safe, and each keeps
its own marker (a `reminders_sent` array, a fingerprint, a status transition)
so a repeat run does not re-notify. Not every cron endpoint has a scheduler
job; see the README for the current fleet.

                              DEPLOYMENT
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│     ┌──────────┐      ┌──────────────┐      ┌──────────────┐       │
│     │  Nginx   │ ───► │  Cloud Run   │ ───► │  Cloud Run   │       │
│     │ (Proxy)  │      │  (apps/web)  │      │  (apps/api)  │       │
│     └──────────┘      └──────────────┘      └──────────────┘       │
│                                                                     │
│                        Google Cloud Platform                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Authentication Flow**
   - User submits credentials to frontend
   - Frontend authenticates with Supabase Auth and posts the token to `/api/auth/session`
   - Backend sets the JWT as an httpOnly cookie
   - Subsequent calls forward the cookie automatically (`credentials: "include"`)

2. **API Request Flow**
   - Frontend sends the request with its session cookie (no manual Authorization header)
   - Backend middleware validates the JWT via Supabase and resolves the Prisma user + roles + permissions
   - Backend checks RBAC permissions
   - Backend executes business logic via Prisma
   - Response returned to frontend

3. **Real-time Updates**
   - Messaging runs over Socket.IO (WebSocket at `/socket.io/`, see `apps/api/src/modules/messages/messages.socket.ts`)
   - The notification bell is a server read-model polled from the dashboard stats payload (no Supabase Realtime / `Notification` table)

---

## Monorepo Structure

```
nexora/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/                 # App Router pages
│   │   │   ├── components/          # React components
│   │   │   ├── hooks/               # Custom hooks
│   │   │   ├── lib/                 # Utilities
│   │   │   ├── providers/           # Context providers
│   │   │   └── styles/              # Global styles
│   │   ├── public/                  # Static assets
│   │   └── package.json
│   │
│   └── api/                          # Express backend (Clean Architecture)
│       ├── src/
│       │   ├── modules/             # Feature modules (NestJS-style)
│       │   │   ├── auth/
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── auth.repository.ts
│       │   │   │   ├── auth.validation.ts
│       │   │   │   ├── auth.types.ts
│       │   │   │   └── index.ts
│       │   │   ├── users/
│       │   │   │   ├── users.controller.ts
│       │   │   │   ├── users.service.ts
│       │   │   │   ├── users.repository.ts
│       │   │   │   ├── users.validation.ts
│       │   │   │   ├── users.types.ts
│       │   │   │   └── index.ts
│       │   │   ├── leave/
│       │   │   ├── payroll/
│       │   │   ├── expenses/
│       │   │   ├── accounting/
│       │   │   ├── projects/
│       │   │   ├── partners/
│       │   │   ├── messages/
│       │   │   ├── investors/
│       │   │   ├── office/
│       │   │   ├── aria/
│       │   │   ├── benefits/
│       │   │   ├── blogs/
│       │   │   ├── articles/
│       │   │   ├── deals/
│       │   │   ├── directory/
│       │   │   ├── dataroom/
│       │   │   ├── investor-updates/
│       │   │   ├── revenue/
│       │   │   ├── visa/
│       │   │   ├── learning/
│       │   │   ├── survey-forms/
│       │   │   ├── dashboard/
│       │   │   └── uploads/       # 99 modules total (attendance lives inside hrms/)
│       │   │
│       │   ├── core/                # Core/shared functionality
│       │   │   ├── middleware/      # Auth, RBAC, error handling
│       │   │   ├── guards/          # Permission guards
│       │   │   ├── decorators/      # Custom decorators
│       │   │   ├── filters/         # Exception filters
│       │   │   ├── interceptors/    # Request/response interceptors
│       │   │   └── pipes/           # Validation pipes
│       │   │
│       │   ├── common/              # Common utilities
│       │   │   ├── constants/       # App constants, permissions
│       │   │   ├── types/           # Shared types
│       │   │   ├── utils/           # Helper functions
│       │   │   └── exceptions/      # Custom exceptions
│       │   │
│       │   ├── config/              # Configuration
│       │   │   ├── env.config.ts
│       │   │   ├── database.config.ts
│       │   │   └── supabase.config.ts
│       │   │
│       │   ├── infrastructure/      # External services
│       │   │   ├── database/        # Prisma client
│       │   │   ├── supabase/        # Supabase clients
│       │   │   ├── storage/         # Supabase Storage (signed URLs)
│       │   │   ├── email/           # Email service
│       │   │   ├── ai/              # Gemini + Anthropic clients
│       │   │   └── soft-delete.ts   # excludeDeleted / softDeleteUpdate helpers
│       │   │
│       │   ├── app.ts               # Express app setup
│       │   └── main.ts              # Entry point
│       │
│       └── package.json
│
├── packages/
│   ├── database/                    # Prisma schema & client
│   │   ├── prisma/
│   │   │   ├── schema/             # Split schema files
│   │   │   ├── migrations/         # Migration files
│   │   │   └── seed.ts             # Seed data
│   │   └── package.json
│   │
│   ├── types/                       # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── api/                # API DTOs
│   │   │   ├── models/             # Domain models
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/                          # Shared UI components
│   │   ├── src/
│   │   │   ├── components/         # shadcn/ui components
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── utils/                       # Shared utilities
│       ├── src/
│       └── package.json
│
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.api
│   └── docker-compose.yml
│
├── docs/                            # Documentation
│
├── turbo.json                       # Turborepo config
├── pnpm-workspace.yaml              # pnpm workspace config
├── package.json                     # Root package.json
├── tsconfig.json                    # Base TypeScript config
├── eslint.config.mjs                # ESLint config
└── .prettierrc                      # Prettier config
```

### Backend Module Structure (Clean Architecture)

Each module follows the same structure, keeping all related code together:

```
modules/leave/
├── leave.controller.ts    # HTTP handlers (routes)
├── leave.service.ts       # Business logic
├── leave.repository.ts    # Database operations
├── leave.validation.ts    # Zod schemas for request/response
├── leave.types.ts         # Module-specific types
├── leave.constants.ts     # Module constants (optional)
└── index.ts               # Module exports & route registration
```

**Benefits of Module-based Architecture:**

1. **High Cohesion** - All related code in one place
2. **Easy Navigation** - Find everything about a feature in one folder
3. **Independent Development** - Teams can work on modules independently
4. **Clear Dependencies** - Easy to see what a module depends on
5. **Testability** - Each module can be tested in isolation
6. **Scalability** - Easy to add new modules without touching others

---

## Development Principles

### 1. Type Safety First

- **No `any` types** - Use proper typing or `unknown` with type guards
- **Strict mode** - Enable all strict TypeScript checks
- **Zod validation** - Runtime type checking for all external data
- **Generated types** - Use Prisma-generated types for database models

### 2. Code Organization (Clean Architecture)

- **Module-based structure** - Group by feature/domain, not by layer (like NestJS)
- **Controller → Service → Repository** - Clear separation within each module
- **Core module** - Shared middleware, guards, filters, interceptors
- **Infrastructure layer** - External service adapters (DB, Auth, Storage, AI)
- **Dependency Injection** - Services injected into controllers
- **Shared packages** - Common code in monorepo packages

### 3. API Design

- **RESTful conventions** - Standard HTTP methods and status codes
- **Consistent DTOs** - Zod schemas for request/response
- **Error handling** - Standardized error responses
- **Pagination** - Cursor-based for large datasets

### 4. Security

- **Server-side auth** - No direct Supabase calls from frontend for auth
- **RBAC middleware** - Permission checks on all protected routes
- **Input validation** - Validate all user input
- **SQL injection prevention** - Parameterized queries via Prisma

### 5. Testing

- **Unit tests** - Business logic and utilities
- **Integration tests** - API endpoints
- **E2E tests** - Critical user flows
- **Coverage targets** - Minimum 80% for critical paths

---

## Related Documents

- [Modules Specification](./MODULES_SPECIFICATION.md)
- [Marketing Analytics](./MARKETING_ANALYTICS.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Authentication & RBAC](./AUTH_RBAC.md)
- [API Specification](./API_SPECIFICATION.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Task Planning](./TASK_PLANNING.md)
