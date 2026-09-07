# Intranet - Authentication & RBAC

> Complete specification for authentication using Supabase Auth and Role-Based Access Control (RBAC) system, cloned from crm.manut.xyz architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Architecture](#authentication-architecture)
3. [Supabase Auth Integration](#supabase-auth-integration)
4. [RBAC Data Model](#rbac-data-model)
5. [Permission System](#permission-system)
6. [Implementation Guide](#implementation-guide)
7. [API Security](#api-security)
8. [Frontend Integration](#frontend-integration)

---

## Overview

### Key Principles

1. **Backend-Only Auth** - All Supabase Auth operations happen on the backend, not direct client calls
2. **Granular Permissions** - Permission codes in `module:action` format
3. **Multiple Roles** - Users can have multiple roles, permissions are merged
4. **Server Enforcement** - All API routes enforce permissions via middleware
5. **UI Filtering** - Frontend filters UI elements based on user permissions (defense in depth)

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
├─────────────────────────────────────────────────────────────────┤
│  - Session held in httpOnly Supabase cookies (no localStorage)  │
│  - Cookies sent automatically on every API request              │
│  - Permissions loaded from /api/auth/me into React AuthProvider │
│  - No direct Supabase Auth calls from the browser               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express)                         │
├─────────────────────────────────────────────────────────────────┤
│  Middleware Stack:                                               │
│  1. authenticate()          - Verify cookie via Supabase SSR;   │
│                               sets req.user with permissions:[] │
│  2. requireActive()         - Check user.isActive in Prisma     │
│  3a. requirePermission(p)   - Gate + lazy-load permissions      │
│  3b. ensurePermissionsLoaded(req) - Explicit load for routes    │
│       that gate inside the service rather than at the route     │
├─────────────────────────────────────────────────────────────────┤
│  Auth Service:                                                   │
│  - Login: Supabase signInWithPassword (cookie set by SSR lib)   │
│  - Create User: Supabase Admin createUser                       │
│  - Reset Password: Supabase Admin updateUserById                │
│  - Session: Managed via Supabase SSR cookies                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│     Supabase Auth       │   │    PostgreSQL (Prisma)  │
├─────────────────────────┤   ├─────────────────────────┤
│  - User credentials     │   │  - User profile data    │
│  - JWT tokens           │   │  - Roles & permissions  │
│  - Session management   │   │  - Business data        │
└─────────────────────────┘   └─────────────────────────┘
```

---

## Authentication Architecture

### Auth Flow: Login

```
1. User submits email/password to frontend
2. Frontend POST /api/auth/login with credentials
3. Backend calls Supabase signInWithPassword
4. If success:
   a. Check user.isActive in Prisma
   b. If inactive, return 403
   c. Load user profile with roles/permissions
   d. Return JWT + user data + permissions
5. Frontend stores JWT, redirects to dashboard
```

### Auth Flow: Create User (Admin)

```
1. Admin fills user creation form
2. Frontend POST /api/admin/users with user data
3. Backend validates admin has user:create permission
4. Backend calls Supabase Admin createUser
5. Backend creates User record in Prisma with:
   - id = Supabase user id (UUID)
   - Profile data (name, email, department, etc.)
   - Default role (Employee)
   - mustChangePassword = true
6. Backend sends welcome email with temp password
7. User logs in, sees change password screen
```

### Auth Flow: Password Change

```
1. User submits current + new password
2. Frontend POST /api/auth/change-password
3. Backend verifies current password via Supabase signInWithPassword
4. Backend calls Supabase Admin updateUserById with new password
5. Backend sets mustChangePassword = false in Prisma
6. Return success
```

### Session Management

- **JWT Lifespan**: Managed by Supabase (default 1 hour with auto-refresh)
- **Token Storage**: httpOnly Supabase session cookies (set by `@supabase/ssr` `createServerClient`). No `localStorage` usage; no `Authorization: Bearer` header needed.
- **Refresh**: The `@supabase/ssr` server client reads + refreshes the session cookie transparently on each request. The frontend `AuthProvider` also calls `/api/auth/me` on mount, focus-return, and via a periodic timer.
- **Logout**: `POST /api/auth/logout` signs out via the Supabase server client (clears the cookie); `AuthProvider` clears React state.
- **Cron auth**: Cron endpoints use `X-Cron-Secret` header checked by `verifyCronSecret` middleware instead of Supabase cookies.

---

## Supabase Auth Integration

### Environment Variables

```env
# Public (available to frontend)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-only
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Supabase Client Setup

> **Corrected 2026-08-26.** This section used to document a browser Supabase
> client (`packages/database/src/supabase/client.ts`) and an Express
> server-with-cookies client (`apps/api/src/lib/supabase/server.ts`). **Neither
> file exists**, and the design they describe is not the one that shipped.
>
> What actually happens: **Supabase Auth is a backend-only dependency.**
> `apps/web` contains **zero** `@supabase/*` imports — the browser never holds a
> Supabase session. The API calls Supabase Auth server-side, then issues its own
> httpOnly cookies (`nexora_access_token` / `nexora_refresh_token`, cleared in
> `apps/api/src/modules/auth/auth.controller.ts`), and the browser carries only
> those. The entire Supabase surface in the codebase is
> `apps/api/src/infrastructure/supabase/` — `admin.ts` (below) plus
> `auth-errors.ts`.
>
> That is why swapping the identity provider is contained: nine call sites, all
> server-side. They are enumerated in
> [`docs/migration/06-infrastructure-inventory.md`](migration/06-infrastructure-inventory.md) §2b.

#### apps/api/src/infrastructure/supabase/admin.ts (Service Role)

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
```

---

## RBAC Data Model

### Schema (from DATABASE_SCHEMA.md)

```prisma
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

model RolePermission {
  roleId         String @map("role_id") @db.Uuid
  permissionCode String @map("permission_code") @db.VarChar(100)

  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionCode])
  @@map("role_permissions")
}

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
```

### System Roles (Seed Data)

| Role                   | isSystem | Description                           |
| ---------------------- | -------- | ------------------------------------- |
| **Admin**              | true     | Full system access, all 271 permissions |
| **HR Manager**         | true     | HR operations, leave/payroll approval |
| **Accounting Manager** | true     | Financial operations, journal posting |
| **Manager**            | true     | Team management, approvals            |
| **Employee**           | true     | Self-service access                   |
| **Content Manager**    | false    | News, blog, PR management             |
| **IT Admin**           | false    | System administration                 |

### User-Role Assignment

- Users can have **multiple roles**
- Permissions are **merged** from all assigned roles
- `ModuleAccess` provides per-user **overrides** (grant or deny)
- `isSystem` roles cannot be deleted

---

## Permission System

### Permission Code Format

```
{module}:{action}

Examples:
- leave:read        - View leave data
- leave:create      - Submit leave requests
- leave:approve     - Approve leave requests
- leave:hr-read     - View all leave (HR scope)
```

### Permission List

> **Coverage, measured 2026-08-26:** `apps/api/src/common/constants/permissions.ts`
> defines **271** permission codes. This list enumerates **104** of them, so
> roughly two thirds are undocumented — treat `permissions.ts` as the source of
> truth and this section as a partial guide.
>
> Five codes below have been **retired from the code** but are still listed here:
> `survey:analytics`, `survey:export-raw`, `survey:export-scores`,
> `survey:upload`, `survey:view-jobs`. Retiring a permission without either an
> alias or a `DELETE FROM role_permissions` migration leaves orphan rows that
> make role editing fail with a 422 — see the "retire-a-perm checklist" in
> `CLAUDE.md`.
>
> Closing this gap by hand is a losing game at this scale; generating it is
> tracked in [`docs/DOCS_PLAN.md`](DOCS_PLAN.md).


#### Workspace

| Code          | Description           |
| ------------- | --------------------- |
| `home:read`   | View home dashboard   |
| `wall:create` | Create wall posts     |
| `wall:delete` | Delete any wall post  |
| `news:create` | Create company news   |
| `news:delete` | Delete company news   |
| `aria:use`    | Access ARIA assistant |
| `aria:parse`  | Use document parsing  |

#### Messaging

| Code              | Description                 |
| ----------------- | --------------------------- |
| `messages:read`   | View channels and messages  |
| `messages:create` | Send messages               |
| `messages:delete` | Delete own messages         |
| `messages:admin`  | Manage channels, delete any |

#### Projects

| Code               | Description     |
| ------------------ | --------------- |
| `projects:read`    | View projects   |
| `projects:create`  | Create projects |
| `projects:update`  | Update projects |
| `projects:delete`  | Delete projects |

#### Partners

| Code              | Description     |
| ----------------- | --------------- |
| `partners:read`   | View partners   |
| `partners:create` | Create partners |
| `partners:update` | Update partners |
| `partners:delete` | Delete partners |

#### Deals (Sales CRM)

| Code           | Description  |
| -------------- | ------------ |
| `deals:read`   | View deals   |
| `deals:create` | Create deals |
| `deals:update` | Update deals |
| `deals:delete` | Delete deals |

#### Leave Management

| Code            | Description             |
| --------------- | ----------------------- |
| `leave:read`    | View own leave          |
| `leave:create`  | Submit leave requests   |
| `leave:hr-read` | View all leave requests |
| `leave:approve` | Approve/reject requests |

#### Payroll

| Code               | Description          |
| ------------------ | -------------------- |
| `payroll:read`     | View payroll data    |
| `payroll:create`   | Create payroll runs  |
| `payroll:approve`  | Approve payroll runs |
| `payroll:hr-admin` | Full payroll admin   |

#### HRMS

| Code                     | Description        |
| ------------------------ | ------------------ |
| `hrms:read`              | View HRMS data     |
| `hrms:esop-manage`       | Manage ESOP grants |
| `hrms:onboarding-manage` | Manage onboarding  |

#### Survey

Covers both the in-platform Survey Forms builder and the `.xlsx` pulse-survey
module (`SurveyDefinition` / `SurveyWave`).

| Code                   | Description                       |
| ---------------------- | --------------------------------- |
| `survey:manage-wave`   | Create / edit / archive a survey wave |
| `survey:upload`        | Upload `.xlsx` & commit responses |
| `survey:analytics`     | View the analytics dashboard      |
| `survey:export-scores` | Export section / question scores  |
| `survey:export-raw`    | Export raw anonymized data        |
| `survey:view-jobs`     | View upload history (audit trail) |

#### Benefits

| Code              | Description        |
| ----------------- | ------------------ |
| `benefits:read`   | View benefits      |
| `benefits:manage` | Manage catalog     |
| `benefits:enroll` | Manage enrollments |

#### Learning

| Code                | Description           |
| ------------------- | --------------------- |
| `learning:read`     | View training modules |
| `learning:complete` | Mark completions      |
| `learning:manage`   | Manage catalog        |
| `learning:hr-read`  | View all completions  |

#### Visa

| Code           | Description           |
| -------------- | --------------------- |
| `visa:read`    | View own visa info    |
| `visa:hr-read` | View all visa records |
| `visa:manage`  | Create/update records |

#### Office

| Code            | Description                |
| --------------- | -------------------------- |
| `office:read`   | View offices               |
| `office:book`   | Make bookings              |
| `office:manage` | Manage offices/desks/rooms |

#### Directory

| Code                       | Description         |
| -------------------------- | ------------------- |
| `directory:read`           | View directory      |
| `directory:view-sensitive` | View sensitive info |

#### Investors

| Code                 | Description                 |
| -------------------- | --------------------------- |
| `investors:read`     | View team-visible investors |
| `investors:read-all` | View CEO-only investors     |
| `investors:create`   | Create investors            |
| `investors:update`   | Update investors            |
| `investors:delete`   | Delete investors            |

#### Investor Relations

| Code                      | Description             |
| ------------------------- | ----------------------- |
| `investor-dashboard:read` | View investor dashboard |
| `investor-crm:read`       | View investor CRM       |
| `investor-crm:manage`     | Manage interactions     |
| `dataroom:read`           | View data room          |
| `dataroom:upload`         | Upload documents        |
| `dataroom:manage`         | Manage all documents    |
| `investor-updates:read`   | View updates            |
| `investor-updates:create` | Create updates          |
| `investor-updates:send`   | Send updates            |

#### Revenue Analytics

| Code           | Description            |
| -------------- | ---------------------- |
| `revenue:read` | View revenue analytics |

#### Accounting

| Code                 | Description              |
| -------------------- | ------------------------ |
| `accounting:read`    | View accounting data     |
| `accounting:create`  | Create journals/invoices |
| `accounting:approve` | Approve journals         |
| `accounting:post`    | Post journals            |
| `accounting:admin`   | Full accounting access   |

#### Expenses

| Code               | Description             |
| ------------------ | ----------------------- |
| `expenses:read`    | View own expenses       |
| `expenses:create`  | Submit expenses         |
| `expenses:hr-read` | View all expenses       |
| `expenses:approve` | Approve/reject expenses |

#### Blog Management

| Code          | Description       |
| ------------- | ----------------- |
| `blog:read`   | View blog posts   |
| `blog:create` | Create blog posts |
| `blog:update` | Edit blog posts   |
| `blog:delete` | Delete blog posts |

#### PR Management

| Code        | Description        |
| ----------- | ------------------ |
| `pr:read`   | View PR articles   |
| `pr:create` | Create PR articles |
| `pr:update` | Edit PR articles   |
| `pr:delete` | Delete PR articles |

#### Admin

| Code              | Description       |
| ----------------- | ----------------- |
| `admin:read`      | View admin panel  |
| `admin:audit-log` | View audit logs   |
| `admin:manage`    | Full admin access |

#### Access Control

| Code                  | Description           |
| --------------------- | --------------------- |
| `access-control:read` | View access control   |
| `role:read`           | View roles            |
| `role:create`         | Create roles          |
| `role:update`         | Update roles          |
| `role:delete`         | Delete roles          |
| `user:read`           | View users            |
| `user:create`         | Create users          |
| `user:update`         | Update users          |
| `user:delete`         | Delete users          |
| `user:assign-role`    | Assign roles to users |

### Role Permission Mapping (Seed)

```typescript
const ROLE_PERMISSIONS = {
  Admin: ALL_PERMISSION_CODES, // All 271 permissions

  "HR Manager": [
    "home:read",
    "directory:read",
    "directory:view-sensitive",
    "leave:read",
    "leave:create",
    "leave:hr-read",
    "leave:approve",
    "payroll:read",
    "payroll:create",
    "payroll:approve",
    "payroll:hr-admin",
    "hrms:read",
    "hrms:esop-manage",
    "hrms:onboarding-manage",
    "benefits:read",
    "benefits:manage",
    "benefits:enroll",
    "learning:read",
    "learning:manage",
    "learning:hr-read",
    "visa:read",
    "visa:hr-read",
    "visa:manage",
    "expenses:read",
    "expenses:hr-read",
    "expenses:approve",
    "messages:read",
    "messages:create",
    "wall:create",
  ],

  "Accounting Manager": [
    "home:read",
    "accounting:read",
    "accounting:create",
    "accounting:approve",
    "accounting:post",
    "accounting:admin",
    "expenses:read",
    "expenses:hr-read",
    "expenses:approve",
    "revenue:read",
    "payroll:read",
    "messages:read",
    "messages:create",
  ],

  Manager: [
    "home:read",
    "directory:read",
    "leave:read",
    "leave:create",
    "leave:approve",
    "expenses:read",
    "expenses:create",
    "expenses:approve",
    "projects:read",
    "projects:create",
    "projects:update",
    "messages:read",
    "messages:create",
    "wall:create",
  ],

  Employee: [
    "home:read",
    "directory:read",
    "leave:read",
    "leave:create",
    "expenses:read",
    "expenses:create",
    "learning:read",
    "learning:complete",
    "visa:read",
    "office:read",
    "office:book",
    "messages:read",
    "messages:create",
    "wall:create",
    "aria:use",
  ],
};
```

---

## Implementation Guide

### `authenticate` permissions footgun

`authenticate` populates `req.user` with `permissions: []` — an empty array — for performance. Permissions are only loaded lazily when `requirePermission(...)` runs or when `ensurePermissionsLoaded(req)` is called explicitly.

**This is a footgun for service-authorized routes.** Any route that omits `requirePermission(...)` and instead calls `req.user.permissions` inside the service (for "owner vs admin" branching) will see an empty array unless you add an explicit `ensurePermissionsLoaded` call.

```typescript
// BROKEN — HR user sees own-records-only scope because permissions stayed []
router.get("/", asyncHandler(async (req, res) => {
  const data = await myService.list(req.user!.id, req.user!.permissions); // [] !
  res.json(data);
}));

// CORRECT — explicitly load before branching on permissions
router.get("/", asyncHandler(async (req, res) => {
  await ensurePermissionsLoaded(req);
  const data = await myService.list(req.user!.id, req.user!.permissions); // loaded
  res.json(data);
}));
```

### System Admin bypass

`resolvePermissions` in `auth.service.ts` short-circuits for any user whose role has `isSystem = true` **and** `name = "Admin"`. That user receives every permission code. Do NOT replicate this check in route guards — only the resolver applies it. Check `CLAUDE.md` "System Admin role" for the canonical test.

### Owner-or-HR restore / remove rule (soft delete)

Several request-style models are **soft-deleted** (a nullable `deletedAt`
column — see `DATABASE_SCHEMA.md` → "Soft Delete"). Delete sets the timestamp;
**restore** clears it; **permanent delete** removes the row. The route guard
alone can't express "the actor must be the row owner OR hold the module's
elevated perm", so the rule is enforced in the **service layer** after loading
permissions (`ensurePermissionsLoaded`), mirroring the owner-vs-admin pattern
in `CLAUDE.md` → "RBAC scoping conventions":

- Re-fetch the row **including deleted** (`findByIdIncludingDeleted`). A hit
  from the normal `findById` means it's still active → `409 Conflict`
  ("not deleted").
- Allow the action when `row.<owner> === actorId` **OR** the actor holds the
  module's elevated permission; otherwise `403` ("You can only restore your
  own …"). The "owner" is the employee/author field (`employeeId`, etc.).

The elevated permission is **per module** (not a single global one):

| Model / module        | Owner field  | Elevated perm that bypasses ownership |
| --------------------- | ------------ | ------------------------------------- |
| `LeaveRequest`        | `employeeId` | `leave:hr-read`                       |
| `TravelRequest`       | `employeeId` | `travel:hr-read`                      |
| `ExpenseReport`       | `employeeId` | `expense:hr-delete`                   |
| `CashAdvanceRequest`  | `employeeId` | `cash-advance:approve`                |

`VisaRecord` restore is gated at the route by `visa:manage` (HR-only, no owner
self-service branch). When adding a soft-delete restore endpoint, follow this
shape and add a test that the owner and an elevated-perm holder both succeed
while a third party gets `403`.

### `ensurePermissionsLoaded` audit

Audited routes that use `req.user.permissions` for service-level branching (not `requirePermission`):

| Module | Routes | Status |
|--------|--------|--------|
| HRMS Agreements | `GET /`, `GET /:id`, download | `ensurePermissionsLoaded` present |
| Expenses | `POST /reports/:id/approve`, `reject` | `ensurePermissionsLoaded` present |
| Travel | `PUT approve`, `PUT reject`, `POST forward` | `ensurePermissionsLoaded` present (#530) |
| Survey Forms | `GET /`, `GET /:id` | `ensurePermissionsLoaded` present (#534) |
| Payroll `/my-payslips` | `GET`, download | Scoped to `req.user.id` only; no permission branching — OK |
| Directory `/assignable` | `GET` | Intentionally no permission gate — public-ish user picker |

When adding a new service-authorized route, add a test verifying that an HR user gets the wider scope (not the fallback owner-only scope).

### Middleware Implementation

#### apps/api/src/core/guards/auth.guard.ts (actual file)

```typescript
import { Request, Response, NextFunction } from "express";
import { createClient } from "../lib/supabase/server";
import { prisma } from "@nexora/database";

// Types
interface AuthUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Authenticate: Verify JWT and load basic user
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const supabase = createClient(req, res);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Load user from Prisma
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    if (!profile) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = {
      ...profile,
      permissions: [],
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

// Require Active: Check user is active
export async function requireActive(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.user.isActive) {
    return res.status(403).json({
      error: "Account deactivated",
      deactivated: true,
    });
  }

  next();
}

// Load Permissions: Load all permissions for user
async function loadUserPermissions(userId: string): Promise<Set<string>> {
  const permissions = new Set<string>();

  // Get all roles with their permissions
  const userWithRoles = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: true,
            },
          },
        },
      },
      moduleAccessGrants: true,
    },
  });

  if (!userWithRoles) return permissions;

  // Collect permissions from all roles
  for (const userRole of userWithRoles.userRoles) {
    for (const rolePerm of userRole.role.rolePermissions) {
      permissions.add(rolePerm.permissionCode);
    }
  }

  // Apply module access overrides
  for (const access of userWithRoles.moduleAccessGrants) {
    if (access.granted) {
      permissions.add(`${access.moduleId}:access`);
    } else {
      // Remove module permissions if denied
      for (const perm of permissions) {
        if (perm.startsWith(`${access.moduleId}:`)) {
          permissions.delete(perm);
        }
      }
    }
  }

  return permissions;
}

// Require Permission: Check specific permission
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.user.isActive) {
      return res.status(403).json({
        error: "Account deactivated",
        deactivated: true,
      });
    }

    // Load permissions if not already loaded
    if (req.user.permissions.length === 0) {
      const perms = await loadUserPermissions(req.user.id);
      req.user.permissions = Array.from(perms);
    }

    const userPerms = new Set(req.user.permissions);

    // Check if user has ANY of the required permissions
    const hasPermission = requiredPermissions.some((perm) =>
      userPerms.has(perm),
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: "Permission denied",
        required: requiredPermissions,
      });
    }

    next();
  };
}

// Require All Permissions: Check ALL permissions (AND logic)
export function requireAllPermissions(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user.permissions.length === 0) {
      const perms = await loadUserPermissions(req.user.id);
      req.user.permissions = Array.from(perms);
    }

    const userPerms = new Set(req.user.permissions);

    const hasAll = requiredPermissions.every((perm) => userPerms.has(perm));

    if (!hasAll) {
      return res.status(403).json({
        error: "Permission denied",
        required: requiredPermissions,
      });
    }

    next();
  };
}
```

### Auth Service

#### apps/api/src/modules/auth/auth.service.ts

```typescript
import { supabaseAdmin } from "../lib/supabase/admin";
import { prisma } from "@nexora/database";
import { sendWelcomeEmail } from "./email.service";

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  entityId?: string;
  department?: string;
  jobTitle?: string;
  roleIds?: string[];
}) {
  // 1. Create Supabase user
  const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create auth user: ${error.message}`);
  }

  try {
    // 2. Create Prisma user with same ID
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          id: authUser.user.id,
          email: data.email,
          name: data.name,
          entityId: data.entityId,
          department: data.department,
          jobTitle: data.jobTitle,
          mustChangePassword: true,
          isActive: true,
        },
      });

      // Get Employee role (system default)
      const employeeRole = await tx.role.findFirst({
        where: { name: "Employee", isSystem: true },
      });

      // Assign roles
      const roleIds = data.roleIds || [];
      if (employeeRole && !roleIds.includes(employeeRole.id)) {
        roleIds.push(employeeRole.id);
      }

      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId: newUser.id,
          roleId,
        })),
      });

      return newUser;
    });

    // 3. Send welcome email
    await sendWelcomeEmail({
      email: data.email,
      name: data.name,
      tempPassword: data.password,
    });

    return user;
  } catch (err) {
    // Rollback: delete Supabase user if Prisma fails
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    throw err;
  }
}

export async function resetUserPassword(userId: string, newPassword: string) {
  // Update Supabase
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    throw new Error(`Failed to reset password: ${error.message}`);
  }

  // Set mustChangePassword flag
  await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: true },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  supabaseClient: any, // Server client with user session
) {
  // Verify current password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    throw new Error("Current password is incorrect");
  }

  // Update password via admin
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    throw new Error(`Failed to change password: ${error.message}`);
  }

  // Clear mustChangePassword
  await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: false },
  });
}

export async function deactivateUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
}

export async function deleteUser(userId: string) {
  // Delete from Prisma first (cascade will handle related records)
  await prisma.user.delete({
    where: { id: userId },
  });

  // Delete from Supabase
  await supabaseAdmin.auth.admin.deleteUser(userId);
}
```

### Route Examples

#### apps/api/src/modules/auth/auth.controller.ts

```typescript
import { Router } from "express";
import { z } from "zod";
import { createClient } from "../lib/supabase/server";
import { prisma } from "@nexora/database";
import { authenticate, requireActive } from "../middleware/auth";
import { changePassword } from "../services/auth.service";
import { createAuditLog } from "../services/audit.service";

const router = Router();

// Login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const supabase = createClient(req, res);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check user is active
    const user = await prisma.user.findUnique({
      where: { id: data.user.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (!user.isActive) {
      await supabase.auth.signOut();
      return res.status(403).json({
        error: "Account deactivated",
        deactivated: true,
      });
    }

    // Collect permissions
    const permissions = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissions.add(rp.permissionCode);
      }
    }

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: "login",
      resource: "auth",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        mustChangePassword: user.mustChangePassword,
      },
      permissions: Array.from(permissions),
      session: data.session,
    });
  } catch (err) {
    res.status(400).json({ error: "Login failed" });
  }
});

// Logout
router.post("/logout", authenticate, async (req, res) => {
  const supabase = createClient(req, res);
  await supabase.auth.signOut();

  await createAuditLog({
    userId: req.user!.id,
    action: "logout",
    resource: "auth",
  });

  res.json({ success: true });
});

// Get current user
router.get("/me", authenticate, requireActive, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      entity: true,
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const permissions = new Set<string>();
  for (const ur of user.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissions.add(rp.permissionCode);
    }
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      department: user.department,
      jobTitle: user.jobTitle,
      entity: user.entity,
      mustChangePassword: user.mustChangePassword,
    },
    permissions: Array.from(permissions),
  });
});

// Change password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(
      req.body,
    );
    const supabase = createClient(req, res);

    await changePassword(req.user!.id, currentPassword, newPassword, supabase);

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
```

---

## API Security

### Request Validation

```typescript
// Always validate with Zod
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8),
  entityId: z.string().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

router.post(
  "/users",
  authenticate,
  requirePermission("user:create"),
  async (req, res) => {
    const data = createUserSchema.parse(req.body);
    // ...
  },
);
```

### CSRF Protection

```typescript
// Require X-Requested-With header for mutations
export function requireApiRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    req.method !== "GET" &&
    req.headers["x-requested-with"] !== "XMLHttpRequest"
  ) {
    return res.status(403).json({ error: "Invalid request" });
  }
  next();
}
```

### Rate Limiting

```typescript
import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: "Too many login attempts, try again later" },
});

// Apply to auth routes
router.post("/login", authLimiter, loginHandler);
```

---

## Frontend Integration

### Auth Provider

#### apps/web/src/providers/auth-provider.tsx

```typescript
"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  mustChangePassword: boolean;
}

interface AuthState {
  user: User | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
  hasAllPermissions: (...codes: string[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    permissions: [],
    isLoading: true,
    isAuthenticated: false,
  });

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setState({
        user: data.user,
        permissions: data.permissions,
        isLoading: false,
        isAuthenticated: true,
      });

      if (data.user.mustChangePassword) {
        router.push("/change-password");
      }
    } catch (err: any) {
      if (err.response?.data?.deactivated) {
        // User was deactivated
        await logout();
        router.push("/sign-in?reason=deactivated");
      }
      setState({
        user: null,
        permissions: [],
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, [router]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });

    setState({
      user: data.user,
      permissions: data.permissions,
      isLoading: false,
      isAuthenticated: true,
    });

    if (data.user.mustChangePassword) {
      router.push("/change-password");
    } else {
      router.push("/dashboard");
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // Ignore errors
    }
    setState({
      user: null,
      permissions: [],
      isLoading: false,
      isAuthenticated: false,
    });
    router.push("/sign-in");
  };

  const hasPermission = (code: string) => {
    return state.permissions.includes(code);
  };

  const hasAnyPermission = (...codes: string[]) => {
    return codes.some((code) => state.permissions.includes(code));
  };

  const hasAllPermissions = (...codes: string[]) => {
    return codes.every((code) => state.permissions.includes(code));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

### Permission-Based UI

```typescript
// Conditional rendering based on permissions
function LeaveManagement() {
  const { hasPermission } = useAuth();

  return (
    <div>
      <h1>Leave Management</h1>

      {/* Always visible */}
      <MyLeaveRequests />

      {/* Only if can create */}
      {hasPermission("leave:create") && (
        <Button onClick={() => setShowModal(true)}>
          Request Leave
        </Button>
      )}

      {/* Only if HR */}
      {hasPermission("leave:hr-read") && (
        <AllLeaveRequests />
      )}

      {/* Only if can approve */}
      {hasPermission("leave:approve") && (
        <PendingApprovals />
      )}
    </div>
  );
}
```

### Sidebar Filtering

```typescript
const SIDEBAR_ITEMS = [
  { id: "home", label: "Home", permission: null }, // Always visible
  { id: "leave", label: "Leave", permission: "leave:read" },
  { id: "payroll", label: "Payroll", permission: "payroll:read" },
  { id: "admin", label: "Admin", permission: "admin:read" },
];

function Sidebar() {
  const { hasPermission } = useAuth();

  const visibleItems = SIDEBAR_ITEMS.filter(
    (item) => item.permission === null || hasPermission(item.permission)
  );

  return (
    <nav>
      {visibleItems.map((item) => (
        <SidebarItem key={item.id} {...item} />
      ))}
    </nav>
  );
}
```

---

## Related Documents

- [Project Overview](./PROJECT_OVERVIEW.md)
- [Modules Specification](./MODULES_SPECIFICATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [API Specification](./API_SPECIFICATION.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Task Planning](./TASK_PLANNING.md)
