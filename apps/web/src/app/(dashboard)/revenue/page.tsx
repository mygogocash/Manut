"use client";

import { FileText, PiggyBank, Receipt, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ExpensesTab } from "@/components/revenue/expenses-tab";
import { InvestmentsTab } from "@/components/revenue/investments-tab";
import { InvoicesTab } from "@/components/revenue/invoices-tab";
import { RevenueOverviewTab } from "@/components/revenue/revenue-overview-tab";
import { PERIODS } from "@/components/revenue/revenue-utils";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import {
  getRevenueDashboard,
  type RevenueDashboard,
  type RevenuePeriod,
} from "@/services/revenue.service";

export default function RevenuePage() {
  const [data, setData] = useState<RevenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<RevenuePeriod>("12m");
  const [activeTab, setActiveTab] = useTabParam("overview");

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getRevenueDashboard({ period });
      setData(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load revenue data";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div>
      <PageHeader
        title="Revenue Analytics"
        subtitle="Financial overview and revenue tracking"
      >
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as RevenuePeriod)}
        >
          <SelectTrigger className="h-10 w-44 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <TrendingUp className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="investments" className="gap-1.5">
            <PiggyBank className="size-3.5" />
            Investments
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5">
            <Receipt className="size-3.5" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5">
            <FileText className="size-3.5" />
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <RevenueOverviewTab data={data} loading={loading} />
        </TabsContent>

        <TabsContent value="investments" className="mt-4">
          <InvestmentsTab period={period} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab period={period} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
