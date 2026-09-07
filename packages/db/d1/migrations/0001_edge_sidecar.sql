-- D1 sidecar for Worker-local state (presence, workflow ids, handbook chunks).
-- Hyperdrive / Postgres remains the ERP source of truth.

CREATE TABLE IF NOT EXISTS edge_presence (
  channel_id TEXT PRIMARY KEY,
  occupants TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS edge_workflow_instances (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS edge_workflow_instances_subject_idx
  ON edge_workflow_instances (kind, subject_id);

CREATE TABLE IF NOT EXISTS edge_handbook_chunks (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  vector_id TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS edge_handbook_chunks_source_idx
  ON edge_handbook_chunks (source_type, source_id);
