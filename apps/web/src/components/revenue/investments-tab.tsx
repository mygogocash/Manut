"use client";

import { DollarSign, Loader2, PiggyBank, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { KpiCard } from "@/components/revenue/revenue-kpi-card";
import { formatFullCurrency } from "@/components/revenue/revenue-utils";
import { ApiError } from "@/lib/api-client";
import {
  getRevenueInvestments,
  type InvestmentSummary,
  type RevenuePeriod,
} from "@/services/revenue.service";

export function InvestmentsTab({ period }: { period: RevenuePeriod }) {
  const [data, setData] = useState<InvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getRevenueInvestments({ period });
      setData(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load investments",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        No investment data available
      </p>
    );
  }

  return (
    <div
      className={`
        grid grid-cols-1 gap-4
        sm:grid-cols-3
      `}
    >
      <KpiCard
        icon={DollarSign}
        title="Total Investments"
        value={formatFullCurrency(data.totalInvestments)}
      />
      <KpiCard
        icon={PiggyBank}
        title="Investor Count"
        value={String(data.investorCount)}
      />
      <KpiCard
        icon={TrendingUp}
        title="Average Investment"
        value={formatFullCurrency(data.avgInvestment)}
      />
    </div>
  );
}
