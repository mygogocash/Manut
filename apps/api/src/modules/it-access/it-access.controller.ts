import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { itAccessService } from "@/modules/it-access/it-access.service";
import {
  createRequestSchema,
  createSystemSchema,
  decisionSchema,
  grantSchema,
  rejectSchema,
  requestQuerySchema,
  revokeAssignmentSchema,
  updateRequestSchema,
  updateSystemSchema,
} from "@/modules/it-access/it-access.validation";

const router = Router();
router.use(authenticate, requireActive);

// Any access reader/requester/approver/manager can hit read routes; the
// service scopes rows. Approve/grant/manage gate at the route + service.
const READ = [
  PERMISSIONS.IT_ACCESS_REQUEST,
  PERMISSIONS.IT_ACCESS_VIEW,
  PERMISSIONS.IT_ACCESS_APPROVE,
  PERMISSIONS.IT_ACCESS_MANAGE,
];
const VIEW_ALL = [
  PERMISSIONS.IT_ACCESS_VIEW,
  PERMISSIONS.IT_ACCESS_APPROVE,
  PERMISSIONS.IT_ACCESS_MANAGE,
];
const MANAGE = [PERMISSIONS.IT_ACCESS_MANAGE];

// ── Systems (literal, before "/requests/:id" etc.) ──
router.get(
  "/systems",
  requirePermission(...READ),
  asyncHandler(async (req, res) => {
    res.json(await itAccessService.listSystems(req.query.active === "true"));
  }),
);
router.post(
  "/systems",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const input = createSystemSchema.parse(req.body);
    res
      .status(201)
      .json(await itAccessService.createSystem(input, req.user!.id, req));
  }),
);
router.patch(
  "/systems/:id",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateSystemSchema.parse(req.body);
    res.json(await itAccessService.updateSystem(id, input, req.user!.id, req));
  }),
);
router.delete(
  "/systems/:id",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await itAccessService.deleteSystem(id, req.user!.id, req));
  }),
);

// ── Assignments ──
router.get(
  "/assignments",
  requirePermission(...VIEW_ALL),
  asyncHandler(async (req, res) => {
    res.json(
      await itAccessService.listAssignments({
        employeeId:
          typeof req.query.employeeId === "string"
            ? req.query.employeeId
            : undefined,
        systemId:
          typeof req.query.systemId === "string"
            ? req.query.systemId
            : undefined,
        status:
          typeof req.query.status === "string" ? req.query.status : undefined,
      }),
    );
  }),
);
router.post(
  "/assignments/:id/revoke",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = revokeAssignmentSchema.parse(req.body);
    res.json(
      await itAccessService.revokeAssignment(id, input, req.user!.id, req),
    );
  }),
);
router.post(
  "/offboarding/:employeeId",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const employeeId = getRequiredParam(req.params, "employeeId");
    const reason =
      typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : "Employee offboarding";
    res.json(
      await itAccessService.offboardEmployee(
        employeeId,
        req.user!.id,
        reason,
        req,
      ),
    );
  }),
);

// ── Audit trail ──
router.get(
  "/audit",
  requirePermission(...VIEW_ALL),
  asyncHandler(async (req, res) => {
    res.json(
      await itAccessService.listAudit({
        requestId:
          typeof req.query.requestId === "string"
            ? req.query.requestId
            : undefined,
        targetUserId:
          typeof req.query.targetUserId === "string"
            ? req.query.targetUserId
            : undefined,
      }),
    );
  }),
);

// ── Requests ──
router.get(
  "/requests",
  requirePermission(...READ),
  asyncHandler(async (req, res) => {
    const query = requestQuerySchema.parse(req.query);
    res.json(
      await itAccessService.listRequests(
        req.user!.id,
        req.user!.permissions,
        query,
      ),
    );
  }),
);
router.post(
  "/requests",
  requirePermission(...READ),
  asyncHandler(async (req, res) => {
    const input = createRequestSchema.parse(req.body);
    res
      .status(201)
      .json(
        await itAccessService.createRequest(
          input,
          req.user!.id,
          req.user!.permissions,
          req,
        ),
      );
  }),
);
router.get(
  "/requests/:id",
  requirePermission(...READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(
      await itAccessService.getRequest(id, req.user!.id, req.user!.permissions),
    );
  }),
);
router.patch(
  "/requests/:id",
  requirePermission(...READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateRequestSchema.parse(req.body);
    res.json(
      await itAccessService.updateRequest(
        id,
        input,
        req.user!.id,
        req.user!.permissions,
        req,
      ),
    );
  }),
);
router.delete(
  "/requests/:id",
  requirePermission(...READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(
      await itAccessService.deleteRequest(
        id,
        req.user!.id,
        req.user!.permissions,
        req,
      ),
    );
  }),
);
router.post(
  "/requests/:id/submit",
  requirePermission(...READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(
      await itAccessService.submitRequest(
        id,
        req.user!.id,
        req.user!.permissions,
        req,
      ),
    );
  }),
);
// Approve / reject open to readers; service enforces step authorization.
router.post(
  "/requests/:id/approve",
  requirePermission(...READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = decisionSchema.parse(req.body);
    res.json(
      await itAccessService.approveRequest(
        id,
        input,
        req.user!.id,
        req.user!.permissions,
        req,
      ),
    );
  }),
);
router.post(
  "/requests/:id/reject",
  requirePermission(...READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = rejectSchema.parse(req.body);
    res.json(
      await itAccessService.rejectRequest(
        id,
        input,
        req.user!.id,
        req.user!.permissions,
        req,
      ),
    );
  }),
);
router.post(
  "/requests/:id/grant",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = grantSchema.parse(req.body);
    res.json(await itAccessService.grantRequest(id, input, req.user!.id, req));
  }),
);

export default router;
