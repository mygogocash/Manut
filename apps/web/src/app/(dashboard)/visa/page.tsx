"use client";

import { type ReactNode, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NinetyDayTab } from "@/components/visa/ninety-day-tab";
import { VisaTrackerTab } from "@/components/visa/visa-tracker-tab";
import { useAuth } from "@/providers/auth-provider";

type TabId = "tracker" | "ninety-day";

export default function VisaPage() {
  const { hasPermission } = useAuth();
  // 90-day tab is HR-only — staff with just `visa:read` (their own
  // visa) shouldn't see TM.47 management. Falling back to the tracker
  // means employees with self-service access still get the existing UX.
  const showNinetyDay =
    hasPermission("visa:hr-read") || hasPermission("visa:manage");
  const [tab, setTab] = useState<TabId>("tracker");
  // Action buttons live in the header next to the title; the active tab
  // registers its own set here (only the active tab is mounted, so they
  // never clash).
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  return (
    <div>
      <PageHeader
        title="Visa Management"
        subtitle="Track employee visas, work permits, and Thai 90-day reporting"
      >
        {headerActions}
      </PageHeader>

      {showNinetyDay ? (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as TabId)}
          className="gap-4"
        >
          <TabsList>
            <TabsTrigger value="tracker">Visa Tracker</TabsTrigger>
            <TabsTrigger value="ninety-day">
              90 Days Notification of Residence
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tracker">
            <VisaTrackerTab onHeaderActions={setHeaderActions} />
          </TabsContent>
          <TabsContent value="ninety-day">
            <NinetyDayTab onHeaderActions={setHeaderActions} />
          </TabsContent>
        </Tabs>
      ) : (
        <VisaTrackerTab onHeaderActions={setHeaderActions} />
      )}
    </div>
  );
}
