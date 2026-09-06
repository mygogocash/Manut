import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PERMISSIONS } from "@nexora/contracts";
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
} from "@nexora/contracts/modules/leave/leave.validation";
import { leaveService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";
import { signalLeaveDecision, startLeaveApprovalWorkflow } from "../lib/leave-workflow";

const leaveRead = [PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_HR_READ] as const;
const leaveApprove = [PERMISSIONS.LEAVE_APPROVE, PERMISSIONS.LEAVE_HR_READ] as const;
const leaveRequestPerm = [PERMISSIONS.LEAVE_REQUEST, PERMISSIONS.LEAVE_HR_ON_BEHALF] as const;

const typesQuerySchema = z.object({
  entityId: z.string().optional(),
});

const allTypesQuerySchema = z.object({
  entityId: z.string().optional(),
});

const notificationRecipientsSchema = z.object({
  emails: z.array(z.string()).optional(),
});

export const leave = new Hono<AppEnv>()
  .get("/types", requirePermission(...leaveRead), zValidator("query", typesQuerySchema), async (c) => {
    const user = c.var.user!;
    const isHr = user.permissions.includes(PERMISSIONS.LEAVE_HR_READ);
    const { entityId: rawEntityId } = c.req.valid("query");
    let entityOverride: string | null | undefined;
    if (isHr && rawEntityId !== undefined) {
      entityOverride = rawEntityId === "global" ? null : rawEntityId;
    }
    const data = await leaveService.getTypes(c.var.db, user.id, entityOverride);
    return c.json({ data });
  })
  .get("/types/all", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), zValidator("query", allTypesQuerySchema), async (c) => {
    const { entityId } = c.req.valid("query");
    const filters: { entityId?: string | "global" | null } = {};
    if (entityId === "global") filters.entityId = "global";
    else if (entityId) filters.entityId = entityId;
    const data = await leaveService.getAllTypes(c.var.db, filters);
    return c.json({ data });
  })
  .post("/types", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), zValidator("json", createLeaveTypeSchema), async (c) => {
    const data = await leaveService.createType(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .put("/types/:id", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), zValidator("json", updateLeaveTypeSchema), async (c) => {
    const data = await leaveService.updateType(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/types/:id", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), async (c) => {
    const data = await leaveService.deleteType(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .get("/types/:id/approvers", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), async (c) => {
    const data = await leaveService.getApprovers(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .put(
    "/types/:id/approvers",
    requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
    zValidator("json", setLeavePolicyApproversSchema),
    async (c) => {
      const data = await leaveService.setApprovers(c.var.db, c.req.param("id"), c.req.valid("json"));
      return c.json({ data });
    },
  )
  .get("/balances", requirePermission(...leaveRead), zValidator("query", balanceQuerySchema), async (c) => {
    const user = c.var.user!;
    const data = await leaveService.getBalances(c.var.db, user.id, user.permissions, c.req.valid("query"));
    return c.json({ data });
  })
  .get("/team-balances", requirePermission(...leaveApprove), zValidator("query", teamBalanceQuerySchema), async (c) => {
    const user = c.var.user!;
    const data = await leaveService.getTeamBalances(c.var.db, user.id, user.permissions, c.req.valid("query"));
    return c.json({ data });
  })
  .get("/calendar", requirePermission(...leaveRead), zValidator("query", leaveCalendarQuerySchema), async (c) => {
    const user = c.var.user!;
    const result = await leaveService.getCalendar(c.var.db, user.id, user.permissions, c.req.valid("query"));
    return c.json(result);
  })
  .get("/analytics", requirePermission(...leaveRead), zValidator("query", leaveAnalyticsQuerySchema), async (c) => {
    const user = c.var.user!;
    const result = await leaveService.getAnalytics(c.var.db, user.id, user.permissions, c.req.valid("query"));
    return c.json(result);
  })
  .get("/preview-approvers", requirePermission(...leaveRead), zValidator("query", previewApproversQuerySchema), async (c) => {
    const user = c.var.user!;
    const result = await leaveService.previewApprovers(
      c.var.db,
      c.req.valid("query").employeeId,
      user.id,
      user.permissions,
    );
    return c.json(result);
  })
  .get("/balances/drift", requirePermission(PERMISSIONS.LEAVE_HR_READ), zValidator("query", balanceDriftQuerySchema), async (c) => {
    const result = await leaveService.getBalanceDrift(c.var.db, c.req.valid("query").year);
    return c.json(result);
  })
  .post(
    "/balances/import/preview",
    requirePermission(PERMISSIONS.LEAVE_BULK_IMPORT),
    zValidator("json", bulkImportBalanceSchema),
    async (c) => {
      const result = await leaveService.previewBulkImport(c.var.db, c.req.valid("json").rows);
      return c.json(result);
    },
  )
  .post(
    "/balances/import/commit",
    requirePermission(PERMISSIONS.LEAVE_BULK_IMPORT),
    zValidator("json", bulkImportBalanceSchema),
    async (c) => {
      const result = await leaveService.commitBulkImport(c.var.db, c.req.valid("json").rows);
      return c.json(result);
    },
  )
  .post("/balances", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), zValidator("json", upsertLeaveBalanceSchema), async (c) => {
    const data = await leaveService.upsertBalance(c.var.db, c.req.valid("json"), c.var.user!.id);
    return c.json({ data }, 201);
  })
  .put("/balances/:id", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), zValidator("json", updateLeaveBalanceSchema), async (c) => {
    const data = await leaveService.updateBalance(c.var.db, c.req.param("id"), c.req.valid("json"), c.var.user!.id);
    return c.json({ data });
  })
  .get(
    "/balance-transactions",
    requirePermission(...leaveRead),
    zValidator("query", balanceTransactionsQuerySchema),
    async (c) => {
      const user = c.var.user!;
      const query = c.req.valid("query");
      const result = await leaveService.getBalanceTransactions(
        c.var.db,
        user.id,
        user.permissions,
        query.employeeId,
        query.year,
        query.leaveTypeId,
      );
      return c.json(result);
    },
  )
  .get("/requests", requirePermission(...leaveRead), zValidator("query", leaveRequestQuerySchema), async (c) => {
    const user = c.var.user!;
    const result = await leaveService.getRequests(c.var.db, user.id, user.permissions, c.req.valid("query"));
    return c.json(result);
  })
  .post("/requests", requirePermission(...leaveRequestPerm), zValidator("json", createLeaveRequestSchema), async (c) => {
    const user = c.var.user!;
    const data = await leaveService.createRequest(c.var.db, user.id, user.permissions, c.req.valid("json"));
    c.executionCtx.waitUntil(startLeaveApprovalWorkflow(c.env, { requestId: data.id, employeeId: data.employeeId ?? user.id }));
    return c.json({ data }, 201);
  })
  .post(
    "/requests/:id/forward",
    requirePermission(...leaveApprove),
    zValidator("json", forwardLeaveRequestSchema),
    async (c) => {
      const user = c.var.user!;
      const data = await leaveService.forwardRequest(
        c.var.db,
        c.req.param("id"),
        user.id,
        user.permissions,
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .get("/requests/:id", requirePermission(...leaveRead), async (c) => {
    const user = c.var.user!;
    const data = await leaveService.getRequestById(c.var.db, c.req.param("id"), user.id, user.permissions);
    return c.json({ data });
  })
  .put("/requests/:id/approve", requirePermission(...leaveApprove), async (c) => {
    const user = c.var.user!;
    const data = await leaveService.approveRequest(c.var.db, c.req.param("id"), user.id, user.permissions);
    c.executionCtx.waitUntil(signalLeaveDecision(c.env, c.req.param("id"), "approved"));
    return c.json({ data });
  })
  .put("/requests/:id/reject", requirePermission(...leaveApprove), zValidator("json", rejectLeaveRequestSchema), async (c) => {
    const user = c.var.user!;
    const { reason } = c.req.valid("json");
    const data = await leaveService.rejectRequest(c.var.db, c.req.param("id"), user.id, reason, user.permissions);
    c.executionCtx.waitUntil(signalLeaveDecision(c.env, c.req.param("id"), "rejected"));
    return c.json({ data });
  })
  .put("/requests/:id/cancel", requirePermission(PERMISSIONS.LEAVE_REQUEST), async (c) => {
    const data = await leaveService.cancelRequest(c.var.db, c.req.param("id"), c.var.user!.id);
    c.executionCtx.waitUntil(signalLeaveDecision(c.env, c.req.param("id"), "cancelled"));
    return c.json({ data });
  })
  .put("/requests/:id/approve-cancellation", requirePermission(...leaveApprove), async (c) => {
    const user = c.var.user!;
    const data = await leaveService.approveCancellation(c.var.db, c.req.param("id"), user.id, user.permissions);
    return c.json({ data });
  })
  .put("/requests/:id/reject-cancellation", requirePermission(...leaveApprove), async (c) => {
    const user = c.var.user!;
    const data = await leaveService.rejectCancellation(c.var.db, c.req.param("id"), user.id, user.permissions);
    return c.json({ data });
  })
  .delete("/requests/:id", requirePermission(PERMISSIONS.LEAVE_REQUEST), async (c) => {
    const user = c.var.user!;
    const data = await leaveService.removeRequest(c.var.db, c.req.param("id"), user.id, user.permissions);
    return c.json({ data });
  })
  .post("/requests/:id/restore", requirePermission(PERMISSIONS.LEAVE_REQUEST), async (c) => {
    const user = c.var.user!;
    const data = await leaveService.restoreRequest(c.var.db, c.req.param("id"), user.id, user.permissions);
    return c.json({ data });
  })
  .delete("/requests/:id/permanent", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), async (c) => {
    const data = await leaveService.permanentDeleteRequest(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .get(
    "/approval-steps",
    requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS, PERMISSIONS.LEAVE_APPROVE),
    async (c) => {
      const data = await leaveService.listApprovalSteps(c.var.db);
      return c.json({ data });
    },
  )
  .post(
    "/approval-steps",
    requirePermission(PERMISSIONS.LEAVE_ASSIGN_APPROVER),
    zValidator("json", createLeaveApprovalStepSchema),
    async (c) => {
      const data = await leaveService.createApprovalStep(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .post(
    "/approval-steps/reorder",
    requirePermission(PERMISSIONS.LEAVE_ASSIGN_APPROVER),
    zValidator("json", reorderLeaveApprovalStepsSchema),
    async (c) => {
      const data = await leaveService.reorderApprovalSteps(c.var.db, c.req.valid("json"));
      return c.json({ data });
    },
  )
  .put(
    "/approval-steps/:stepId",
    requirePermission(PERMISSIONS.LEAVE_ASSIGN_APPROVER),
    zValidator("json", updateLeaveApprovalStepSchema),
    async (c) => {
      const data = await leaveService.updateApprovalStep(c.var.db, c.req.param("stepId"), c.req.valid("json"));
      return c.json({ data });
    },
  )
  .delete("/approval-steps/:stepId", requirePermission(PERMISSIONS.LEAVE_ASSIGN_APPROVER), async (c) => {
    await leaveService.deleteApprovalStep(c.var.db, c.req.param("stepId"));
    return c.json({ data: { success: true } });
  })
  .get("/notification-recipients", requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS), async (c) => {
    const data = await leaveService.getNotificationRecipients(c.var.db);
    return c.json({ data });
  })
  .put(
    "/notification-recipients",
    requirePermission(PERMISSIONS.LEAVE_HR_SETTINGS),
    zValidator("json", notificationRecipientsSchema),
    async (c) => {
      const emails = c.req.valid("json").emails ?? [];
      const data = await leaveService.setNotificationRecipients(c.var.db, emails);
      return c.json({ data });
    },
  );
