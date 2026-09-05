"use client";

import { Bell, FolderGit2, Plus } from "lucide-react";
import { useState } from "react";

import { GithubWorkflowConfigDialog } from "@/components/helpdesk/github-workflow-config-dialog";
import { NotificationSettingsDialog } from "@/components/helpdesk/notification-settings-dialog";
import { TicketCreateDialog } from "@/components/helpdesk/ticket-create-dialog";
import { TicketDetailSheet } from "@/components/helpdesk/ticket-detail-sheet";
import { TicketKanban } from "@/components/helpdesk/ticket-kanban";
import { TicketList } from "@/components/helpdesk/ticket-list";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";
import { useAuth } from "@/providers/auth-provider";

export default function ITHelpdeskPage() {
  const { hasPermission } = useAuth();
  const canSeeAll = hasPermission("it:read-all");
  const canMoveOnBoard =
    hasPermission("it:update") || hasPermission("it:resolve");
  const canManageSettings = hasPermission("it:settings-manage");

  const [tab, setTab] = useTabParam(canSeeAll ? "kanban" : "mine");
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // `refreshKey` is bumped after a successful create / update / delete so
  // the list + kanban children refetch without re-mounting.
  const [refreshKey, setRefreshKey] = useState(0);

  function openDetail(id: string) {
    setDetailId(id);
    setDetailOpen(true);
  }

  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="IT Helpdesk"
        subtitle="Open a ticket for the IT team — password resets, software access, hardware, network, security incidents, and more."
      >
        {canManageSettings && (
          <PermissionButton
            permission="it:settings-manage"
            variant="outline"
            onClick={() => setWorkflowOpen(true)}
          >
            <FolderGit2 className="mr-1 size-4" />
            Workflow
          </PermissionButton>
        )}
        {canManageSettings && (
          <PermissionButton
            permission="it:settings-manage"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
          >
            <Bell className="mr-1 size-4" />
            Notification settings
          </PermissionButton>
        )}
        <PermissionButton
          permission="it:create"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1 size-4" />
          Submit ticket
        </PermissionButton>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="mine">My tickets</TabsTrigger>
          {canSeeAll && (
            <TabsTrigger value="kanban">Kanban (IT team)</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mine">
          <TicketList
            scope="mine"
            refreshKey={refreshKey}
            onSelect={openDetail}
          />
        </TabsContent>

        {canSeeAll && (
          <TabsContent value="kanban">
            <TicketKanban
              scope="all"
              refreshKey={refreshKey}
              onSelect={openDetail}
              canMove={canMoveOnBoard}
            />
          </TabsContent>
        )}
      </Tabs>

      <TicketCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      {canManageSettings && (
        <NotificationSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}

      {canManageSettings && (
        <GithubWorkflowConfigDialog
          open={workflowOpen}
          onOpenChange={setWorkflowOpen}
        />
      )}

      <TicketDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        ticketId={detailId}
        onChanged={() => setRefreshKey((k) => k + 1)}
        onDeleted={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
