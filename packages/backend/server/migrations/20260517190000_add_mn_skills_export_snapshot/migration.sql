-- CreateEnum
CREATE TYPE "MnSkillSource" AS ENUM ('BUILTIN', 'WORKSPACE', 'IMPORTED');

-- CreateTable
CREATE TABLE "mn_skills" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "slug" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "content_md" TEXT NOT NULL,
    "version" VARCHAR NOT NULL,
    "source" "MnSkillSource" NOT NULL DEFAULT 'WORKSPACE',
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_export_snapshots" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "created_by_user_id" VARCHAR,
    "manifest" JSONB NOT NULL,
    "sha256" VARCHAR NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "payload_blob_key" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_export_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mn_skills_workspace_id_source_idx" ON "mn_skills"("workspace_id", "source");

-- CreateIndex
CREATE INDEX "mn_skills_workspace_id_archived_at_idx" ON "mn_skills"("workspace_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "mn_skills_workspace_id_slug_key" ON "mn_skills"("workspace_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "mn_export_snapshots_sha256_key" ON "mn_export_snapshots"("sha256");

-- CreateIndex
CREATE INDEX "mn_export_snapshots_workspace_id_created_at_idx" ON "mn_export_snapshots"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mn_export_snapshots_created_by_user_id_idx" ON "mn_export_snapshots"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "mn_skills" ADD CONSTRAINT "mn_skills_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_export_snapshots" ADD CONSTRAINT "mn_export_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_export_snapshots" ADD CONSTRAINT "mn_export_snapshots_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

