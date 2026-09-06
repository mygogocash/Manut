import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Cloudflare D1 sidecar — Worker-local state only.
 * ERP tables (users, leave, CRM, …) stay on Hyperdrive → Postgres.
 * Do not add those models here.
 */
export const edgePresence = sqliteTable("edge_presence", {
  channelId: text("channel_id").primaryKey(),
  occupants: text("occupants").notNull().default("[]"),
  updatedAt: integer("updated_at").notNull(),
});

export const edgeWorkflowInstances = sqliteTable("edge_workflow_instances", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  subjectId: text("subject_id").notNull(),
  instanceId: text("instance_id").notNull(),
  status: text("status").notNull().default("running"),
  createdAt: integer("created_at").notNull(),
});

export const edgeHandbookChunks = sqliteTable("edge_handbook_chunks", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  vectorId: text("vector_id"),
  updatedAt: integer("updated_at").notNull(),
});
