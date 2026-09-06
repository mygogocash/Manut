import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { PERMISSIONS } from "@nexora/contracts";
import { createEdgeDb, edgeSchema } from "@nexora/db";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";
import { chunkHandbookText, rankHandbookChunks, type HandbookChunk } from "../lib/handbook";
import { enqueueSidecarJob } from "../lib/jobs";

const searchQuery = z.object({ q: z.string().min(1).max(500) });
const ingestBody = z.object({
  sourceType: z.enum(["policy", "article", "doc"]),
  sourceId: z.string().min(1),
  title: z.string().min(1).max(240),
  text: z.string().min(1).max(50_000),
});

const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";

export const handbook = new Hono<AppEnv>()
  .get(
    "/search",
    requirePermission(PERMISSIONS.POLICY_READ, PERMISSIONS.PR_READ, PERMISSIONS.DOCS_READ),
    zValidator("query", searchQuery),
    async (c) => {
      const q = c.req.valid("query").q;
      const semantic = await semanticSearch(c.env, q);
      if (semantic) return c.json({ data: semantic, mode: "vectorize" as const });
      const chunks = await loadChunks(c.env);
      return c.json({ data: rankHandbookChunks(q, chunks), mode: "fallback" as const });
    },
  )
  .post("/ingest", requirePermission(PERMISSIONS.POLICY_MANAGE), zValidator("json", ingestBody), async (c) => {
    const body = c.req.valid("json");
    const passages = chunkHandbookText(body.text);
    const stored = await persistChunks(c.env, body, passages);
    await enqueueSidecarJob(c.env, "handbook-ingest", body.sourceId).catch(() => false);
    return c.json({ data: { chunks: stored } }, 201);
  });

async function loadChunks(env: AppEnv["Bindings"]): Promise<HandbookChunk[]> {
  if (!env.EDGE_DB) return [];
  const db = createEdgeDb(env.EDGE_DB);
  const rows = await db.select().from(edgeSchema.edgeHandbookChunks);
  return rows.map((row) => ({
    id: row.id,
    sourceType: row.sourceType as HandbookChunk["sourceType"],
    sourceId: row.sourceId,
    title: row.title,
    excerpt: row.excerpt,
    vectorId: row.vectorId,
  }));
}

async function persistChunks(
  env: AppEnv["Bindings"],
  body: z.infer<typeof ingestBody>,
  passages: string[],
): Promise<number> {
  if (!env.EDGE_DB) return 0;
  const db = createEdgeDb(env.EDGE_DB);
  await db.delete(edgeSchema.edgeHandbookChunks).where(eq(edgeSchema.edgeHandbookChunks.sourceId, body.sourceId));
  const now = Date.now();
  const values = passages.map((excerpt, index) => ({
    id: `${body.sourceType}:${body.sourceId}:${index}`,
    sourceType: body.sourceType,
    sourceId: body.sourceId,
    title: body.title,
    excerpt,
    vectorId: null as string | null,
    updatedAt: now,
  }));
  if (values.length) await db.insert(edgeSchema.edgeHandbookChunks).values(values);
  if (env.AI && env.HANDBOOK) {
    const embeddings = await env.AI.run(EMBED_MODEL, { text: passages });
    const vectors = (embeddings as { data?: number[][] }).data ?? [];
    await env.HANDBOOK.upsert(
      values.map((row, i) => ({
        id: row.id,
        values: vectors[i] ?? [],
        metadata: { title: row.title, sourceId: row.sourceId, sourceType: row.sourceType, excerpt: row.excerpt },
      })),
    );
  }
  return values.length;
}

async function semanticSearch(env: AppEnv["Bindings"], q: string): Promise<HandbookChunk[] | null> {
  if (!env.AI || !env.HANDBOOK) return null;
  try {
    const embedded = await env.AI.run(EMBED_MODEL, { text: [q] });
    const vector = (embedded as { data?: number[][] }).data?.[0];
    if (!vector) return null;
    const matches = await env.HANDBOOK.query(vector, { topK: 8, returnMetadata: "all" });
    return (matches.matches ?? []).map((match) => {
      const meta = (match.metadata ?? {}) as Record<string, string>;
      return {
        id: match.id,
        sourceType: (meta.sourceType as HandbookChunk["sourceType"]) ?? "doc",
        sourceId: meta.sourceId ?? match.id,
        title: meta.title ?? match.id,
        excerpt: meta.excerpt ?? "",
        vectorId: match.id,
      };
    });
  } catch {
    return null;
  }
}
