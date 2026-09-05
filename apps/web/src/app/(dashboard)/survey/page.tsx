"use client";

import { Bell, Loader2, Plus, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { SurveyAnnouncementSettingsDialog } from "@/components/survey/survey-form-announcement-settings-dialog";
import { SurveyNotificationSettingsDialog } from "@/components/survey/survey-notification-settings-dialog";
import { Button } from "@/components/ui/button";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  listSurveys,
  type SurveyStatus,
  type SurveySummary,
} from "@/services/survey.service";

const STATUS_VARIANT: Record<
  SurveyStatus,
  "grey" | "blue" | "green" | "red" | "amber" | "gold"
> = {
  draft: "grey",
  published: "green",
  closed: "amber",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SurveysPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("survey:manage");

  type TabId = "available" | "mine" | "all" | "archived";
  const [activeTab, setActiveTab] = useTabParam("available");
  const [available, setAvailable] = useState<SurveySummary[]>([]);
  const [mine, setMine] = useState<SurveySummary[]>([]);
  const [all, setAll] = useState<SurveySummary[]>([]);
  const [archivedForms, setArchivedForms] = useState<SurveySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchTab = useCallback(async (tab: TabId) => {
    try {
      setLoading(true);
      const res =
        tab === "archived"
          ? await listSurveys({ scope: "all", archived: true, limit: 100 })
          : await listSurveys({ scope: tab, limit: 100 });
      if (tab === "available") setAvailable(res.data);
      else if (tab === "mine") setMine(res.data);
      else if (tab === "all") setAll(res.data);
      else setArchivedForms(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load surveys";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTab(activeTab as TabId);
  }, [activeTab, fetchTab]);

  const tabsList = useMemo(() => {
    const t = [{ id: "available", label: "Open surveys" }];
    if (canManage) {
      t.push({ id: "mine", label: "My drafts" });
      t.push({ id: "all", label: "All surveys" });
      t.push({ id: "archived", label: "Archived" });
    }
    return t;
  }, [canManage]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Surveys"
        subtitle="Create and share surveys — questions, responses, and results."
      >
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setNotifOpen(true)}>
              <Bell className="mr-1 size-3.5" />
              Notification settings
            </Button>
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-1 size-3.5" />
              Configure announcement
            </Button>
            <Button onClick={() => router.push("/survey/new")}>
              <Plus className="mr-1 size-3.5" />
              New survey
            </Button>
          </div>
        )}
      </PageHeader>

      <Tabs
        tabs={tabsList}
        active={activeTab}
        onChange={(v) => setActiveTab(v as TabId)}
      >
        <TabsContent value="available">
          <SurveyList
            forms={available}
            loading={loading}
            onOpen={(id, alreadyResponded) => {
              if (alreadyResponded) {
                toast.message("You've already responded to this survey");
                return;
              }
              router.push(`/survey/${id}/respond`);
            }}
            mode="available"
          />
        </TabsContent>
        {canManage && (
          <TabsContent value="mine">
            <SurveyList
              forms={mine}
              loading={loading}
              onOpen={(id) => router.push(`/survey/${id}`)}
              mode="manage"
            />
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="all">
            <SurveyList
              forms={all}
              loading={loading}
              onOpen={(id) => router.push(`/survey/${id}`)}
              mode="manage"
            />
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="archived">
            <SurveyList
              forms={archivedForms}
              loading={loading}
              onOpen={(id) => router.push(`/survey/${id}`)}
              mode="manage"
              emptyLabel="No archived surveys."
            />
          </TabsContent>
        )}
      </Tabs>

      {canManage && (
        <>
          <SurveyAnnouncementSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />
          <SurveyNotificationSettingsDialog
            open={notifOpen}
            onOpenChange={setNotifOpen}
          />
        </>
      )}
    </div>
  );
}

function SurveyList({
  forms,
  loading,
  onOpen,
  mode,
  emptyLabel,
}: {
  forms: SurveySummary[];
  loading: boolean;
  onOpen: (id: string, alreadyResponded: boolean) => void;
  mode: "available" | "manage";
  emptyLabel?: string;
}) {
  if (loading) {
    return (
      <div
        className={`
          text-muted-foreground flex items-center justify-center gap-2 py-12
          text-sm
        `}
      >
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (forms.length === 0) {
    return (
      <div
        className={`
          text-muted-foreground rounded-md border border-dashed py-12
          text-center text-sm
        `}
      >
        {emptyLabel ??
          (mode === "available"
            ? "No surveys are open for you right now."
            : "No surveys yet.")}
      </div>
    );
  }
  return (
    <div
      className={`
        grid gap-3
        sm:grid-cols-2
        lg:grid-cols-3
      `}
    >
      {forms.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onOpen(f.id, f.alreadyResponded ?? false)}
          className={`
            hover:border-primary/40 hover:bg-primary/5
            bg-card flex flex-col gap-2 rounded-lg border p-4 text-left
            transition-colors
          `}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{f.title}</h3>
              {f.description && (
                <p className="text-muted-foreground line-clamp-2 text-xs">
                  {f.description}
                </p>
              )}
            </div>
            <Badge variant={STATUS_VARIANT[f.status] ?? "grey"}>
              {f.status}
            </Badge>
          </div>
          <div
            className={`
              text-muted-foreground flex flex-wrap items-center gap-2
              text-[11px]
            `}
          >
            <span>{f._count.questions} questions</span>
            {mode === "manage" && <span>{f._count.responses} responses</span>}
            {f.publishedAt && <span>Pub {formatDate(f.publishedAt)}</span>}
            {f.isAnonymous && <Badge variant="grey">Anonymous</Badge>}
            {f.alreadyResponded && <Badge variant="green">Submitted</Badge>}
          </div>
        </button>
      ))}
    </div>
  );
}
