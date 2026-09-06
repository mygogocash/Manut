# Intranet - API Specification

> **Conventions: authoritative. Endpoint list: partial. Measured 2026-08-26.**
>
> The API registers **1,350** routes across 99 modules; this file documents about
> **285** distinct paths (~21%). The conventions, DTO shapes and error-handling
> rules below *are* the contract and should be followed. The endpoint catalogue
> is not exhaustive — **an endpoint missing from this file usually exists
> anyway**, so check the module's `*.controller.ts` before concluding otherwise.
>
> Generating the catalogue from the routers is tracked in
> [`DOCS_PLAN.md`](DOCS_PLAN.md).

---

## Table of Contents

1. [API Conventions](#api-conventions)
2. [Authentication Endpoints](#authentication-endpoints)
3. [User Management Endpoints](#user-management-endpoints)
4. [Dashboard Endpoints](#dashboard-endpoints)
5. [Leave Management Endpoints](#leave-management-endpoints)
6. [Travel Endpoints](#travel-endpoints)
7. [Cash Advance Endpoints](#cash-advance-endpoints)
8. [Payroll Endpoints](#payroll-endpoints)
9. [HRMS Endpoints](#hrms-endpoints)
10. [Visa Endpoints](#visa-endpoints)
11. [Accounting Endpoints](#accounting-endpoints)
12. [Expense Endpoints](#expense-endpoints)
13. [Survey Forms Endpoints](#survey-forms-endpoints)
14. [Survey (Engagement Waves) Endpoints](#survey-engagement-waves-endpoints)
15. [Project Endpoints](#project-endpoints)
16. [Partner Endpoints](#partner-endpoints)
17. [Deals Endpoints](#deals-endpoints)
18. [Benefits Endpoints](#benefits-endpoints)
19. [Messaging Endpoints](#messaging-endpoints)
20. [Investor Endpoints](#investor-endpoints)
21. [Investor Updates Endpoints](#investor-updates-endpoints)
22. [Data Room Endpoints](#data-room-endpoints)
23. [Revenue Endpoints](#revenue-endpoints)
24. [Directory Endpoints](#directory-endpoints)
25. [Office Endpoints](#office-endpoints)
26. [Role Management Endpoints](#role-management-endpoints)
27. [Admin Endpoints](#admin-endpoints)
28. [ARIA Endpoints](#aria-endpoints)
29. [Upload Endpoints](#upload-endpoints)
30. [Error Handling](#error-handling)
31. [Pagination](#pagination)

---

## API Conventions

### Base URL

```
Production: https://api.manut.xyz
Development: http://localhost:3001
```

### Request Headers

| Header          | Required | Description          |
| --------------- | -------- | -------------------- |
| `Authorization` | Yes\*    | `Bearer <jwt_token>` |
| `Content-Type`  | Yes      | `application/json`   |

\*Required for authenticated endpoints

> **Note:** The `X-Requested-With: XMLHttpRequest` header (CSRF protection) is automatically set by the API client for all mutation requests (POST, PUT, PATCH, DELETE). Callers do not need to set it manually.

### Response Format

#### Success Response

```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  }
}
```

### HTTP Status Codes

| Code | Description                              |
| ---- | ---------------------------------------- |
| 200  | Success                                  |
| 201  | Created                                  |
| 204  | No Content                               |
| 400  | Bad Request - Invalid input              |
| 401  | Unauthorized - Missing/invalid token     |
| 403  | Forbidden - Insufficient permissions     |
| 404  | Not Found                                |
| 409  | Conflict - Resource already exists       |
| 422  | Unprocessable Entity - Validation failed |
| 429  | Too Many Requests - Rate limited         |
| 500  | Internal Server Error                    |

### Naming Conventions

- **Endpoints**: kebab-case (`/api/leave-requests`)
- **Query params**: camelCase (`?startDate=2025-01-01`)
- **Request/Response fields**: camelCase (`firstName`, `createdAt`)
- **IDs**: Use string (UUID or cuid)

---

## Authentication Endpoints

### POST /api/auth/login

Login with email and password.

**Request**

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**Response (200)**

```typescript
interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    mustChangePassword: boolean;
  };
  permissions: string[];
  session: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    expiresAt: number;
  };
}
```

**Errors**

| Code | Message                 |
| ---- | ----------------------- |
| 401  | Invalid credentials     |
| 403  | Account deactivated     |
| 429  | Too many login attempts |

---

### POST /api/auth/logout

Logout current session.

**Headers**: Authorization required

**Response (200)**

```json
{ "success": true }
```

---

### GET /api/auth/me

Get current user profile and permissions.

**Headers**: Authorization required

**Response (200)**

```typescript
interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    department: string | null;
    jobTitle: string | null;
    entity: {
      id: string;
      name: string;
      code: string;
    } | null;
    mustChangePassword: boolean;
  };
  permissions: string[];
}
```

---

### POST /api/auth/change-password

Change current user's password. Updates the password in Supabase Auth and clears the `mustChangePassword` flag if set.

**Headers**: Authorization required

**Request**

```typescript
interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string; // Min 8 characters
}
```

**Response (200)**

```json
{ "success": true }
```

**Errors**

| Code | Message                       |
| ---- | ----------------------------- |
| 400  | Current password is incorrect |
| 400  | New password too weak         |

---

## User Management Endpoints

**Required Permission**: `user:*`

### GET /api/admin/users

List all users.

**Query Parameters**

| Param      | Type    | Description                  |
| ---------- | ------- | ---------------------------- |
| `page`     | number  | Page number (default: 1)     |
| `limit`    | number  | Items per page (default: 20) |
| `search`   | string  | Search by name or email      |
| `entityId` | string  | Filter by entity             |
| `isActive` | boolean | Filter by status             |
| `roleId`   | string  | Filter by role               |

**Response (200)**

```typescript
interface UsersListResponse {
  data: Array<{
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    department: string | null;
    jobTitle: string | null;
    isActive: boolean;
    entity: { id: string; name: string } | null;
    roles: Array<{ id: string; name: string }>;
    createdAt: string;
  }>;
  meta: PaginationMeta;
}
```

---

### POST /api/admin/users

Create new user.

**Permission**: `user:create`

**Request**

```typescript
interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  entityId?: string;
  department?: string;
  jobTitle?: string;
  roleIds?: string[];
}
```

**Response (201)**

```typescript
interface CreateUserResponse {
  data: {
    id: string;
    email: string;
    name: string;
    // ... other fields
  };
}
```

---

### GET /api/admin/users/:id

Get user details.

**Response (200)**

```typescript
interface UserDetailResponse {
  data: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    phone: string | null;
    department: string | null;
    jobTitle: string | null;
    employeeId: string | null;
    employmentType: string;
    startDate: string | null;
    salary: string | null; // Decimal as string
    currency: string | null;
    location: string | null;
    country: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
    entity: { id: string; name: string; code: string } | null;
    roles: Array<{ id: string; name: string; isSystem: boolean }>;
    manager: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
  };
}
```

---

### PUT /api/admin/users/:id

Update user.

**Permission**: `user:update`

**Request**

```typescript
interface UpdateUserRequest {
  name?: string;
  entityId?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  location?: string | null;
  country?: string | null;
  reportingTo?: string | null;
  isActive?: boolean;
}
```

---

### DELETE /api/admin/users/:id

Delete user (removes from Supabase Auth and database).

**Permission**: `user:delete`

**Response (204)**: No content

---

### POST /api/admin/users/:id/reset-password

Reset user password (admin action).

**Permission**: `user:update`

**Request**

```typescript
interface ResetPasswordRequest {
  newPassword: string;
}
```

**Response (200)**

```json
{ "success": true }
```

---

### PUT /api/admin/users/:id/roles

Assign roles to user.

**Permission**: `user:assign-role`

**Request**

```typescript
interface AssignRolesRequest {
  roleIds: string[];
}
```

---

## Dashboard Endpoints

### GET /api/dashboard/stats

Get dashboard statistics overview. Pending-approval queues are scoped to the caller: HR/admin (holding the relevant `*:hr-read` / `projects:read-all`) see the system-wide queue, everyone else sees only items they can act on.

**Permission**: `home:read`

**Response (200)**

```typescript
interface DashboardStatsResponse {
  data: {
    kpis: {
      totalEmployees: number;
      activeProjects: number;
      pendingLeaves: number;
      pendingTravels: number;
      pendingExpenses: number;
      activeSurveyWaves: number;
      surveyResponsesActiveWaves: number;
      expensesThisMonth: number;
    };
    recentWallPosts: Array<{
      id: string;
      author: string;
      authorAvatar: string | null;
      content: string;
      type: string;
      commentsCount: number;
      attachments: unknown;
      linkUrl: string | null;
      createdAt: string;
    }>;
    recentNews: Array<{
      id: string;
      title: string;
      category: string;
      author: string;
      attachments: unknown;
      linkUrl: string | null;
      createdAt: string;
    }>;
    upcomingDates: Array<{
      id: string;
      title: string;
      date: string;
      type: string;
      attachments: unknown;
      linkUrl: string | null;
    }>;
    pendingLeaveRequests: Array<Record<string, unknown>>;
    pendingTravelRequests: Array<Record<string, unknown>>;
    pendingExpenseRequests: Array<Record<string, unknown>>;
    pendingActions: Array<{
      kind: "leave" | "travel" | "expense";
      id: string;
      title: string;
      subtitle: string;
      href: string;
      createdAt: string;
    }>;
    expenseSummary: unknown;
    projectStatusBreakdown: unknown;
    employeesByDepartment: unknown;
    activeProjectsWithProgress: unknown;
    urgentItems: unknown;
    // Published survey forms targeted at the caller that they have not
    // yet answered.
    openSurveys: Array<{
      id: string;
      title: string;
      href: string; // /survey-forms/:id/respond
      createdAt: string;
    }>;
  };
}
```

---

## Leave Management Endpoints

### GET /api/leave/types

List leave types.

**Response (200)**

```typescript
interface LeaveTypesResponse {
  data: Array<{
    id: string;
    name: string;
    code: string;
    daysPerYear: number;
    requiresApproval: boolean;
    isPaid: boolean;
    isActive: boolean;
  }>;
}
```

---

### GET /api/leave/balances

Get leave balances for current user or specified employee.

**Permission**: `leave:read` (self) or `leave:hr-read` (others)

**Query Parameters**

| Param        | Type   | Description             |
| ------------ | ------ | ----------------------- |
| `employeeId` | string | Employee ID (HR only)   |
| `year`       | number | Year (default: current) |

**Response (200)**

```typescript
interface LeaveBalancesResponse {
  data: Array<{
    id: string;
    leaveType: { id: string; name: string; code: string };
    year: number;
    entitled: number;
    used: number;
    carried: number;
    adjustment: number;
    remaining: number; // computed
  }>;
}
```

---

### GET /api/leave/requests

List leave requests.

**Permission**: `leave:read` (own) or `leave:hr-read` (all)

**Query Parameters**

| Param         | Type   | Description                            |
| ------------- | ------ | -------------------------------------- |
| `page`        | number | Page number                            |
| `limit`       | number | Items per page                         |
| `employeeId`  | string | Filter by employee (HR only)           |
| `entityId`    | string | Filter by entity                       |
| `status`      | string | pending, approved, rejected, cancelled |
| `leaveTypeId` | string | Filter by leave type                   |
| `startDate`   | string | From date (YYYY-MM-DD)                 |
| `endDate`     | string | To date (YYYY-MM-DD)                   |

**Response (200)**

```typescript
interface LeaveRequestsResponse {
  data: Array<{
    id: string;
    employee: { id: string; name: string; avatarUrl: string | null };
    leaveType: { id: string; name: string; code: string };
    startDate: string;
    endDate: string;
    days: string; // Decimal
    reason: string | null;
    status: "pending" | "approved" | "rejected" | "cancelled";
    approver: { id: string; name: string } | null;
    approvedAt: string | null;
    rejectReason: string | null;
    createdAt: string;
  }>;
  meta: PaginationMeta;
}
```

---

### POST /api/leave/requests

Submit leave request.

**Permission**: `leave:create`

**Request**

```typescript
interface CreateLeaveRequest {
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
}
```

**Response (201)**

```typescript
interface CreateLeaveResponse {
  data: {
    id: string;
    // ... leave request details
  };
}
```

**Errors**

| Code | Message                          |
| ---- | -------------------------------- |
| 400  | Insufficient leave balance       |
| 400  | End date before start date       |
| 409  | Overlapping leave request exists |

---

### GET /api/leave/requests/:id

Get a single leave request by ID.

**Permission**: `leave:read` (own) or `leave:hr-read` (all)

**Response (200)**

```typescript
interface LeaveRequestDetailResponse {
  data: {
    id: string;
    employee: { id: string; name: string; avatarUrl: string | null };
    leaveType: { id: string; name: string; code: string };
    startDate: string;
    endDate: string;
    days: string;
    reason: string | null;
    status: "pending" | "approved" | "rejected" | "cancelled";
    approver: { id: string; name: string } | null;
    approvedAt: string | null;
    rejectReason: string | null;
    createdAt: string;
  };
}
```

---

### PUT /api/leave/requests/:id/approve

Approve leave request.

**Permission**: `leave:approve`

**Response (200)**

```typescript
interface ApproveLeaveResponse {
  data: {
    id: string;
    status: "approved";
    approvedAt: string;
    approver: { id: string; name: string };
  };
}
```

---

### PUT /api/leave/requests/:id/reject

Reject leave request.

**Permission**: `leave:approve`

**Request**

```typescript
interface RejectLeaveRequest {
  reason: string;
}
```

---

### PUT /api/leave/requests/:id/cancel

Cancel own leave request (only if pending).

**Permission**: `leave:request`

---

### DELETE /api/leave/requests/:id

Soft-delete a leave request. The service enforces owner-or-HR: the owner (or a `leave:hr-read` holder) may delete; anyone else gets 403.

**Permission**: `leave:request`

---

### POST /api/leave/requests/:id/restore

Restore a soft-deleted leave request. Owner-or-HR, enforced in the service.

**Permission**: `leave:request`

---

### DELETE /api/leave/requests/:id/permanent

Permanently delete a soft-deleted leave request (HR only).

**Permission**: `leave:hr-settings`

---

## Travel Endpoints

**Base path**: `/api/travel`

Approve / reject / forward routes are intentionally **not** gated by a static `requirePermission`; the service's `assertCanActOnStep` authorises the current approval step's manager / assigned user, or an HR holder of `travel:hr-approve`.

### GET /api/travel/requests

List travel requests (own, or all for HR).

**Permission**: `travel:read` or `travel:hr-read`

---

### POST /api/travel/requests

Create a travel request.

**Permission**: `travel:request`

---

### GET /api/travel/export

Export travel requests to XLSX.

**Permission**: `travel:hr-read`

---

### GET /api/travel/requests/:id

Get a travel request.

**Permission**: `travel:read` or `travel:hr-read`

---

### PUT /api/travel/requests/:id

Update a travel request.

**Permission**: `travel:request`

---

### PUT /api/travel/requests/:id/approve

Approve the current approval step. Authorised in the service (step approver or HR).

**Permission**: Authenticated; service-enforced

---

### PUT /api/travel/requests/:id/reject

Reject the request. Authorised in the service.

**Request**

```typescript
interface RejectTravelRequest {
  reason: string;
}
```

**Permission**: Authenticated; service-enforced

---

### GET /api/travel/requests/:id/approvals

Get the snapshot approval-decision chain for a request.

**Permission**: `travel:read` or `travel:hr-read`

---

### PUT /api/travel/requests/:id/cancel

Cancel own travel request.

**Permission**: `travel:request`

---

### DELETE /api/travel/requests/:id

Soft-delete a travel request. Owner-or-HR, enforced in the service.

**Permission**: `travel:request` or `travel:hr-read`

---

### PUT /api/travel/requests/:id/complete

Mark a travel request complete (HR).

**Permission**: `travel:hr-read`

---

### PUT /api/travel/requests/:id/archive

Archive a travel request (HR).

**Permission**: `travel:hr-read`

---

### POST /api/travel/requests/:id/restore

Restore a soft-deleted travel request. Owner-or-HR, enforced in the service.

**Permission**: `travel:request`

---

### DELETE /api/travel/requests/:id/permanent

Permanently delete a soft-deleted travel request (HR).

**Permission**: `travel:hr-read`

---

### POST /api/travel/requests/:id/forward

Forward the request to a delegate. Authorised in the service (direct manager or HR).

**Permission**: Authenticated; service-enforced

---

### POST /api/travel/requests/:id/attachments

Add attachments to a travel request.

**Permission**: `travel:request` or `travel:hr-read`

---

### GET /api/travel/requests/:id/expenses

List expense reports linked to a travel request.

**Permission**: `travel:read` or `travel:hr-read`

---

### Travel Approval Chain & Settings

| Method & Path                            | Permission             | Description                          |
| ---------------------------------------- | ---------------------- | ------------------------------------ |
| `GET /api/travel/approval-steps`         | `travel:hr-settings`   | List org-wide approval steps         |
| `POST /api/travel/approval-steps`        | `travel:hr-settings`   | Create an approval step              |
| `PUT /api/travel/approval-steps/reorder` | `travel:hr-settings`   | Reorder approval steps               |
| `PUT /api/travel/approval-steps/:id`     | `travel:hr-settings`   | Update an approval step              |
| `DELETE /api/travel/approval-steps/:id`  | `travel:hr-settings`   | Delete an approval step              |
| `GET /api/travel/notification-recipients`| `travel:hr-settings`   | Get travel-desk email recipients     |
| `PUT /api/travel/notification-recipients`| `travel:hr-settings`   | Set travel-desk email recipients     |

---

## Cash Advance Endpoints

**Base path**: `/api/cash-advance`

Approve / reject open to any cash-advance reader; the service's `assertCanActOnStep` enforces that only the current step's approver (manager / assigned user) or a `cash-advance:approve` holder may act.

### GET /api/cash-advance

List cash advance requests (own, or all).

**Permission**: `cash-advance:read`, `cash-advance:read-all`, or `cash-advance:approve`

---

### POST /api/cash-advance

Create a cash advance request.

**Permission**: `cash-advance:create`

---

### GET /api/cash-advance/:id

Get a cash advance request.

**Permission**: `cash-advance:read`, `cash-advance:read-all`, or `cash-advance:approve`

---

### GET /api/cash-advance/:id/items/:itemId/receipt

Mint a fresh signed URL for a line item's receipt (private bucket).

**Permission**: `cash-advance:read`, `cash-advance:read-all`, or `cash-advance:approve`

---

### PATCH /api/cash-advance/:id

Update a cash advance request.

**Permission**: `cash-advance:create`

---

### DELETE /api/cash-advance/:id

Soft-delete a cash advance request. Owner-or-HR, enforced in the service.

**Permission**: `cash-advance:create` or `cash-advance:approve`

---

### POST /api/cash-advance/:id/restore

Restore a soft-deleted cash advance request. Owner-or-HR, enforced in the service.

**Permission**: `cash-advance:create`

---

### DELETE /api/cash-advance/:id/permanent

Permanently delete a soft-deleted cash advance request.

**Permission**: `cash-advance:approve`

---

### POST /api/cash-advance/:id/submit

Submit a draft cash advance request into the approval chain.

**Permission**: `cash-advance:create`

---

### POST /api/cash-advance/:id/approve

Approve the current step. Authorised in the service.

**Permission**: `cash-advance:read`, `cash-advance:read-all`, or `cash-advance:approve`

---

### POST /api/cash-advance/:id/reject

Reject the request. Authorised in the service.

**Permission**: `cash-advance:read`, `cash-advance:read-all`, or `cash-advance:approve`

---

### GET /api/cash-advance/:id/disbursement-proof

Get a signed URL for the disbursement proof document.

**Permission**: `cash-advance:read`, `cash-advance:read-all`, or `cash-advance:approve`

---

### POST /api/cash-advance/:id/disburse

Mark a cash advance disbursed.

**Permission**: `cash-advance:approve`

---

### POST /api/cash-advance/:id/clear

Mark a cash advance cleared / settled.

**Permission**: `cash-advance:approve`

---

### Cash Advance Approval Chain & Settings

| Method & Path                                  | Permission              | Description                       |
| ---------------------------------------------- | ----------------------- | --------------------------------- |
| `GET /api/cash-advance/approval-steps`         | `cash-advance:approve`  | List approval steps               |
| `POST /api/cash-advance/approval-steps`        | `cash-advance:approve`  | Create an approval step           |
| `PUT /api/cash-advance/approval-steps/reorder` | `cash-advance:approve`  | Reorder approval steps            |
| `PUT /api/cash-advance/approval-steps/:id`     | `cash-advance:approve`  | Update an approval step           |
| `DELETE /api/cash-advance/approval-steps/:id`  | `cash-advance:approve`  | Delete an approval step           |
| `GET /api/cash-advance/notification-recipients`| `cash-advance:approve`  | Get notification email recipients |
| `PUT /api/cash-advance/notification-recipients`| `cash-advance:approve`  | Set notification email recipients |

---

## Payroll Endpoints

**Permission**: `payroll:*`

### GET /api/payroll/runs

List payroll runs.

**Query Parameters**

| Param      | Type   | Description                       |
| ---------- | ------ | --------------------------------- |
| `entityId` | string | Filter by entity                  |
| `status`   | string | draft, processing, approved, paid |
| `period`   | string | YYYY-MM format                    |

**Response (200)**

```typescript
interface PayrollRunsResponse {
  data: Array<{
    id: string;
    entity: { id: string; name: string; code: string };
    period: string;
    status: string;
    totalGross: string;
    totalNet: string;
    totalTax: string;
    payslipCount: number;
    runner: { id: string; name: string };
    approver: { id: string; name: string } | null;
    createdAt: string;
  }>;
  meta: PaginationMeta;
}
```

---

### POST /api/payroll/runs

Create payroll run (calculates payslips).

**Permission**: `payroll:create`

**Request**

```typescript
interface CreatePayrollRunRequest {
  entityId: string;
  period: string; // YYYY-MM
}
```

**Response (201)**

```typescript
interface CreatePayrollRunResponse {
  data: {
    id: string;
    period: string;
    status: "draft";
    payslips: Array<{
      id: string;
      employee: { id: string; name: string };
      baseSalary: string;
      grossPay: string;
      netPay: string;
    }>;
  };
}
```

---

### GET /api/payroll/runs/:id

Get payroll run with payslips.

**Response (200)**

```typescript
interface PayrollRunDetailResponse {
  data: {
    id: string;
    entity: { id: string; name: string; code: string; currency: string };
    period: string;
    status: string;
    totalGross: string;
    totalNet: string;
    totalTax: string;
    payslips: Array<{
      id: string;
      employee: { id: string; name: string; employeeId: string };
      baseSalary: string;
      allowances: Record<string, number>;
      deductions: Record<string, number>;
      grossPay: string;
      netPay: string;
      currency: string;
    }>;
    runner: { id: string; name: string };
    approver: { id: string; name: string } | null;
    approvedAt: string | null;
    paidAt: string | null;
  };
}
```

---

### PUT /api/payroll/runs/:id/approve

Approve payroll run.

**Permission**: `payroll:approve`

---

## HRMS Endpoints

**Base path**: `/api/hrms`

Covers ESOP grants, the equity monthly-salary ledger, onboarding / offboarding checklists, and employee agreements. The ESOP routes are documented here; onboarding / offboarding / agreements follow the same `hrms:*` gating.

### ESOP

The ESOP pool aggregates company-wide option allocation (sensitive C-level data) and is gated to `hrms:esop-manage`. Plain employees with `hrms:read` see only their own grants via `GET /esop-grants` — the service forces an ownership scope when the caller lacks `hrms:esop-manage`, so a sent `employeeId` is ignored for them.

### GET /api/hrms/esop-pool

Get the company-wide ESOP pool summary.

**Permission**: `hrms:esop-manage`

---

### GET /api/hrms/esop-grants

List ESOP grants. Non-managers are scoped to their own grants by the service.

**Query Parameters**

| Param        | Type   | Description                          |
| ------------ | ------ | ------------------------------------ |
| `employeeId` | string | Filter by employee (managers only)   |

**Permission**: `hrms:read` or `hrms:esop-manage`

---

### POST /api/hrms/esop-grants

Create an ESOP grant.

**Permission**: `hrms:esop-manage`

---

### GET /api/hrms/esop-grants/by-employee/:employeeId

Get the per-employee ESOP breakdown (summary of one employee's grants).

> Literal `by-employee` segment is registered before `/esop-grants/:id` so Express matches it first.

**Permission**: `hrms:esop-manage`

---

### GET /api/hrms/esop-grants/import-template

Download the ESOP bulk-import template (V1 long-format "Equity Summary Report" workbook).

**Query Parameters**

| Param    | Type   | Description                          |
| -------- | ------ | ------------------------------------ |
| `format` | string | `xlsx` (default) or `csv`            |

**Permission**: `hrms:esop-manage`

---

### POST /api/hrms/esop-grants/bulk-import

Bulk-import ESOP grants from an uploaded workbook (`multipart/form-data`, field `file`). Auto-detects V1 vs current template. Set form field `replace=true` to replace existing grants.

**Permission**: `hrms:esop-manage`

**Response (200)**

```typescript
interface EsopBulkImportResponse {
  data: {
    importedRows: number;
    skippedRows: number;
    failedRows: number;
    totalGrants: number;
    parseErrors: Array<{ rowNumber: number; errors: string[] }>;
  };
}
```

---

### POST /api/hrms/esop-grants/bulk-delete

Bulk-delete ESOP grants. Body accepts either `{ ids: string[] }` or `{ all: true }`.

> Literal `bulk-delete` is registered before `/esop-grants/:id`.

**Permission**: `hrms:esop-manage`

---

### PUT /api/hrms/esop-grants/:id

Update an ESOP grant.

**Permission**: `hrms:esop-manage`

---

### DELETE /api/hrms/esop-grants/:id

Delete an ESOP grant.

**Permission**: `hrms:esop-manage`

---

### Equity Monthly Salary

| Method & Path                              | Permission                          | Description                              |
| ------------------------------------------ | ----------------------------------- | ---------------------------------------- |
| `GET /api/hrms/equity-monthly-salary`      | `hrms:read` or `hrms:esop-manage`   | List equity monthly-salary rows (`?year`)|
| `POST /api/hrms/equity-monthly-salary/import` | `hrms:esop-manage`               | Import rows from a workbook (`file`)     |
| `DELETE /api/hrms/equity-monthly-salary`   | `hrms:esop-manage`                  | Delete all equity monthly-salary rows    |

---

### Onboarding / Offboarding / Agreements

| Method & Path                              | Permission                                   | Description                          |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------ |
| `GET /api/hrms/onboarding`                 | `hrms:read` or `hrms:onboarding-manage`      | List onboarding checklists           |
| `POST /api/hrms/onboarding`                | `hrms:onboarding-manage`                     | Create an onboarding checklist       |
| `GET /api/hrms/onboarding/template`        | `hrms:read` or `hrms:onboarding-manage`      | Get default onboarding template      |
| `PUT /api/hrms/onboarding/template`        | `hrms:onboarding-manage`                     | Set default onboarding template      |
| `PUT /api/hrms/onboarding/:id/task`        | `hrms:onboarding-manage`                     | Update one onboarding task           |
| `PUT /api/hrms/onboarding/:id/tasks`       | `hrms:onboarding-manage`                     | Replace the onboarding task list     |
| `GET /api/hrms/offboarding`                | `hrms:read` or `hrms:offboarding-manage`     | List offboarding checklists          |
| `POST /api/hrms/offboarding`               | `hrms:offboarding-manage`                    | Create an offboarding checklist      |
| `GET /api/hrms/offboarding/template`       | `hrms:read` or `hrms:offboarding-manage`     | Get default offboarding template     |
| `PUT /api/hrms/offboarding/template`       | `hrms:offboarding-manage`                    | Set default offboarding template     |
| `PUT /api/hrms/offboarding/:id/task`       | `hrms:offboarding-manage`                    | Update one offboarding task          |
| `PUT /api/hrms/offboarding/:id/tasks`      | `hrms:offboarding-manage`                    | Replace the offboarding task list    |
| `PUT /api/hrms/offboarding/:id/sign`       | `hrms:offboarding-manage`                    | Record an exit-checklist sign-off    |
| `GET /api/hrms/agreements/folders`         | `hrms:agreements-manage`                     | List agreement folders               |
| `GET /api/hrms/agreements`                 | Authenticated; service-scoped (own or HR)    | List agreements                      |
| `GET /api/hrms/agreements/:id/download`    | Authenticated; service-scoped (own or HR)    | Mint a signed download URL           |
| `GET /api/hrms/agreements/:id`             | Authenticated; service-scoped (own or HR)    | Get an agreement                     |
| `POST /api/hrms/agreements`                | `hrms:agreements-manage`                     | Create an agreement record           |
| `PUT /api/hrms/agreements/:id`             | `hrms:agreements-manage`                     | Update an agreement                  |
| `DELETE /api/hrms/agreements/:id`          | `hrms:agreements-manage`                     | Delete an agreement                  |

---

## Visa Endpoints

**Base path**: `/api/visa`

### GET /api/visa

List visa records (own, or all for HR).

**Permission**: `visa:read`, `visa:hr-read`, or `visa:manage`

---

### POST /api/visa

Create a visa record.

**Permission**: `visa:manage`

---

### GET /api/visa/:id/download

Mint a short-lived signed URL for one of the visa's stored documents (private bucket).

**Query Parameters**

| Param      | Type   | Description                          |
| ---------- | ------ | ------------------------------------ |
| `docIndex` | number | Index of the document (non-negative) |

**Permission**: `visa:read`, `visa:hr-read`, or `visa:manage`

---

### POST /api/visa/parse-scan

OCR autofill — extract structured fields from an uploaded visa/passport scan.

**Permission**: `visa:manage`

---

### GET /api/visa/:id/timeline

Get the per-record activity timeline.

**Permission**: `visa:manage`

---

### GET /api/visa/:id

Get a visa record.

**Permission**: `visa:read`, `visa:hr-read`, or `visa:manage`

---

### PUT /api/visa/:id

Update a visa record.

**Permission**: `visa:manage`

---

### DELETE /api/visa/:id

Soft-delete a visa record.

**Permission**: `visa:manage`

---

### POST /api/visa/:id/restore

Restore a soft-deleted visa record.

**Permission**: `visa:manage`

---

### DELETE /api/visa/:id/permanent

Permanently delete a soft-deleted visa record.

**Permission**: `visa:manage`

---

### Visa Import & Notification Config

| Method & Path                                       | Permission     | Description                          |
| --------------------------------------------------- | -------------- | ------------------------------------ |
| `POST /api/visa/import/preview`                     | `visa:manage`  | Preview a visa import (`rows`)       |
| `POST /api/visa/import/commit`                      | `visa:manage`  | Commit a visa import (`rows`)        |
| `GET /api/visa/notification-config`                 | `visa:manage`  | Get expiry-reminder config           |
| `PUT /api/visa/notification-config/recipients`      | `visa:manage`  | Set reminder email recipients        |
| `PUT /api/visa/notification-config/lead-days`       | `visa:manage`  | Set reminder lead-day offsets        |
| `PUT /api/visa/notification-config/notify-employee` | `visa:manage`  | Toggle notifying the employee        |

---

## Accounting Endpoints

**Permission**: `accounting:*`

### GET /api/accounting/accounts

Get chart of accounts.

**Query Parameters**

| Param      | Type    | Description                                |
| ---------- | ------- | ------------------------------------------ |
| `entityId` | string  | Required                                   |
| `type`     | string  | asset, liability, equity, revenue, expense |
| `isActive` | boolean | Filter by status                           |

**Response (200)**

```typescript
interface ChartOfAccountsResponse {
  data: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    parentId: string | null;
    balance: string;
    isActive: boolean;
  }>;
}
```

---

### POST /api/accounting/accounts

Create account.

**Permission**: `accounting:admin`

**Request**

```typescript
interface CreateAccountRequest {
  entityId: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parentId?: string;
}
```

---

### GET /api/accounting/accounts/:id

Get account details.

**Response (200)**

```typescript
interface AccountDetailResponse {
  data: {
    id: string;
    code: string;
    name: string;
    type: string;
    parentId: string | null;
    balance: string;
    isActive: boolean;
    entityId: string;
  };
}
```

---

### PUT /api/accounting/accounts/:id

Update account.

**Permission**: `accounting:admin`

---

### DELETE /api/accounting/accounts/:id

Delete account.

**Permission**: `accounting:admin`

---

### GET /api/accounting/journals

List journal entries.

**Query Parameters**

| Param       | Type   | Description                       |
| ----------- | ------ | --------------------------------- |
| `entityId`  | string | Required                          |
| `status`    | string | draft, approved, posted, rejected |
| `startDate` | string | From date                         |
| `endDate`   | string | To date                           |

**Response (200)**

```typescript
interface JournalsResponse {
  data: Array<{
    id: string;
    entryNo: string;
    date: string;
    description: string | null;
    status: string;
    totalDebit: string;
    totalCredit: string;
    linesCount: number;
    creator: { id: string; name: string };
    createdAt: string;
  }>;
  meta: PaginationMeta;
}
```

---

### POST /api/accounting/journals

Create journal entry with lines.

**Permission**: `accounting:create`

**Request**

```typescript
interface CreateJournalRequest {
  entityId: string;
  date: string; // YYYY-MM-DD
  description?: string;
  reference?: string;
  lines: Array<{
    accountId: string;
    debit: number;
    credit: number;
    memo?: string;
  }>;
}
```

**Validation**: Sum of debits must equal sum of credits.

---

### GET /api/accounting/journals/:id

Get journal entry with lines.

**Response (200)**

```typescript
interface JournalDetailResponse {
  data: {
    id: string;
    entryNo: string;
    date: string;
    description: string | null;
    reference: string | null;
    status: string;
    lines: Array<{
      id: string;
      account: { id: string; code: string; name: string };
      debit: string;
      credit: string;
      memo: string | null;
    }>;
    creator: { id: string; name: string };
    approver: { id: string; name: string } | null;
    approvedAt: string | null;
    postedAt: string | null;
  };
}
```

---

### PUT /api/accounting/journals/:id

Update journal entry (only while in draft status).

**Permission**: `accounting:create`

---

### DELETE /api/accounting/journals/:id

Delete journal entry (only while in draft status).

**Permission**: `accounting:admin`

---

### PUT /api/accounting/journals/:id/approve

Approve journal entry.

**Permission**: `accounting:approve`

---

### PUT /api/accounting/journals/:id/post

Post journal entry (updates account balances).

**Permission**: `accounting:post`

**Precondition**: Status must be "approved"

---

### GET /api/accounting/invoices

List invoices.

**Permission**: `accounting:read`

**Response (200)**

```typescript
interface InvoicesResponse {
  data: Array<{
    id: string;
    invoiceNo: string;
    date: string;
    dueDate: string;
    status: string;
    totalAmount: string;
    currency: string;
    createdAt: string;
  }>;
  meta: PaginationMeta;
}
```

---

### POST /api/accounting/invoices

Create invoice.

**Permission**: `accounting:create`

---

### GET /api/accounting/invoices/:id

Get invoice details.

**Permission**: `accounting:read`

---

### PUT /api/accounting/invoices/:id

Update invoice.

**Permission**: `accounting:create`

---

### DELETE /api/accounting/invoices/:id

Delete invoice.

**Permission**: `accounting:admin`

---

### GET /api/accounting/bank

Get bank transactions.

**Permission**: `accounting:read`

---

### POST /api/accounting/bank/import

Import bank transactions.

**Permission**: `accounting:admin`

---

## Fixed Asset Endpoints

All routes below are mounted under `/api/accounting` and are **gated by the
runtime flag `ACCOUNTING_FIXED_ASSETS`** — with the flag unset the entire block
is unmounted and every path 404s, including for Admin (an env flag hides what a
permission gate cannot, since Admin bypasses permission checks).

Reuses the existing `accounting:*` permissions — no new codes were minted.
Owner-vs-read-all scoping is enforced **in the service**, not at the route.

> **Route ordering**: every literal path (`/fixed-assets/depreciation-run`,
> `/fixed-assets/count-sessions`, `/fixed-assets/import/*`,
> `/fixed-assets/export.xlsx`) is registered BEFORE `/fixed-assets/:id`. Express
> matches in order, so reversing this makes the literal paths unreachable.

### Register

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET | `/fixed-assets` | `accounting:read` |
| POST | `/fixed-assets` | `accounting:create` |
| GET | `/fixed-assets/:id` | `accounting:read` |
| PUT | `/fixed-assets/:id` | `accounting:update` |
| DELETE | `/fixed-assets/:id` | `accounting:delete` (soft) |
| POST | `/fixed-assets/:id/restore` | `accounting:create` |
| DELETE | `/fixed-assets/:id/permanent` | `accounting:delete` |
| GET | `/fixed-asset-categories` | `accounting:read` |
| POST | `/fixed-asset-categories` | `accounting:admin` |
| PUT / DELETE | `/fixed-asset-categories/:id` | `accounting:admin` |

Depreciation is **never stored** — it is derived from the register row on read,
so the figures cannot drift from the register.

### Import / export

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/fixed-assets/import/preview` | Validates every row, writes nothing |
| POST | `/fixed-assets/import/commit` | **All-or-nothing** in one transaction |
| GET | `/fixed-assets/export.xlsx` | 19-column report; re-imports cleanly |

The client parses the workbook and POSTs canonical rows; the server re-validates.
Book Value anchors at the file's own "as at" date (parsed from the export
header), not a hardcoded cut-over — otherwise re-importing an export double-counts
depreciation or rejects the whole file.

### Disposals and write-offs

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET | `/fixed-asset-disposals` | `accounting:read` |
| GET | `/fixed-asset-disposals/:id` | `accounting:read` |
| POST | `/fixed-assets/:id/disposals` | `accounting:create` |
| PUT | `/fixed-asset-disposals/:id/approve` | `accounting:approve` |
| PUT | `/fixed-asset-disposals/:id/reject` | `accounting:approve` |

Approval asserts the fiscal period is open **at the disposal date**, snapshots
the pre-disposal asset state, and is maker-checker aware.

### Depreciation run (Phase 2)

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET | `/fixed-assets/depreciation-run` | `accounting:read` |
| POST | `/fixed-assets/depreciation-run` | `accounting:post` |

GET returns the **proposed journal** for `year`/`month` — per-category lines plus
per-asset charges — and writes nothing. POST is additionally gated on
`ACCOUNTING_GL_POSTING`; with that flag false the run can only preview.

Idempotent via `(sourceType, sourceRef)` = `("fa-depreciation", "YYYY-MM")`, so a
second POST for the same period conflicts rather than double-posting.

### Remeasurement — revaluation / impairment (Phase 2)

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET | `/fixed-asset-remeasurements` | `accounting:read` |
| GET | `/fixed-assets/:id/remeasurements` | `accounting:read` |
| POST | `/fixed-assets/:id/remeasurements` | `accounting:create` |
| PUT | `/fixed-asset-remeasurements/:id/approve` | `accounting:approve` |
| PUT | `/fixed-asset-remeasurements/:id/reject` | `accounting:approve` |

Approval persists the IAS 16.39/40 split between profit or loss and OCI and rolls
the asset's cumulative surplus / P&L-loss balances. **No journal is posted yet** —
`linkedJeId` stays null.

### Transfers (Phase 2)

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET | `/fixed-asset-transfers` | `accounting:read` |
| GET | `/fixed-assets/:id/transfers` | `accounting:read` |
| POST | `/fixed-assets/:id/transfers` | `accounting:create` |
| PUT | `/fixed-asset-transfers/:id/approve` | `accounting:approve` |
| PUT | `/fixed-asset-transfers/:id/reject` | `accounting:approve` |

`kind` is `location`, `custodian` or `entity`. Location and custodian moves
complete normally. **A cross-entity approval asserts both entities' fiscal
periods and then returns 400** — completing it needs an intercompany
receivable/payable account role that does not exist in this chart of accounts.
Submit and the plan preview work; the request stays pending.

### Physical count (Phase 2)

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET / POST | `/fixed-assets/count-sessions` | `accounting:read` / `accounting:create` |
| POST | `/fixed-assets/count-sessions/:id/lines` | `accounting:create` |
| GET | `/fixed-assets/count-sessions/:id/variance` | `accounting:read` |
| PUT | `/fixed-assets/count-sessions/:id/close` | `accounting:approve` |

Expected quantities are reconstructed at the session's `asOfDate`, never from the
live row — a year-end count runs over the following fortnight. An ambiguous
scanned tag returns 400 naming the ambiguity rather than guessing. Nothing here
touches the GL: a shortfall returns `suggestWriteOff` for a human to route
through the disposal flow.

### Entity tax rates (Phase 2)

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET / POST | `/entity-tax-rates` | `accounting:read` / `accounting:admin` |
| PUT / DELETE | `/entity-tax-rates/:id` | `accounting:admin` |

Effective-dated per entity. A temporary difference is measured at the rate
expected when it reverses, and BOI promotions start and end on fixed dates, so a
single flat rate cannot express either.

### Reports

| Path | Returns |
| ---- | ------- |
| `GET /reports/fixed-assets/register` | Register as at a date |
| `GET /reports/fixed-assets/depreciation-schedule` | Monthly charge by category |
| `GET /reports/fixed-assets/disposals` | Disposals in a window |
| `GET /reports/fixed-assets/movement` | Movement / PPE note |
| `GET /reports/fixed-assets/deferred-tax` | Book-vs-tax temporary differences |

The deferred tax schedule **excludes** any asset with no tax basis or no
applicable rate, names each exclusion, and reports its own coverage percentage.
It never falls back to the book life, which would yield a temporary difference of
exactly zero for every asset.

---

## Expense Endpoints

### GET /api/expenses

List expenses.

**Permission**: `expenses:read` (own) or `expenses:hr-read` (all)

**Query Parameters**

| Param        | Type   | Description                             |
| ------------ | ------ | --------------------------------------- |
| `employeeId` | string | Filter by employee                      |
| `entityId`   | string | Filter by entity                        |
| `status`     | string | pending, approved, rejected, reimbursed |
| `categoryId` | string | Filter by category                      |
| `startDate`  | string | From date                               |
| `endDate`    | string | To date                                 |

**Response (200)**

```typescript
interface ExpensesResponse {
  data: Array<{
    id: string;
    employee: { id: string; name: string };
    entity: { id: string; name: string };
    category: { id: string; name: string } | null;
    description: string;
    amount: string;
    currency: string;
    date: string;
    receiptUrl: string | null;
    status: string;
    approver: { id: string; name: string } | null;
    createdAt: string;
  }>;
  meta: PaginationMeta;
}
```

---

### POST /api/expenses

Submit expense.

**Permission**: `expenses:create`

**Request**

```typescript
interface CreateExpenseRequest {
  entityId: string;
  categoryId?: string;
  description: string;
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  receiptUrl?: string;
  notes?: string;
}
```

---

### GET /api/expenses/:id

Get expense details.

**Permission**: `expenses:read`

---

### PUT /api/expenses/:id

Update expense (only while pending).

**Permission**: `expenses:create`

---

### DELETE /api/expenses/:id

Delete expense (only while pending).

**Permission**: `expenses:create`

---

### PUT /api/expenses/:id/approve

Approve expense.

**Permission**: `expenses:approve`

---

### PUT /api/expenses/:id/reject

Reject expense.

**Permission**: `expenses:approve`

**Request**

```typescript
interface RejectExpenseRequest {
  reason: string;
}
```

---

### POST /api/expenses/:id/restore

Restore a soft-deleted expense. Owner-or-HR, enforced in the service.

**Permission**: `expense:create`

---

### DELETE /api/expenses/:id/permanent

Permanently delete a soft-deleted expense (HR admin).

**Permission**: `expense:hr-delete`

---

### POST /api/expenses/reports/:reportId/restore

Restore a soft-deleted expense report. Owner-or-HR, enforced in the service.

**Permission**: `expense:create`

---

### DELETE /api/expenses/reports/:reportId/permanent

Permanently delete a soft-deleted expense report (HR admin).

**Permission**: `expense:hr-delete`

---

## Survey Forms Endpoints

**Base path**: `/api/survey-forms`

Ad-hoc survey / form builder (distinct from the engagement-wave analytics module at `/api/survey`). Every route runs `authenticate` + `requireActive`. Browsing and responding are open to any authenticated user — list/get/respond have **no** `requirePermission` gate; the service scopes results to the caller's audience. Authoring, analytics, and the response roster are gated on `survey:manage-wave`.

> **Route order:** literal segments (`/announcement-settings`) are registered before `/:id` so Express matches them first.

### GET /api/survey-forms

List survey forms. The `scope` selects the audience: `available` (forms targeted at the caller), `mine` (forms the caller created), or `all` (every form — managers only, requires `survey:manage-wave`). The `all` scope falls back to `available + mine` for non-managers.

**Query Parameters**

| Param      | Type    | Description                                                        |
| ---------- | ------- | ------------------------------------------------------------------ |
| `page`     | number  | Page number (default: 1)                                           |
| `limit`    | number  | Items per page (default: 20, max 100)                              |
| `status`   | string  | `draft`, `published`, or `closed`                                  |
| `scope`    | string  | `available` (default), `mine`, or `all`                            |
| `archived` | boolean | `"true"` returns ONLY archived forms (managers); otherwise excludes archived |

**Permission**: Authenticated (no static gate; service-scoped)

---

### POST /api/survey-forms

Create a survey form (draft).

**Permission**: `survey:manage-wave`

**Request**

```typescript
interface CreateSurveyFormRequest {
  title: string;
  description?: string | null;
  isAnonymous?: boolean; // default false
  targetAll?: boolean; // default true
  targetEntityIds?: string[];
  targetDepartments?: string[];
  targetUserIds?: string[];
  questions?: SurveyFormQuestion[];
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
}

interface SurveyFormQuestion {
  type:
    | "info"
    | "short_text"
    | "long_text"
    | "single_choice"
    | "multi_choice"
    | "rating"
    | "date"
    | "number";
  prompt: string; // 1–500 chars
  helperText?: string | null;
  required?: boolean; // default false
  options?: string[]; // choice types need ≥ 2
  settings?: { min?: number; max?: number; [key: string]: unknown };
}
```

---

### GET /api/survey-forms/announcement-settings

Get the admin-editable defaults for the announce-on-publish dialog.

**Permission**: `survey:manage-wave`

---

### PUT /api/survey-forms/announcement-settings

Update the announce-on-publish defaults.

**Request**

```typescript
interface AnnouncementSettingsRequest {
  wall: boolean;
  news: boolean;
  companyDate: boolean;
  messageTemplate: string;
  newsCategory: string;
}
```

**Permission**: `survey:manage-wave`

---

### GET /api/survey-forms/:id

Get a survey form. Service enforces that the caller is in the form's audience or is a manager.

**Permission**: Authenticated (no static gate; service-scoped)

---

### PUT /api/survey-forms/:id

Update a survey form.

**Permission**: `survey:manage-wave`

---

### DELETE /api/survey-forms/:id

Delete a survey form.

**Permission**: `survey:manage-wave`

---

### PUT /api/survey-forms/:id/questions

Replace the entire question list (at least one question required).

**Permission**: `survey:manage-wave`

---

### POST /api/survey-forms/:id/publish

Publish a draft form. Optionally announces it on publish — each surface is opt-in and the service additionally checks the actor holds the matching permission before writing to it.

**Request** (optional body)

```typescript
interface PublishSurveyFormRequest {
  announce?: {
    wall?: boolean; // default false
    news?: boolean; // default false
    companyDate?: boolean; // default false
    message?: string;
    deadline?: string; // parseable date
  };
}
```

**Permission**: `survey:manage-wave`

---

### POST /api/survey-forms/:id/announce

Announce an already-published form now (re-broadcast to the opt-in surfaces).

**Request**: same optional `announce` block as publish.

**Permission**: `survey:manage-wave`

---

### PUT /api/survey-forms/:id/schedule

Set or extend the open/close window. Allowed on draft AND published forms.

**Request**

```typescript
interface ScheduleSurveyFormRequest {
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
}
```

**Permission**: `survey:manage-wave`

---

### POST /api/survey-forms/:id/close

Close a published form (stops accepting responses).

**Permission**: `survey:manage-wave`

---

### POST /api/survey-forms/:id/archive

Archive a form.

**Permission**: `survey:manage-wave`

---

### POST /api/survey-forms/:id/unarchive

Unarchive a form.

**Permission**: `survey:manage-wave`

---

### POST /api/survey-forms/:id/responses

Submit a response to a form. Open to any authenticated user in the audience.

**Request**

```typescript
interface SubmitResponseRequest {
  answers: Array<{
    questionId: string;
    value?: string | number | boolean | string[] | null;
  }>;
}
```

**Response (201)**: the saved response.

**Permission**: Authenticated (no static gate; service-scoped)

---

### GET /api/survey-forms/:id/my-response

Get the caller's own response to a form (if any).

**Permission**: Authenticated (no static gate)

---

### GET /api/survey-forms/:id/responses

List all responses to a form (response roster).

**Permission**: `survey:manage-wave`

---

### GET /api/survey-forms/:id/analytics

Get aggregated analytics for a form.

**Permission**: `survey:manage-wave`

---

## Survey (Engagement Waves) Endpoints

**Base path**: `/api/survey`

Engagement-survey waves with XLSX upload, scoring, and analytics. Distinct from the form builder above. Every route runs `authenticate` + `requireActive`.

### GET /api/survey/definitions

List survey definitions.

**Permission**: `survey:manage-wave` or `survey:analytics`

---

### GET /api/survey/waves

List waves (paginated).

**Query Parameters**

| Param          | Type   | Description                  |
| -------------- | ------ | ---------------------------- |
| `page`         | number | Page number (default: 1)     |
| `limit`        | number | Items per page (default: 20) |
| `status`       | string | Filter by wave status        |
| `definitionId` | string | Filter by definition         |

**Permission**: `survey:manage-wave` or `survey:analytics`

---

### GET /api/survey/waves/all

List all waves (for select inputs).

**Permission**: `survey:manage-wave`, `survey:analytics`, or `survey:upload`

---

### POST /api/survey/waves

Create a wave. `definitionId` is **optional** — when omitted the service resolves the active definition automatically.

**Request**

```typescript
interface CreateWaveRequest {
  name: string;
  description?: string | null;
  definitionId?: string | null; // optional; server resolves active definition
  startDate?: string | null;
  endDate?: string | null;
  status?: string; // default "draft"
}
```

**Permission**: `survey:manage-wave`

---

### GET /api/survey/waves/:id

Get a wave.

**Permission**: `survey:manage-wave` or `survey:analytics`

---

### PUT /api/survey/waves/:id

Update a wave.

**Permission**: `survey:manage-wave`

---

### DELETE /api/survey/waves/:id

Delete a wave.

**Permission**: `survey:manage-wave`

---

### POST /api/survey/upload/parse

Parse an uploaded `.xlsx` response file against the wave's definition (validation preview, no commit). `multipart/form-data` with `file` + form field `waveId`.

**Permission**: `survey:upload`

---

### POST /api/survey/upload/commit

Commit parsed rows as responses.

**Permission**: `survey:upload`

---

### GET /api/survey/upload/jobs

List upload history (audit trail). Optional `?waveId`.

**Permission**: `survey:view-jobs`

---

### Survey Analytics & Export

| Method & Path                          | Permission           | Description                          |
| -------------------------------------- | -------------------- | ------------------------------------ |
| `GET /api/survey/analytics`            | `survey:analytics`   | Wave analytics (`?waveId`)           |
| `GET /api/survey/analytics/heatmap`    | `survey:analytics`   | Heatmap by demographic field         |
| `GET /api/survey/analytics/compare`    | `survey:analytics`   | Compare two waves                    |
| `GET /api/survey/analytics/departments`| `survey:analytics`   | Department breakdown (`?waveId`)     |
| `GET /api/survey/export/raw`           | `survey:export-raw`  | Export raw anonymized responses CSV  |
| `GET /api/survey/export/scores`        | `survey:export-scores`| Export section/question scores CSV  |

---

## Project Endpoints

### GET /api/projects

List projects.

**Permission**: `projects:read`

**Query Parameters**

| Param       | Type   | Description                          |
| ----------- | ------ | ------------------------------------ |
| `status`    | string | planning, active, on_hold, completed |
| `ownerId`   | string | Filter by owner                      |
| `partnerId` | string | Filter by partner                    |

---

### POST /api/projects

Create project.

**Permission**: `projects:create`

**Request**

```typescript
interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: string;
  partnerId?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
}
```

---

### GET /api/projects/:id

Get project with tasks.

---

### PUT /api/projects/:id

Update project.

**Permission**: `projects:update`

---

### DELETE /api/projects/:id

Delete project (cascades tasks).

**Permission**: `projects:delete`

---

### GET /api/projects/:id/tasks

List project tasks.

---

### POST /api/projects/:id/tasks

Create task.

**Request**

```typescript
interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  ownerId?: string;
  dueDate?: string;
}
```

---

### PUT /api/projects/tasks/:id

Update task.

---

### DELETE /api/projects/tasks/:id

Delete task.

---

## Partner Endpoints

### GET /api/partners

List partners.

**Permission**: `partners:read`

**Query Parameters**

| Param     | Type   | Description                             |
| --------- | ------ | --------------------------------------- |
| `type`    | string | telco, commercial, strategic            |
| `status`  | string | prospect, engaged, pilot, live, churned |
| `country` | string | Filter by country                       |

---

### POST /api/partners

Create partner.

**Permission**: `partners:create`

**Request**

```typescript
interface CreatePartnerRequest {
  company: string;
  type: string;
  status?: string;
  region?: string;
  country?: string;
  website?: string;
  description?: string;
  contractValue?: number;
  contacts?: Array<{
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    isPrimary?: boolean;
  }>;
}
```

---

### GET /api/partners/:id

Get partner with contacts.

---

### PUT /api/partners/:id

Update partner.

**Permission**: `partners:update`

---

### DELETE /api/partners/:id

Delete partner.

**Permission**: `partners:delete`

---

### GET /api/partners/:id/contacts

List contacts for a partner.

**Permission**: `partners:read`

---

### POST /api/partners/:id/contacts

Add a contact to a partner.

**Permission**: `partners:update`

**Request**

```typescript
interface CreatePartnerContactRequest {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}
```

---

### PUT /api/partners/:id/contacts/:contactId

Update a partner contact.

**Permission**: `partners:update`

---

### DELETE /api/partners/:id/contacts/:contactId

Delete a partner contact.

**Permission**: `partners:update`

---

## Deals Endpoints

**Permission**: `deals:*`

### GET /api/deals

List deals.

**Permission**: `deals:read`

**Response (200)**

```typescript
interface DealsResponse {
  data: Array<{
    id: string;
    name: string;
    status: string;
    value: string;
    // ... other deal fields
    createdAt: string;
  }>;
  meta: PaginationMeta;
}
```

---

### GET /api/deals/pipeline

Get deals pipeline view (grouped by stage).

**Permission**: `deals:read`

---

### POST /api/deals

Create a new deal.

**Permission**: `deals:create`

---

### GET /api/deals/:id

Get deal details.

**Permission**: `deals:read`

---

### PUT /api/deals/:id

Update deal.

**Permission**: `deals:update`

---

### DELETE /api/deals/:id

Delete deal.

**Permission**: `deals:delete`

---

## Benefits Endpoints

**Permission**: `benefits:*`

### GET /api/benefits

List available benefits.

**Permission**: `benefits:read`

---

### POST /api/benefits

Create a benefit.

**Permission**: `benefits:create`

---

### GET /api/benefits/:id

Get benefit details.

**Permission**: `benefits:read`

---

### PUT /api/benefits/:id

Update benefit.

**Permission**: `benefits:update`

---

### DELETE /api/benefits/:id

Delete benefit.

**Permission**: `benefits:delete`

---

### POST /api/benefits/enroll

Enroll current user in a benefit.

**Permission**: `benefits:read`

**Request**

```typescript
interface EnrollBenefitRequest {
  benefitId: string;
}
```

---

### PUT /api/benefits/enrollments/:id/unenroll

Unenroll from a benefit.

**Permission**: `benefits:read`

---

### GET /api/benefits/my-enrollments

Get current user's benefit enrollments.

**Permission**: `benefits:read`

---

## Messaging Endpoints

### GET /api/messages/channels

List accessible channels.

**Permission**: `messages:read`

**Response (200)**

```typescript
interface ChannelsResponse {
  data: Array<{
    id: string;
    name: string;
    description: string | null;
    isPrivate: boolean;
    memberCount: number;
    lastMessage: {
      content: string;
      author: { name: string };
      createdAt: string;
    } | null;
    unreadCount: number;
  }>;
}
```

---

### POST /api/messages/channels

Create channel.

**Request**

```typescript
interface CreateChannelRequest {
  name: string;
  description?: string;
  isPrivate?: boolean;
  memberIds?: string[];
}
```

---

### GET /api/messages/channels/:id

Get channel details.

**Permission**: `messages:read`

---

### PUT /api/messages/channels/:id

Update channel.

**Permission**: `messages:create`

---

### DELETE /api/messages/channels/:id

Delete channel.

**Permission**: `messages:create`

---

### GET /api/messages/channels/:id/messages

Get channel messages (paginated, newest first).

**Query Parameters**

| Param    | Type   | Description                        |
| -------- | ------ | ---------------------------------- |
| `limit`  | number | Messages per page (default: 50)    |
| `before` | string | Cursor for pagination (message ID) |

**Response (200)**

```typescript
interface MessagesResponse {
  data: Array<{
    id: string;
    author: { id: string; name: string; avatarUrl: string | null };
    content: string;
    isPinned: boolean;
    reactions: Record<string, string[]>; // emoji -> userIds
    createdAt: string;
    updatedAt: string;
  }>;
  meta: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}
```

---

### POST /api/messages/channels/:id/messages

Send message.

**Permission**: `messages:create`

**Request**

```typescript
interface SendMessageRequest {
  content: string;
}
```

---

### DELETE /api/messages/channels/:channelId/messages/:messageId

Delete message (own or admin).

---

## Investor Endpoints

### GET /api/investors

List investors.

**Permission**: `investors:read` (team visibility) or `investors:read-all` (all)

**Query Parameters**

| Param    | Type   | Description                            |
| -------- | ------ | -------------------------------------- |
| `type`   | string | angel, vc, strategic, etc.             |
| `status` | string | prospect, engaged, committed, invested |

**Response (200)**

```typescript
interface InvestorsResponse {
  data: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    contactName: string | null;
    contactEmail: string | null;
    location: string | null;
    totalInvested: string;
    visibility: string;
    createdAt: string;
  }>;
  meta: PaginationMeta;
}
```

---

### POST /api/investors

Create investor.

**Permission**: `investors:create`

**Request**

```typescript
interface CreateInvestorRequest {
  name: string;
  type: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  location?: string;
  visibility?: "team" | "ceo_only";
}
```

---

### PUT /api/investors/:id

Update investor.

**Permission**: `investors:update`

---

### POST /api/investors/:id/note

Add note to investor.

**Request**

```typescript
interface AddNoteRequest {
  text: string;
}
```

---

### DELETE /api/investors/:id

Delete investor.

**Permission**: `investors:delete`

---

### GET /api/investments

List investments.

---

### POST /api/investments

Create investment.

**Request**

```typescript
interface CreateInvestmentRequest {
  investorId: string;
  type: "safe" | "equity" | "convertible_note";
  amount: number;
  currency?: string;
  valuation?: number;
  shares?: number;
  date: string;
  round?: string;
  status?: string;
  terms?: Record<string, any>;
  notes?: string;
}
```

---

## Investor Updates Endpoints

**Permission**: `investor-updates:*`

### GET /api/investor-updates

List investor updates.

**Permission**: `investor-updates:read`

---

### POST /api/investor-updates

Create an investor update.

**Permission**: `investor-updates:create`

---

### GET /api/investor-updates/:id

Get investor update details.

**Permission**: `investor-updates:read`

---

### PUT /api/investor-updates/:id

Update an investor update.

**Permission**: `investor-updates:update`

---

### DELETE /api/investor-updates/:id

Delete an investor update.

**Permission**: `investor-updates:delete`

---

### POST /api/investor-updates/:id/send

Send an investor update to recipients.

**Permission**: `investor-updates:create`

---

## Data Room Endpoints

**Permission**: `dataroom:*`

### GET /api/dataroom

List data room documents.

**Permission**: `dataroom:read`

---

### GET /api/dataroom/summary

Get data room summary statistics.

**Permission**: `dataroom:read`

---

### POST /api/dataroom

Upload / create a data room document.

**Permission**: `dataroom:create`

---

### GET /api/dataroom/:id

Get data room document details.

**Permission**: `dataroom:read`

---

### PUT /api/dataroom/:id

Update data room document metadata.

**Permission**: `dataroom:update`

---

### DELETE /api/dataroom/:id

Delete a data room document.

**Permission**: `dataroom:delete`

---

## Revenue Endpoints

**Permission**: `revenue:*`

### GET /api/revenue/dashboard

Get revenue dashboard overview.

**Permission**: `revenue:read`

---

### GET /api/revenue/investments

Get investment revenue data.

**Permission**: `revenue:read`

---

### GET /api/revenue/expenses

Get expense breakdown for revenue reporting.

**Permission**: `revenue:read`

---

### GET /api/revenue/invoices

Get invoice data for revenue reporting.

**Permission**: `revenue:read`

---

## Directory Endpoints

### GET /api/directory

List all employees in the company directory.

**Permission**: `directory:read`

---

### GET /api/directory/departments

List departments.

**Permission**: `directory:read`

---

### GET /api/directory/org-chart

Get organizational chart data.

**Permission**: `directory:read`

---

### GET /api/directory/:id

Get employee directory profile.

**Permission**: `directory:read`

---

## Office Endpoints

### GET /api/office/offices

List offices.

**Permission**: `office:read`

---

### GET /api/office/desks

Get desks with bookings.

**Permission**: `office:read`

**Query Parameters**

| Param  | Type   | Description                    |
| ------ | ------ | ------------------------------ |
| `date` | string | Date to check (default: today) |

**Response (200)**

```typescript
interface DesksResponse {
  data: Array<{
    id: string;
    name: string;
    floor: string | null;
    zone: string | null;
    isActive: boolean;
    booking: {
      id: string;
      employee: { id: string; name: string };
      date: string;
    } | null;
  }>;
}
```

---

### POST /api/office/desks/book

Book a desk.

**Permission**: `office:book`

**Request**

```typescript
interface BookDeskRequest {
  date: string; // YYYY-MM-DD
  deskId: string;
}
```

**Errors**

| Code | Message                           |
| ---- | --------------------------------- |
| 409  | Desk already booked for this date |

---

### DELETE /api/office/desks/bookings/:id

Cancel own desk booking.

---

### GET /api/office/rooms

Get meeting rooms.

**Permission**: `office:read`

---

### POST /api/office/rooms/book

Book meeting room.

**Permission**: `office:book`

**Request**

```typescript
interface BookRoomRequest {
  date: string;
  timeSlot: string; // e.g., "09:00-10:00"
  title?: string;
  roomId: string;
}
```

---

### DELETE /api/office/rooms/bookings/:id

Cancel own room booking.

---

### GET /api/office/assets

List office assets.

**Permission**: `office:read`

---

### POST /api/office/assets

Create an office asset.

**Permission**: `office:admin`

---

### GET /api/office/assets/:id

Get office asset details.

**Permission**: `office:read`

---

### PUT /api/office/assets/:id

Update an office asset.

**Permission**: `office:admin`

---

### DELETE /api/office/assets/:id

Delete an office asset.

**Permission**: `office:admin`

---

## Role Management Endpoints

**Base path**: `/api/roles`

### GET /api/roles/permissions

List all available permission codes.

**Permission**: `role:read`

---

### GET /api/roles

List roles.

**Permission**: `role:read`

---

### POST /api/roles

Create role.

**Permission**: `role:create`

**Request**

```typescript
interface CreateRoleRequest {
  name: string;
  description?: string;
  permissionCodes: string[];
}
```

---

### GET /api/roles/:id

Get role details with permissions.

**Permission**: `role:read`

---

### PUT /api/roles/:id

Update role.

**Permission**: `role:update`

---

### DELETE /api/roles/:id

Delete role (cannot delete system roles).

**Permission**: `role:delete`

---

## Admin Endpoints

### GET /api/admin/entities

List entities (companies).

**Headers**: Authorization required

**Response (200)**

```typescript
interface EntitiesResponse {
  data: Array<{
    id: string;
    name: string;
    code: string;
    country: string;
    currency: string;
    accountingStd: string;
    isActive: boolean;
  }>;
}
```

---

### GET /api/admin/audit-log

Get audit log entries.

**Permission**: `admin:audit-log`

**Query Parameters**

| Param       | Type   | Description                      |
| ----------- | ------ | -------------------------------- |
| `limit`     | number | Entries to return (default: 100) |
| `userId`    | string | Filter by user                   |
| `action`    | string | Filter by action                 |
| `resource`  | string | Filter by resource type          |
| `startDate` | string | From timestamp                   |
| `endDate`   | string | To timestamp                     |

**Response (200)**

```typescript
interface AuditLogResponse {
  data: Array<{
    id: string;
    user: { id: string; name: string } | null;
    action: string;
    resource: string;
    resourceId: string | null;
    details: Record<string, any> | null;
    ipAddress: string | null;
    timestamp: string;
  }>;
  meta: PaginationMeta;
}
```

---

### GET /api/admin/storage-stats

Get storage statistics.

**Permission**: `admin:read`

**Response (200)**

```typescript
interface StorageStatsResponse {
  data: {
    users: { total: number; active: number };
    messages: { total: number };
    expenses: { total: number; pending: number };
    journalEntries: { total: number; posted: number };
    auditLogs: { total: number };
  };
}
```

---

## ARIA Endpoints

**Base path**: `/api/aria`

**Permission**: `aria:use`

### GET /api/aria/conversations

List user's ARIA conversations.

**Response (200)**

```typescript
interface AriaConversationsResponse {
  data: Array<{
    id: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

---

### POST /api/aria/conversations

Create a new ARIA conversation.

**Response (201)**

```typescript
interface CreateConversationResponse {
  data: {
    id: string;
    title: string | null;
    createdAt: string;
  };
}
```

---

### GET /api/aria/conversations/:id

Get a conversation with its messages.

**Response (200)**

```typescript
interface AriaConversationDetailResponse {
  data: {
    id: string;
    title: string | null;
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      createdAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
  };
}
```

---

### DELETE /api/aria/conversations/:id

Delete a conversation and its messages.

**Response (204)**: No content

---

### POST /api/aria/chat

Send a message to ARIA and get an AI response.

**Request**

```typescript
interface AriaChatRequest {
  conversationId?: string; // Continue existing or create new
  message: string;
}
```

**Response (200)**

```typescript
interface AriaChatResponse {
  data: {
    conversationId: string;
    message: {
      id: string;
      role: "assistant";
      content: string;
      createdAt: string;
    };
  };
}
```

---

## Upload Endpoints

### POST /api/uploads/receipt

Upload receipt file.

**Headers**: `Content-Type: multipart/form-data`

**Form Data**

| Field  | Type | Description              |
| ------ | ---- | ------------------------ |
| `file` | File | Receipt image (max 10MB) |

**Response (200)**

```typescript
interface UploadResponse {
  data: {
    url: string;
    filename: string;
    size: number;
    mimeType: string;
  };
}
```

---

### POST /api/uploads/document

Upload document file.

**Form Data**

| Field    | Type   | Description          |
| -------- | ------ | -------------------- |
| `file`   | File   | Document file        |
| `folder` | string | Optional folder path |

---

## Error Handling

### Error Response Schema

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field?: string;
      message: string;
    }>;
    requestId?: string;
  };
}
```

### Error Codes

| Code               | HTTP Status | Description              |
| ------------------ | ----------- | ------------------------ |
| `UNAUTHORIZED`     | 401         | Missing or invalid token |
| `FORBIDDEN`        | 403         | Insufficient permissions |
| `NOT_FOUND`        | 404         | Resource not found       |
| `VALIDATION_ERROR` | 400         | Invalid request data     |
| `CONFLICT`         | 409         | Resource conflict        |
| `RATE_LIMITED`     | 429         | Too many requests        |
| `INTERNAL_ERROR`   | 500         | Server error             |

---

## Pagination

### Request Parameters

| Param       | Type   | Default | Description              |
| ----------- | ------ | ------- | ------------------------ |
| `page`      | number | 1       | Page number (1-indexed)  |
| `limit`     | number | 20      | Items per page (max 100) |
| `sortBy`    | string | -       | Field to sort by         |
| `sortOrder` | string | desc    | asc or desc              |

### Response Meta

```typescript
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### Cursor-Based Pagination (Messages)

For real-time data like messages, use cursor-based pagination:

**Request**

```
GET /api/messages/channels/:id/messages?limit=50&before=msg_abc123
```

**Response**

```typescript
interface CursorMeta {
  hasMore: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
}
```

---

## Related Documents

- [Project Overview](./PROJECT_OVERVIEW.md)
- [Modules Specification](./MODULES_SPECIFICATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Authentication & RBAC](./AUTH_RBAC.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Task Planning](./TASK_PLANNING.md)
