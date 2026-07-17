"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  formatFullCurrency,
  formatMonthLabel,
} from "@/components/revenue/revenue-utils";
import { DataTable } from "@/components/shared/data-table";
import { ApiError } from "@/lib/api-client";
import {
  type ExpenseMonth,
  getRevenueExpenses,
  type RevenuePeriod,
} from "@/services/revenue.service";

const expenseColumns = [
  {
    key: "month",
    header: "Month",
    render: (e: ExpenseMonth) => (
      <span className="text-foreground font-medium">
        {formatMonthLabel(e.month)}
      </span>
    ),
  },
  {
    key: "total",
    header: "Total",
    className: "text-right",
    render: (e: ExpenseMonth) => (
      <span className="text-foreground tabular-nums">
        {formatFullCurrency(e.total)}
      </span>
    ),
  },
];

export function ExpensesTab({ period }: { period: RevenuePeriod }) {
  const [data, setData] = useState<ExpenseMonth[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getRevenueExpenses({ period });
      setData(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load expenses",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DataTable
      columns={expenseColumns}
      data={data}
      loading={loading}
      title="Expenses by Month"
      emptyMessage="No expense data for this period"
    />
  );
}
