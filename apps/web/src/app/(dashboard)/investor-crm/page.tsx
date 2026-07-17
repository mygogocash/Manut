"use client";

import { Users } from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { CrmSkeleton } from "@/components/investor-crm/crm-skeleton";
import { KpiCards } from "@/components/investor-crm/kpi-cards";
import { PipelineFunnel } from "@/components/investor-crm/pipeline-funnel";
import { QuickActions } from "@/components/investor-crm/quick-actions";
import { RecentInvestors } from "@/components/investor-crm/recent-investors";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  getInvestorDashboard,
  type Investor,
  type InvestorDashboard,
  listInvestors,
} from "@/services/investor.service";

export default function InvestorCrmPage() {
  const router = useRouter();

  const [dashboard, setDashboard] = useState<InvestorDashboard | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, investorRes] = await Promise.all([
        getInvestorDashboard(),
        listInvestors({ limit: 50, page: 1 }),
      ]);
      setDashboard(dashRes.data);
      setInvestors(investorRes.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load CRM data";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const avgInvestment =
    dashboard && dashboard.totalInvestors > 0
      ? (dashboard.totalEstInvestment + dashboard.totalActInvestment) /
        dashboard.totalInvestors
      : 0;

  const activeCount = investors.filter((i) =>
    ["funds_cleared", "relationship_management"].includes(i.status),
  ).length;

  return (
    <div>
      <PageHeader
        title="Investor CRM"
        subtitle="Relationship management and fundraising overview"
      >
        <Button variant="outline" onClick={() => router.push("/investors")}>
          <Users className="size-3.5" />
          Manage Investors
        </Button>
      </PageHeader>

      {loading ? (
        <CrmSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <KpiCards
            dashboard={dashboard}
            activeCount={activeCount}
            avgInvestment={avgInvestment}
          />

          <PipelineFunnel investors={investors} />

          <div
            className={`
              grid gap-4
              md:grid-cols-3
            `}
          >
            <RecentInvestors
              investors={investors}
              onViewAll={() => router.push("/investors")}
            />

            <QuickActions
              dashboard={dashboard}
              onAddInvestor={() => router.push("/investors")}
              onSendUpdate={() => router.push("/investor-updates")}
              onDataRoom={() => router.push("/dataroom")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
