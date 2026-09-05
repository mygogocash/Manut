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
import { FundraisingEntitySwitcher } from "@/components/investors/fundraising-entity-switcher";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  FundraisingEntityProvider,
  useFundraisingEntity,
} from "@/providers/fundraising-entity-provider";
import {
  getInvestorDashboard,
  type Investor,
  type InvestorDashboard,
  listInvestors,
} from "@/services/investor.service";

export default function InvestorCrmPage() {
  return (
    <FundraisingEntityProvider>
      <InvestorCrmWorkspace />
    </FundraisingEntityProvider>
  );
}

function InvestorCrmWorkspace() {
  const router = useRouter();
  const { entityKey } = useFundraisingEntity();

  const [dashboard, setDashboard] = useState<InvestorDashboard | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, investorRes] = await Promise.all([
        getInvestorDashboard({ fundraisingEntity: entityKey }),
        listInvestors({ limit: 50, page: 1, fundraisingEntity: entityKey }),
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
  }, [entityKey]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const activeCount = investors.filter((i) =>
    ["funds_cleared", "relationship_management"].includes(i.status),
  ).length;

  return (
    <div>
      <PageHeader
        title="Investor CRM"
        subtitle="Relationship management and fundraising overview"
      >
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/investors?entity=${encodeURIComponent(entityKey)}`)
          }
        >
          <Users className="size-3.5" />
          Manage Investors
        </Button>
      </PageHeader>

      <FundraisingEntitySwitcher />

      {loading ? (
        <CrmSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          {/*
            The fourth card shows `totalActInvestment` straight off the
            dashboard payload. It used to show an average of
            (est + act) / investors — which mixed a forecast with money
            actually received and then divided, so the one number the
            investment team wants was nowhere on the page (Yanni,
            2026-08-26).
          */}
          <KpiCards dashboard={dashboard} activeCount={activeCount} />

          <PipelineFunnel investors={investors} />

          <div
            className={`
              grid gap-4
              md:grid-cols-3
            `}
          >
            <RecentInvestors
              investors={investors}
              onViewAll={() =>
                router.push(
                  `/investors?entity=${encodeURIComponent(entityKey)}`,
                )
              }
            />

            <QuickActions
              dashboard={dashboard}
              onAddInvestor={() =>
                router.push(
                  `/investors?entity=${encodeURIComponent(entityKey)}`,
                )
              }
              onSendUpdate={() => router.push("/investor-updates")}
              onDataRoom={() => router.push("/dataroom")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
