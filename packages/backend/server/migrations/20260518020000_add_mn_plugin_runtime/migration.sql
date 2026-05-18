-- CreateEnum
CREATE TYPE "MnPluginStatus" AS ENUM ('INSTALLED', 'LOADING', 'RUNNING', 'CRASHED', 'DISABLED');

-- CreateTable
CREATE TABLE "mn_plugins" (
    "id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "version" VARCHAR NOT NULL,
    "manifest_json" JSONB NOT NULL,
    "package_path" VARCHAR,
    "process_status" "MnPluginStatus" NOT NULL DEFAULT 'INSTALLED',
    "installed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mn_plugin_configs" (
    "id" VARCHAR NOT NULL,
    "plugin_id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "project_id" VARCHAR,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mn_plugin_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mn_plugins_name_key" ON "mn_plugins"("name");

-- CreateIndex
CREATE INDEX "mn_plugins_process_status_idx" ON "mn_plugins"("process_status");

-- CreateIndex
CREATE INDEX "mn_plugin_configs_workspace_id_idx" ON "mn_plugin_configs"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "mn_plugin_configs_plugin_id_workspace_id_project_id_key" ON "mn_plugin_configs"("plugin_id", "workspace_id", "project_id");

-- AddForeignKey
ALTER TABLE "mn_plugin_configs" ADD CONSTRAINT "mn_plugin_configs_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "mn_plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mn_plugin_configs" ADD CONSTRAINT "mn_plugin_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

