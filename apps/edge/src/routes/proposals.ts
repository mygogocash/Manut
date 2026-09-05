import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createProposalSchema,
  proposalAskSchema,
  proposalDeclineSchema,
  proposalPassSchema,
  proposalQuerySchema,
  proposalRespondSchema,
  updateProposalSchema,
} from "@nexora/contracts/modules/proposals/proposal.validation";
import { proposalsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const proposals = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.PROPOSALS_READ), zValidator("query", proposalQuerySchema), async (c) =>
    c.json(await proposalsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.PROPOSALS_CREATE),
    zValidator("json", createProposalSchema),
    async (c) => {
      const data = await proposalsService.create(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("json"),
      );
      return c.json({ data }, 201);
    },
  )
  .get("/my-questions", requirePermission(PERMISSIONS.PROPOSALS_READ), async (c) =>
    c.json({ data: await proposalsService.myOpenQuestions(c.var.db, c.var.user!.id) }),
  )
  .post(
    "/questions/:requestId/respond",
    requirePermission(PERMISSIONS.PROPOSALS_READ),
    zValidator("json", proposalRespondSchema),
    async (c) =>
      c.json({
        data: await proposalsService.provideInformation(
          c.var.db,
          c.req.param("requestId"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json").response,
        ),
      }),
  )
  .get("/:id", requirePermission(PERMISSIONS.PROPOSALS_READ), async (c) =>
    c.json({
      data: await proposalsService.getDetail(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.PROPOSALS_READ),
    zValidator("json", updateProposalSchema),
    async (c) =>
      c.json({
        data: await proposalsService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/:id/pass",
    requirePermission(PERMISSIONS.PROPOSALS_READ),
    zValidator("json", proposalPassSchema),
    async (c) =>
      c.json({
        data: await proposalsService.pass(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json").comment,
        ),
      }),
  )
  .post(
    "/:id/decline",
    requirePermission(PERMISSIONS.PROPOSALS_READ),
    zValidator("json", proposalDeclineSchema),
    async (c) =>
      c.json({
        data: await proposalsService.decline(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json").reason,
        ),
      }),
  )
  .post(
    "/:id/ask",
    requirePermission(PERMISSIONS.PROPOSALS_READ),
    zValidator("json", proposalAskSchema),
    async (c) =>
      c.json({
        data: await proposalsService.askForInformation(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json").assigneeIds,
          c.req.valid("json").question,
        ),
      }),
  );
