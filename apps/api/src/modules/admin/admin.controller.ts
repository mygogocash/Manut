import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import { authenticate, requirePermission } from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { logAudit } from "@/infrastructure/audit/audit.service";
import { adminService } from "@/modules/admin/admin.service";
import {
  createDepartmentSchema,
  createUserGroupSchema,
  manageGroupMembersSchema,
  updateDepartmentSchema,
  updateModuleAccessSchema,
  updateSettingsSchema,
  updateUserGroupSchema,
} from "@/modules/admin/admin.validation";

const router = Router();

router.get(
  "/audit-log",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_AUDIT_LOG),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const resource =
      typeof req.query.resource === "string" ? req.query.resource : undefined;
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : undefined;
    const action =
      typeof req.query.action === "string" ? req.query.action : undefined;
    const result = await adminService.listAuditLogs(page, limit, {
      resource,
      userId,
      action,
    });
    res.json(result);
  }),
);

router.get(
  "/settings",
  authenticate,
  // System Settings expose workspace-wide notification recipients
  // (Expenses / Leave / Travel / Visa CC). Read needs the same elevated
  // permission as write so a team lead with plain `admin:read` can't
  // exfiltrate the HR / legal distribution list.
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (_req, res) => {
    const settings = await adminService.getSettings();
    res.json({ data: settings });
  }),
);

router.get(
  "/entities",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_READ, PERMISSIONS.USER_READ),
  asyncHandler(async (_req, res) => {
    const result = await adminService.listEntities();
    res.json(result);
  }),
);

router.put(
  "/settings",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateSettingsSchema.parse(req.body);
    const settings = await adminService.updateSettings(input);
    res.json({ data: settings });
  }),
);

router.get(
  "/module-access/:userId",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const userId = req.params.userId as string;
    const result = await adminService.getModuleAccess(userId);
    res.json(result);
  }),
);

router.put(
  "/module-access",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateModuleAccessSchema.parse(req.body);
    const result = await adminService.updateModuleAccess(input, req.user!.id);
    void logAudit({
      action: "update",
      resource: "module-access",
      resourceId: input.userId,
      details: { modules: input.modules },
      req,
    });
    res.json(result);
  }),
);

// ── User Groups ──

router.get(
  "/user-groups",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_READ),
  asyncHandler(async (_req, res) => {
    const result = await adminService.listUserGroups();
    res.json(result);
  }),
);

router.post(
  "/user-groups",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createUserGroupSchema.parse(req.body);
    const data = await adminService.createUserGroup(input, req.user!.id);
    void logAudit({
      action: "create",
      resource: "user-group",
      resourceId: data.id,
      details: { name: input.name },
      req,
    });
    res.status(201).json({ data });
  }),
);

router.get(
  "/user-groups/:id",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await adminService.getUserGroup(id);
    res.json({ data });
  }),
);

router.put(
  "/user-groups/:id",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateUserGroupSchema.parse(req.body);
    const data = await adminService.updateUserGroup(id, input);
    void logAudit({
      action: "update",
      resource: "user-group",
      resourceId: id,
      details: input,
      req,
    });
    res.json({ data });
  }),
);

router.delete(
  "/user-groups/:id",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await adminService.deleteUserGroup(id);
    void logAudit({
      action: "delete",
      resource: "user-group",
      resourceId: id,
      req,
    });
    res.json({ data: { success: true } });
  }),
);

router.post(
  "/user-groups/:id/members",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = manageGroupMembersSchema.parse(req.body);
    const data = await adminService.addGroupMembers(id, input, req.user!.id);
    res.json({ data });
  }),
);

router.delete(
  "/user-groups/:id/members",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = manageGroupMembersSchema.parse(req.body);
    const data = await adminService.removeGroupMembers(id, input);
    res.json({ data });
  }),
);

// ── Departments (Form Configuration) ──

router.get(
  "/departments",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_READ, PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (_req, res) => {
    const result = await adminService.listDepartments();
    res.json(result);
  }),
);

router.post(
  "/departments",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createDepartmentSchema.parse(req.body);
    const result = await adminService.createDepartment(input);
    void logAudit({
      action: "create",
      resource: "department",
      resourceId: result.data.id,
      details: { name: input.name },
      req,
    });
    res.status(201).json(result);
  }),
);

router.put(
  "/departments/:id",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateDepartmentSchema.parse(req.body);
    const result = await adminService.updateDepartment(id, input);
    void logAudit({
      action: "update",
      resource: "department",
      resourceId: id,
      details: input,
      req,
    });
    res.json(result);
  }),
);

router.delete(
  "/departments/:id",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await adminService.deleteDepartment(id);
    void logAudit({
      action: "deactivate",
      resource: "department",
      resourceId: id,
      req,
    });
    res.json(result);
  }),
);

export default router;
