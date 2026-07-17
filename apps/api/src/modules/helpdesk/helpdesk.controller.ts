import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { logger } from "@/common/utils/logger";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { helpdeskService } from "@/modules/helpdesk/helpdesk.service";
import {
  createCommentSchema,
  createTicketSchema,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  ticketQuerySchema,
  updateHelpdeskSettingsSchema,
  updateTicketSchema,
} from "@/modules/helpdesk/helpdesk.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/options",
  requirePermission(
    PERMISSIONS.IT_READ,
    PERMISSIONS.IT_READ_ALL,
    PERMISSIONS.IT_CREATE,
  ),
  (_req, res) => {
    res.json({
      data: {
        categories: TICKET_CATEGORIES,
        priorities: TICKET_PRIORITIES,
        statuses: TICKET_STATUSES,
      },
    });
  },
);

router.get(
  "/",
  requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL),
  asyncHandler(async (req, res) => {
    const query = ticketQuerySchema.parse(req.query);
    const result = await helpdeskService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.IT_CREATE),
  asyncHandler(async (req, res) => {
    const input = createTicketSchema.parse(req.body);
    const result = await helpdeskService.create(input, req.user!.id);
    logger.info(
      `Helpdesk ticket created: #${result.data.ticketNumber} by ${req.user!.email}`,
    );
    res.status(201).json(result);
  }),
);

// Sidebar inbox badge — count of unresolved tickets the caller can
// see. Literal `/inbox-count` must register before `/:id` so Express
// doesn't parse the segment as an id (CLAUDE.md route-order pitfall).
router.get(
  "/inbox-count",
  requirePermission(
    PERMISSIONS.IT_READ,
    PERMISSIONS.IT_READ_ALL,
    PERMISSIONS.IT_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const result = await helpdeskService.inboxCount(
      req.user!.id,
      req.user!.permissions,
    );
    res.json(result);
  }),
);

// Assignee picker on the ticket detail sheet. IT/admins use this to
// hand off the ticket to a teammate; gated on `it:assign` so only
// designated triagers can read the list.
router.get(
  "/assignees",
  requirePermission(PERMISSIONS.IT_ASSIGN),
  asyncHandler(async (_req, res) => {
    const result = await helpdeskService.listAssignees();
    res.json(result);
  }),
);

// Notification settings — singleton row, gated on `it:settings-manage`.
// Literal `/settings` route must register before the `/:id` matcher
// below, or Express routes `settings` into `getById` and 404s.
router.get(
  "/settings",
  requirePermission(PERMISSIONS.IT_SETTINGS_MANAGE),
  asyncHandler(async (_req, res) => {
    const result = await helpdeskService.getSettings();
    res.json(result);
  }),
);

router.put(
  "/settings",
  requirePermission(PERMISSIONS.IT_SETTINGS_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateHelpdeskSettingsSchema.parse(req.body);
    const result = await helpdeskService.updateSettings(input, req.user!.id);
    logger.info(
      `Helpdesk notification settings updated by ${req.user!.email}`,
      {
        recipientCount: result.data.notifyEmails.length,
      },
    );
    res.json(result);
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await helpdeskService.getById(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json(result);
  }),
);

router.patch(
  "/:id",
  requirePermission(
    PERMISSIONS.IT_UPDATE,
    PERMISSIONS.IT_ASSIGN,
    PERMISSIONS.IT_RESOLVE,
    PERMISSIONS.IT_CREATE,
  ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateTicketSchema.parse(req.body);
    const result = await helpdeskService.update(
      id,
      input,
      req.user!.id,
      req.user!.permissions,
    );
    res.json(result);
  }),
);

router.get(
  "/:id/comments",
  requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await helpdeskService.listComments(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json(result);
  }),
);

router.post(
  "/:id/comments",
  requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createCommentSchema.parse(req.body);
    const result = await helpdeskService.addComment(
      id,
      input,
      req.user!.id,
      req.user!.permissions,
    );
    res.status(201).json(result);
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.IT_DELETE, PERMISSIONS.IT_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await helpdeskService.remove(
      id,
      req.user!.id,
      req.user!.permissions,
    );
    res.json(result);
  }),
);

export default router;
