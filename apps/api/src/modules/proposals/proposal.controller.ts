import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { proposalService } from "@/modules/proposals/proposal.service";
import {
  createProposalSchema,
  proposalAskSchema,
  proposalDeclineSchema,
  proposalPassSchema,
  proposalQuerySchema,
  proposalRespondSchema,
  updateProposalSchema,
} from "@/modules/proposals/proposal.validation";

// Product proposals API.
//
// Routes gate READ access only. Whether a caller may take a given action depends
// on the proposal's status and, for answering a question, on whether they are the
// person who was asked. `requirePermission` cannot express either, so the real
// decision lives in the service. Gating actions at the route would look stricter
// and be wrong.
//
// Literal paths are declared BEFORE `/:id`, because Express matches in order and
// `/:id` would otherwise swallow "my-questions" and "questions".
//
// Who approves is NOT configured here. It is the Project CRM approval chain, at
// `/api/approval-chains/proposal`, and only a system administrator may change it.
// There used to be a pair of `/settings` routes holding two approver slots; they
// were removed rather than left in place, because a second way to configure
// approvers that no longer affects routing is worse than none.

const router = Router();

// Every route below needs a resolved user. Without this the request reaches
// `requirePermission` with no `req.user` and is refused as UNAUTHENTICATED (401)
// rather than unauthorised (403) — and the web client treats a 401 as an expired
// session, so the user is bounced to sign-in instead of being told no.
router.use(authenticate, requireActive);

// ── Literal paths ───────────────────────────────────────────────────────

/** Questions waiting on the caller, across every proposal. */
router.get(
  "/my-questions",
  requirePermission(PERMISSIONS.PROPOSALS_READ),
  asyncHandler(async (req, res) => {
    const data = await proposalService.myOpenQuestions(req.user!.id);
    res.json({ data });
  }),
);

/**
 * Answer a question. Authority is identity, so this carries only the read gate:
 * the service refuses anyone who is not the named assignee.
 */
router.post(
  "/questions/:requestId/respond",
  requirePermission(PERMISSIONS.PROPOSALS_READ),
  asyncHandler(async (req, res) => {
    const input = proposalRespondSchema.parse(req.body);
    const data = await proposalService.provideInformation(
      req.params.requestId as string,
      req.user!.id,
      req.user!.permissions,
      input.response,
      req,
    );
    res.json({ data });
  }),
);

// ── Collection ──────────────────────────────────────────────────────────

/** The queue: rows for one view, plus the counts for every view. */
router.get(
  "/",
  requirePermission(PERMISSIONS.PROPOSALS_READ),
  asyncHandler(async (req, res) => {
    const { view, search, type } = proposalQuerySchema.parse(req.query);
    const data = await proposalService.list(
      req.user!.id,
      req.user!.permissions,
      {
        view,
        search,
        type,
      },
    );
    res.json({ data });
  }),
);

/** Raise a proposal. Creating it submits it to the first reviewer. */
router.post(
  "/",
  requirePermission(PERMISSIONS.PROPOSALS_CREATE),
  asyncHandler(async (req, res) => {
    // Mapped field by field rather than spread, so the service contract stays
    // explicit and a new schema field cannot reach the database unnoticed.
    const input = createProposalSchema.parse(req.body);
    const data = await proposalService.create(
      req.user!.id,
      req.user!.permissions,
      {
        title: input.title,
        description: input.description,
        type: input.type,
        projectId: input.projectId ?? null,
        priority: input.priority ?? null,
      },
      req,
    );
    res.status(201).json({ data });
  }),
);

// ── Single proposal ─────────────────────────────────────────────────────

/** Everything the detail page needs, in one round trip. */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.PROPOSALS_READ),
  asyncHandler(async (req, res) => {
    const data = await proposalService.getDetail(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

/** Correct a proposal. Requester only, and only before the reviewer acts. */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.PROPOSALS_CREATE),
  asyncHandler(async (req, res) => {
    const input = updateProposalSchema.parse(req.body);
    const data = await proposalService.update(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

// ── Decisions ───────────────────────────────────────────────────────────
//
// All three carry the read gate only. Which stage the proposal is at decides
// which permission is actually required, and that is checked in the service.

/** Pass to the next tier, or approve if this is the final one. */
router.post(
  "/:id/pass",
  requirePermission(PERMISSIONS.PROPOSALS_READ),
  asyncHandler(async (req, res) => {
    const input = proposalPassSchema.parse(req.body);
    const data = await proposalService.pass(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.comment,
      req,
    );
    res.json({ data });
  }),
);

/** Decline. Terminal, and always requires a reason. */
router.post(
  "/:id/decline",
  requirePermission(PERMISSIONS.PROPOSALS_READ),
  asyncHandler(async (req, res) => {
    const input = proposalDeclineSchema.parse(req.body);
    const data = await proposalService.decline(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.reason,
      req,
    );
    res.json({ data });
  }),
);

/** Ask one or more people for information. Does not move the proposal. */
router.post(
  "/:id/ask",
  requirePermission(PERMISSIONS.PROPOSALS_READ),
  asyncHandler(async (req, res) => {
    const input = proposalAskSchema.parse(req.body);
    const data = await proposalService.askForInformation(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input.assigneeIds,
      input.question,
      req,
    );
    res.status(201).json({ data });
  }),
);

export default router;
