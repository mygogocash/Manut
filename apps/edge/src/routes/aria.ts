import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  chatSchema,
  createConversationSchema,
  createKnowledgeSchema,
  knowledgeQuerySchema,
  updateKnowledgeSchema,
} from "@nexora/contracts/modules/aria/aria.validation";
import { ariaService, streamChat } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const aria = new Hono<AppEnv>()
  .get("/conversations", requirePermission(PERMISSIONS.ARIA_USE), async (c) =>
    c.json(await ariaService.listConversations(c.var.db, c.var.user!.id)),
  )
  .post("/conversations", requirePermission(PERMISSIONS.ARIA_USE), zValidator("json", createConversationSchema), async (c) =>
    c.json(await ariaService.createConversation(c.var.db, c.var.user!.id, c.req.valid("json")), 201),
  )
  .get("/conversations/:id", requirePermission(PERMISSIONS.ARIA_USE), async (c) =>
    c.json(await ariaService.getConversation(c.var.db, c.var.user!.id, c.req.param("id"))),
  )
  .delete("/conversations/:id", requirePermission(PERMISSIONS.ARIA_USE), async (c) =>
    c.json(await ariaService.deleteConversation(c.var.db, c.var.user!.id, c.req.param("id"))),
  )
  .post("/chat", requirePermission(PERMISSIONS.ARIA_USE), zValidator("json", chatSchema), (c) =>
    streamChat(c.req.valid("json"), c.env),
  )
  .get("/tools", requirePermission(PERMISSIONS.ARIA_USE), async (c) =>
    c.json(ariaService.listTools(c.var.user!.permissions, c.var.user!.isSystemAdmin)),
  )
  .get("/knowledge", requirePermission(PERMISSIONS.ARIA_KNOWLEDGE_MANAGE), zValidator("query", knowledgeQuerySchema), async (c) =>
    c.json(await ariaService.listKnowledge(c.var.db, c.req.valid("query"))),
  )
  .post("/knowledge", requirePermission(PERMISSIONS.ARIA_KNOWLEDGE_MANAGE), zValidator("json", createKnowledgeSchema), async (c) =>
    c.json(await ariaService.createKnowledge(c.var.db, c.var.user!.id, c.req.valid("json")), 201),
  )
  .get("/knowledge/:id", requirePermission(PERMISSIONS.ARIA_KNOWLEDGE_MANAGE), async (c) =>
    c.json(await ariaService.getKnowledge(c.var.db, c.req.param("id"))),
  )
  .put("/knowledge/:id", requirePermission(PERMISSIONS.ARIA_KNOWLEDGE_MANAGE), zValidator("json", updateKnowledgeSchema), async (c) =>
    c.json(await ariaService.updateKnowledge(c.var.db, c.req.param("id"), c.req.valid("json"))),
  )
  .delete("/knowledge/:id", requirePermission(PERMISSIONS.ARIA_KNOWLEDGE_MANAGE), async (c) =>
    c.json(await ariaService.deleteKnowledge(c.var.db, c.req.param("id"))),
  );
