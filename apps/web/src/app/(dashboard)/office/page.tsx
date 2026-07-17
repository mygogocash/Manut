"use client";

import { Building2 } from "lucide-react";
import { useState } from "react";

import { AssetsTab } from "@/components/office/assets-tab";
import { ManageOfficesDialog } from "@/components/office/manage-offices-dialog";
import { RoomBookingTab } from "@/components/office/room-booking-tab";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";

const TABS = [
  { id: "rooms", label: "Room Booking" },
  { id: "assets", label: "Assets" },
];

export default function OfficePage() {
  const [tab, setTab] = useState("rooms");
  const [officesOpen, setOfficesOpen] = useState(false);
  const { hasPermission } = useAuth();
  const canBook = hasPermission("office:book");
  // Asset CRUD is open to facilities (`office:manage`) and to HR
  // (`user:update`) so HR can keep the inventory tidy without a
  // facilities role hand-off. Same gate now governs office / desk /
  // room creation so HR and facilities can seed the directory together.
  const canManage =
    hasPermission("office:manage") || hasPermission("user:update");

  return (
    <div>
      <PageHeader title="Office" subtitle="Office management and facilities">
        {canManage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOfficesOpen(true)}
          >
            <Building2 className="mr-1.5 size-3.5" />
            Manage offices
          </Button>
        ) : null}
      </PageHeader>

      <Tabs tabs={TABS} active={tab} onChange={setTab}>
        <TabsContent value="rooms">
          <RoomBookingTab canBook={canBook} canManage={canManage} />
        </TabsContent>
        <TabsContent value="assets">
          <AssetsTab canManage={canManage} />
        </TabsContent>
      </Tabs>

      <ManageOfficesDialog open={officesOpen} onOpenChange={setOfficesOpen} />
    </div>
  );
}
