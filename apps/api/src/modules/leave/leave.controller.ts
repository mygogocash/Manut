import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { leaveService } from "@/modules/leave/leave.service";
import {
  balanceDriftQuerySchema,
  balanceQuerySchema,
  balanceTransactionsQuerySchema,
  bulkImportBalanceSchema,
  createLeaveApprovalStepSchema,
  createLeaveRequestSchema,
  createLeaveTypeSchema,
  forwardLeaveRequestSchema,
  leaveAnalyticsQuerySchema,
  leaveCalendarQuerySchema,
  leaveRequestQuerySchema,
  previewApproversQuerySchema,
  rejectLeaveRequestSchema,
  reorderLeaveApprovalStepsSchema,
  setLeavePolicyApproversSchema,
  teamBalanceQuerySchema,
  updateLeaveApprovalStepSchema,
  updateLeaveBalanceSchema,
  updateLeaveTypeSchema,
  upsertLeaveBalanceSchema,
} from "@/modules/leave/leave.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/types",
  requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    // HR can preview a specific entity by passing ?entityId=<id>
    // (or "global" for entity-agnostic policies). Other users get
    // their own entity automatically.
    const isHr = req.user!.permissions.includes(PERMISSIONS.LEAVE_HR_READ);
    let entityOverride: string | null | undefined;
    if (isHr && typeof req.query.entityId === "string") {
      entityOverride =
        req.query.entityId === "global" ? null : req.query.entityId;
    }
    const data = await leaveService.getTypes(req.user!.id, entityOverride);
    res.json({ data });
  }),
);

// Literal /types/all must come before /types/:id once that route exists.
router.get(
  "/types/all",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const entityId =
      typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const filters: { entityId?: string | "global" | null } = {};
    if (entityId === "global") filters.entityId = "global";
    else if (entityId) filters.entityId = entityId;
    const data = await leaveService.getAllTypes(filters);
    res.json({ data });
  }),
);

router.post(
  "/types",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const input = createLeaveTypeSchema.parse(req.body);
    const data = await leaveService.createType(input);
    res.status(201).json({ data });
  }),
);

router.put(
  "/types/:id",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateLeaveTypeSchema.parse(req.body);
    const data = await leaveService.updateType(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/types/:id",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.deleteType(id);
    res.json({ data });
  }),
);

router.get(
  "/types/:id/approvers",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.getApprovers(id);
    res.json({ data });
  }),
);

router.put(
  "/types/:id/approvers",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = setLeavePolicyApproversSchema.parse(req.body);
    const data = await leaveService.setApprovers(id, input);
    res.json({ data });
  }),
);

router.get(
  "/balances",
  requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const query = balanceQuerySchema.parse(req.query);
    const data = await leaveService.getBalances(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json({ data });
  }),
);

router.get(
  "/team-balances",
  requirePermission(PERMISSIONS.LEAVE_APPROVE, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const query = teamBalanceQuerySchema.parse(req.query);
    const data = await leaveService.getTeamBalances(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json({ data });
  }),
);

router.get(
  "/calendar",
  requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const query = leaveCalendarQuerySchema.parse(req.query);
    const result = await leaveService.getCalendar(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.get(
  "/analytics",
  requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const query = leaveAnalyticsQuerySchema.parse(req.query);
    const result = await leaveService.getAnalytics(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.get(
  "/preview-approvers",
  requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const { employeeId } = previewApproversQuerySchema.parse(req.query);
    const result = await leaveService.previewApprovers(
      employeeId,
      req.user!.id,
      req.user!.permissions,
    );
    res.json(result);
  }),
);

// Read-only drift report: balances whose stored `used` counter no longer
// matches the employee's visible approved requests. Literal path, so it
// is registered alongside the other /balances routes and well clear of
// the "/balances/:id" PUT.
router.get(
  "/balances/drift",
  requirePermission(PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const query = balanceDriftQuerySchema.parse(req.query);
    const result = await leaveService.getBalanceDrift(query.year);
    res.json(result);
  }),
);

router.post(
  "/balances/import/preview",
  requirePermission(PERMISSIONS.LEAVE_BULK_IMPORT),
  asyncHandler(async (req, res) => {
    const { rows } = bulkImportBalanceSchema.parse(req.body);
    const result = await leaveService.previewBulkImport(rows);
    res.json(result);
  }),
);

router.post(
  "/balances/import/commit",
  requirePermission(PERMISSIONS.LEAVE_BULK_IMPORT),
  asyncHandler(async (req, res) => {
    const { rows } = bulkImportBalanceSchema.parse(req.body);
    const result = await leaveService.commitBulkImport(rows);
    res.json(result);
  }),
);

// HR-only create-or-update keyed on (employeeId, leaveTypeId, year).
// Used when the team-balances UI edits a synthesized row that has no
// real LeaveBalance yet. Must come before the literal "/balances/:id"
// PUT so the route table stays unambiguous.
router.post(
  "/balances",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const input = upsertLeaveBalanceSchema.parse(req.body);
    const data = await leaveService.upsertBalance(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

// HR-only manual override for a single LeaveBalance row. Placed after
// the literal /balances/import/* routes so Express does not match
// "import" as the :id param.
router.put(
  "/balances/:id",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateLeaveBalanceSchema.parse(req.body);
    const data = await leaveService.updateBalance(id, input, req.user!.id);
    res.json({ data });
  }),
);

router.get(
  "/balance-transactions",
  requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const query = balanceTransactionsQuerySchema.parse(req.query);
    const result = await leaveService.getBalanceTransactions(
      req.user!.id,
      req.user!.permissions,
      query.employeeId,
      query.year,
      query.leaveTypeId,
    );
    res.json(result);
  }),
);

router.get(
  "/requests",
  requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const query = leaveRequestQuerySchema.parse(req.query);
    const result = await leaveService.getRequests(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/requests",
  requirePermission(PERMISSIONS.LEAVE_REQUEST, PERMISSIONS.LEAVE_HR_ON_BEHALF),
  asyncHandler(async (req, res) => {
    const input = createLeaveRequestSchema.parse(req.body);
    const data = await leaveService.createRequest(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.post(
  "/requests/:id/forward",
  requirePermission(PERMISSIONS.LEAVE_APPROVE, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const body = forwardLeaveRequestSchema.parse(req.body);
    const data = await leaveService.forwardRequest(
      id,
      req.user!.id,
      req.user!.permissions,
      body,
    );
    res.json({ data });
  }),
);

router.get(
  "/requests/:id",
  requirePermission(PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.getRequestById(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/requests/:id/approve",
  requirePermission(PERMISSIONS.LEAVE_APPROVE, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.approveRequest(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/requests/:id/reject",
  requirePermission(PERMISSIONS.LEAVE_APPROVE, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const { reason } = rejectLeaveRequestSchema.parse(req.body);
    const data = await leaveService.rejectRequest(
      id,
      req.user!.id,
      reason,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/requests/:id/cancel",
  requirePermission(PERMISSIONS.LEAVE_REQUEST),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.cancelRequest(id, req.user!.id);
    res.json({ data });
  }),
);

router.put(
  "/requests/:id/approve-cancellation",
  requirePermission(PERMISSIONS.LEAVE_APPROVE, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.approveCancellation(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/requests/:id/reject-cancellation",
  requirePermission(PERMISSIONS.LEAVE_APPROVE, PERMISSIONS.LEAVE_HR_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.rejectCancellation(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.delete(
  "/requests/:id",
  requirePermission(PERMISSIONS.LEAVE_REQUEST),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.removeRequest(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/requests/:id/restore",
  requirePermission(PERMISSIONS.LEAVE_REQUEST),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.restoreRequest(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.delete(
  "/requests/:id/permanent",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await leaveService.permanentDeleteRequest(id);
    res.json({ data });
  }),
);

// ── Org-wide approval chain (admin) ─────────────────────

router.get(
  "/approval-steps",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS, PERMISSIONS.LEAVE_APPROVE),
  asyncHandler(async (_req, res) => {
    const data = await leaveService.listApprovalSteps();
    res.json({ data });
  }),
);

router.post(
  "/approval-steps",
  requirePermission(PERMISSIONS.LEAVE_ASSIGN_APPROVER),
  asyncHandler(async (req, res) => {
    const input = createLeaveApprovalStepSchema.parse(req.body);
    const data = await leaveService.createApprovalStep(input);
    res.status(201).json({ data });
  }),
);

router.post(
  "/approval-steps/reorder",
  requirePermission(PERMISSIONS.LEAVE_ASSIGN_APPROVER),
  asyncHandler(async (req, res) => {
    const input = reorderLeaveApprovalStepsSchema.parse(req.body);
    const data = await leaveService.reorderApprovalSteps(input);
    res.json({ data });
  }),
);

router.put(
  "/approval-steps/:stepId",
  requirePermission(PERMISSIONS.LEAVE_ASSIGN_APPROVER),
  asyncHandler(async (req, res) => {
    const stepId = getRequiredParam(req.params, "stepId");
    const input = updateLeaveApprovalStepSchema.parse(req.body);
    const data = await leaveService.updateApprovalStep(stepId, input);
    res.json({ data });
  }),
);

router.delete(
  "/approval-steps/:stepId",
  requirePermission(PERMISSIONS.LEAVE_ASSIGN_APPROVER),
  asyncHandler(async (req, res) => {
    const stepId = getRequiredParam(req.params, "stepId");
    await leaveService.deleteApprovalStep(stepId);
    res.json({ data: { success: true } });
  }),
);

// HR-desk notification recipients — admin-configurable list of
// emails that receive the long-form summary on final approval.
// Stored in `SystemSetting` under `leave.notification_recipients`.
router.get(
  "/notification-recipients",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (_req, res) => {
    const data = await leaveService.getNotificationRecipients();
    res.json({ data });
  }),
);

router.put(
  "/notification-recipients",
  requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
  asyncHandler(async (req, res) => {
    const body = req.body as { emails?: unknown };
    const emails = Array.isArray(body.emails)
      ? (body.emails as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [];
    const data = await leaveService.setNotificationRecipients(emails);
    res.json({ data });
  }),
);

export default router;
