"use client";

import {
  Activity,
  Bell,
  CheckSquare,
  Contact2,
  KanbanSquare,
  LayoutDashboard,
  Sparkles,
  Target,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { PipelineKanban } from "@/components/opportunities/pipeline-kanban";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/providers/auth-provider";

// Phase 2 of Sales CRM v2 — `/sales` shell. Phase 1 backend is live behind
// /api/leads, /api/accounts, /api/contacts, /api/opportunities, /api/crm/*.
// This page lays out the six Sales CRM sub-tabs.
// each TabsContent with its real surface (data table, kanban, detail sheet).

const TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { value: "leads", label: "Leads", icon: Sparkles },
  { value: "accounts", label: "Accounts", icon: Target },
  { value: "contacts", label: "Contacts", icon: Contact2 },
  { value: "activities", label: "Activities", icon: Activity },
  { value: "tasks", label: "Tasks", icon: CheckSquare },
] as const;

function DeferredPanelFallback() {
  return <div className="bg-muted/30 min-h-[300px] animate-pulse rounded-lg" />;
}

const SalesDashboard = dynamic(
  () =>
    import("@/components/opportunities/sales-dashboard").then(
      (module) => module.SalesDashboard,
    ),
  { loading: DeferredPanelFallback },
);
const LeadsTab = dynamic(
  () =>
    import("@/components/leads/leads-tab").then((module) => module.LeadsTab),
  { loading: DeferredPanelFallback },
);
const AccountsTab = dynamic(
  () =>
    import("@/components/accounts/accounts-tab").then(
      (module) => module.AccountsTab,
    ),
  { loading: DeferredPanelFallback },
);
const ContactsTab = dynamic(
  () =>
    import("@/components/contacts/contacts-tab").then(
      (module) => module.ContactsTab,
    ),
  { loading: DeferredPanelFallback },
);
const ActivitiesTab = dynamic(
  () =>
    import("@/components/crm-activities/activities-tab").then(
      (module) => module.ActivitiesTab,
    ),
  { loading: DeferredPanelFallback },
);
const TasksTab = dynamic(
  () =>
    import("@/components/crm-tasks/tasks-tab").then(
      (module) => module.TasksTab,
    ),
  { loading: DeferredPanelFallback },
);
const CrmNotificationSettingsDialog = dynamic(() =>
  import("@/components/sales/notification-settings-dialog").then(
    (module) => module.CrmNotificationSettingsDialog,
  ),
);

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div
      className={`
        bg-surface border-border flex min-h-[300px] flex-col items-center
        justify-center gap-2 rounded-lg border p-12 text-center shadow-sm
      `}
    >
      <p className="text-foreground font-medium">{label} coming soon</p>
      <p className="text-muted-foreground max-w-md text-sm">
        Phase 1 of the Sales CRM v2 rebuild shipped the schema, endpoints, and
        Lead → Account/Contact/Opportunity convert flow. Phase 2 is wiring this
        surface up tab by tab — the {label.toLowerCase()} table lands in a
        follow-up.
      </p>
    </div>
  );
}

export default function SalesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("pipeline");
  // Two counters — Accounts saves bump the Pipeline key, Pipeline
  // mutations (drag-stage, create, edit, close-lost, reopen, delete)
  // bump the Accounts key so the two
  // surfaces must agree without a manual tab switch.
  const [pipelineRefreshKey, setPipelineRefreshKey] = useState(0);
  const [accountsRefreshKey, setAccountsRefreshKey] = useState(0);
  const { hasPermission } = useAuth();
  const canManageSettings = hasPermission("crm:settings-manage");
  const [settingsOpen, setSettingsOpen] = useState(false);

  function onAccountSaved() {
    setPipelineRefreshKey((k) => k + 1);
  }
  function onPipelineMutated() {
    setAccountsRefreshKey((k) => k + 1);
  }

  return (
    <div>
      <PageHeader
        title="Sales CRM"
        subtitle="Leads, accounts, opportunities, activities — the new Sales CRM workspace"
      >
        {canManageSettings && (
          <PermissionButton
            permission="crm:settings-manage"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
          >
            <Bell className="mr-1 size-4" />
            Notification settings
          </PermissionButton>
        )}
      </PageHeader>

      {canManageSettings && settingsOpen && (
        <CrmNotificationSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS)[number]["value"])}
      >
        <TabsList className="mb-6 flex flex-wrap">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="size-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ value, label }) => (
          <TabsContent key={value} value={value}>
            {tab !== value ? null : value === "dashboard" ? (
              <SalesDashboard />
            ) : value === "leads" ? (
              <LeadsTab />
            ) : value === "accounts" ? (
              <AccountsTab
                onPipelineMutate={onAccountSaved}
                refreshKey={accountsRefreshKey}
              />
            ) : value === "contacts" ? (
              <ContactsTab />
            ) : value === "pipeline" ? (
              <PipelineKanban
                refreshKey={pipelineRefreshKey}
                onPipelineMutate={onPipelineMutated}
              />
            ) : value === "tasks" ? (
              <TasksTab />
            ) : value === "activities" ? (
              <ActivitiesTab />
            ) : (
              <PlaceholderTab label={label} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
