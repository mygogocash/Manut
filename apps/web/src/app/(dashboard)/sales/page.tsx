"use client";

import {
  Activity,
  Bell,
  BellRing,
  CheckSquare,
  Contact2,
  KanbanSquare,
  LayoutDashboard,
  Sparkles,
  Target,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { AccountsTab } from "@/components/accounts/accounts-tab";
import { ContactsTab } from "@/components/contacts/contacts-tab";
import { ActivitiesTab } from "@/components/crm-activities/activities-tab";
import { TasksTab } from "@/components/crm-tasks/tasks-tab";
import { LeadsTab } from "@/components/leads/leads-tab";
import { PipelineKanban } from "@/components/opportunities/pipeline-kanban";
import { SalesDashboard } from "@/components/opportunities/sales-dashboard";
import { CrmNotificationSettingsDialog } from "@/components/sales/notification-settings-dialog";
import { CrmReminderSettingsDialog } from "@/components/shared/crm-reminder-settings-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionButton } from "@/components/shared/permission-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";
import { useAuth } from "@/providers/auth-provider";
import {
  getCrmReminderSettings,
  updateCrmReminderSettings,
} from "@/services/crm-reminder-settings.service";

// Phase 2 of Sales CRM v2 — `/sales` shell. Phase 1 backend is live behind
// /api/leads, /api/accounts, /api/contacts, /api/opportunities, /api/crm/*.
// This page lays out the six sub-tabs from PRD §10. Subsequent slices fill
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

// The sidebar's per-business-unit views link to
// `/sales?tab=pipeline&bu=<code>`, so this page reads the query string.
// `useSearchParams` needs a Suspense boundary, so the body is wrapped
// (same shape as (dashboard)/settings/page.tsx).
export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesPageInner />
    </Suspense>
  );
}

function SalesPageInner() {
  const [tab, setTab] = useTabParam("pipeline");
  // useTabParam seeds from the URL on mount only. A sidebar link into an
  // already-open page changes the query without remounting, so re-sync
  // here or the board would stay on whichever tab was last open.
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") ?? "";
  useEffect(() => {
    if (tabParam && tabParam !== tab) setTab(tabParam);
    // `tab` is intentionally omitted: this effect reacts to the URL, not
    // to in-page tab clicks (which already own the state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam, setTab]);
  // Two counters — Accounts saves bump the Pipeline key, Pipeline
  // mutations (drag-stage, create, edit, close-lost, reopen, delete)
  // bump the Accounts key. BD feedback (Vivek, May 2026): the two
  // surfaces must agree without a manual tab switch.
  const [pipelineRefreshKey, setPipelineRefreshKey] = useState(0);
  const [accountsRefreshKey, setAccountsRefreshKey] = useState(0);
  const { hasPermission } = useAuth();
  const canManageSettings = hasPermission("crm:settings-manage");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  // Stable load/save fns for the shared reminder-settings dialog —
  // it keys its load-on-open effect on `load`.
  const loadReminderSettings = useCallback(
    async () => (await getCrmReminderSettings("sales")).data,
    [],
  );
  const saveReminderSettings = useCallback(
    async (recipients: string[]) =>
      (await updateCrmReminderSettings("sales", recipients)).data,
    [],
  );

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
          <>
            <PermissionButton
              permission="crm:settings-manage"
              variant="outline"
              onClick={() => setSettingsOpen(true)}
            >
              <Bell className="mr-1 size-4" />
              Notification settings
            </PermissionButton>
            <PermissionButton
              permission="crm:settings-manage"
              variant="outline"
              onClick={() => setReminderOpen(true)}
            >
              <BellRing className="mr-1 size-4" />
              Reminders
            </PermissionButton>
          </>
        )}
      </PageHeader>

      {canManageSettings && (
        <CrmNotificationSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}

      {canManageSettings && (
        <CrmReminderSettingsDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          load={loadReminderSettings}
          save={saveReminderSettings}
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
            {value === "dashboard" ? (
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
