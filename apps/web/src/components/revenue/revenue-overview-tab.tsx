"use client";

import {
  Banknote,
  DollarSign,
  FileText,
  Loader2,
  Receipt,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { KpiCard, KpiSkeleton } from "@/components/revenue/revenue-kpi-card";
import {
  DEAL_STAGE_LABELS,
  expenseChartConfig,
  formatCurrency,
  formatFullCurrency,
  formatMonthLabel,
  INVOICE_COLORS,
  invoiceChartConfig,
  pipelineChartConfig,
  revenueChartConfig,
} from "@/components/revenue/revenue-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RevenueDashboard } from "@/services/revenue.service";

export function RevenueOverviewTab({
  data,
  loading,
}: {
  data: RevenueDashboard | null;
  loading: boolean;
}) {
  const totalExpenses = data?.expenses.reduce((s, e) => s + e.total, 0) ?? 0;
  const pipelineTotal =
    data?.pipeline.reduce((s, p) => s + p.totalValue, 0) ?? 0;
  const latestGrowth =
    data?.monthly && data.monthly.length > 0
      ? data.monthly[data.monthly.length - 1].growth
      : undefined;

  const pieData = data
    ? Object.entries(data.invoices.byStatus).map(([status, detail]) => ({
        name: status,
        value: detail.total,
        count: detail.count,
      }))
    : [];

  return (
    <>
      <div
        className={`
          mb-6 grid grid-cols-1 gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        `}
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              icon={DollarSign}
              title="Total Investments"
              value={formatCurrency(data?.investments.totalInvestments ?? 0)}
              subtitle={`${data?.investments.investorCount ?? 0} investors`}
            />
            <KpiCard
              icon={FileText}
              title="Total Invoiced"
              value={formatCurrency(data?.invoices.grandTotal ?? 0)}
              subtitle={`${pieData.reduce((s, p) => s + p.count, 0)} invoices`}
            />
            <KpiCard
              icon={Receipt}
              title="Monthly Expenses"
              value={formatCurrency(totalExpenses)}
              subtitle={`${data?.expenses.length ?? 0} months tracked`}
            />
            <KpiCard
              icon={Banknote}
              title="Deal Pipeline Value"
              value={formatCurrency(pipelineTotal)}
              subtitle={`${data?.pipeline.reduce((s, p) => s + p.count, 0) ?? 0} active deals`}
              trend={latestGrowth}
            />
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : (
        data && (
          <>
            <div
              className={`
                mb-6 grid grid-cols-1 gap-4
                lg:grid-cols-2
              `}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle
                    className={`flex items-center gap-2 text-sm font-semibold`}
                  >
                    <TrendingUp className="size-4" />
                    Revenue Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.monthly.length > 0 ? (
                    <ChartContainer
                      config={revenueChartConfig}
                      className="aspect-2/1 w-full"
                    >
                      <AreaChart data={data.monthly}>
                        <defs>
                          <linearGradient
                            id="revenueGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--color-revenue)"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--color-revenue)"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatMonthLabel}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatCurrency}
                          tick={{ fontSize: 11 }}
                          width={60}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) =>
                                formatFullCurrency(Number(value))
                              }
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="var(--color-revenue)"
                          fill="url(#revenueGrad)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <p
                      className={`
                        text-muted-foreground py-8 text-center text-sm
                      `}
                    >
                      No revenue data for this period
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle
                    className={`flex items-center gap-2 text-sm font-semibold`}
                  >
                    <Receipt className="size-4" />
                    Expenses by Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.expenses.length > 0 ? (
                    <ChartContainer
                      config={expenseChartConfig}
                      className="aspect-2/1 w-full"
                    >
                      <BarChart data={data.expenses}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatMonthLabel}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatCurrency}
                          tick={{ fontSize: 11 }}
                          width={60}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) =>
                                formatFullCurrency(Number(value))
                              }
                            />
                          }
                        />
                        <Bar
                          dataKey="total"
                          fill="var(--color-total)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p
                      className={`
                        text-muted-foreground py-8 text-center text-sm
                      `}
                    >
                      No expense data for this period
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div
              className={`
                mb-6 grid grid-cols-1 gap-4
                lg:grid-cols-2
              `}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle
                    className={`flex items-center gap-2 text-sm font-semibold`}
                  >
                    <FileText className="size-4" />
                    Invoice Status Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <div className="flex items-center gap-6">
                      <ChartContainer
                        config={invoiceChartConfig}
                        className="aspect-square w-full max-w-[200px]"
                      >
                        <PieChart>
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) =>
                                  formatFullCurrency(Number(value))
                                }
                              />
                            }
                          />
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {pieData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={
                                  INVOICE_COLORS[entry.name] ??
                                  "hsl(var(--muted-foreground))"
                                }
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="flex flex-1 flex-col gap-2">
                        {pieData.map((item) => (
                          <div
                            key={item.name}
                            className={`
                              flex items-center justify-between text-[12px]
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="size-2.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    INVOICE_COLORS[item.name] ??
                                    "hsl(var(--muted-foreground))",
                                }}
                              />
                              <span
                                className={`text-muted-foreground capitalize`}
                              >
                                {item.name}
                              </span>
                            </div>
                            <div className="text-right">
                              <span
                                className={`
                                  text-foreground font-medium tabular-nums
                                `}
                              >
                                {formatCurrency(item.value)}
                              </span>
                              <span className="text-muted-foreground ml-1.5">
                                ({item.count})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p
                      className={`
                        text-muted-foreground py-8 text-center text-sm
                      `}
                    >
                      No invoice data for this period
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle
                    className={`flex items-center gap-2 text-sm font-semibold`}
                  >
                    <Banknote className="size-4" />
                    Deal Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.pipeline.length > 0 ? (
                    <ChartContainer
                      config={pipelineChartConfig}
                      className="aspect-2/1 w-full"
                    >
                      <BarChart
                        data={data.pipeline.map((p) => ({
                          ...p,
                          label: DEAL_STAGE_LABELS[p.stage] ?? p.stage,
                        }))}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatCurrency}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                          width={90}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) =>
                                formatFullCurrency(Number(value))
                              }
                            />
                          }
                        />
                        <Bar
                          dataKey="totalValue"
                          fill="var(--color-totalValue)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p
                      className={`
                        text-muted-foreground py-8 text-center text-sm
                      `}
                    >
                      No deal data
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {data.revenueByEntity.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Revenue by Entity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead
                          className={`
                            text-muted-foreground h-auto pb-2 text-left
                            font-medium
                          `}
                        >
                          Entity
                        </TableHead>
                        <TableHead
                          className={`
                            text-muted-foreground h-auto pb-2 text-right
                            font-medium
                          `}
                        >
                          Revenue
                        </TableHead>
                        <TableHead
                          className={`
                            text-muted-foreground h-auto pb-2 text-right
                            font-medium
                          `}
                        >
                          Expenses
                        </TableHead>
                        <TableHead
                          className={`
                            text-muted-foreground h-auto pb-2 text-right
                            font-medium
                          `}
                        >
                          Net Income
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.revenueByEntity.map((entity) => (
                        <TableRow key={entity.id}>
                          <TableCell className="py-2.5 whitespace-normal">
                            <span className="text-foreground font-medium">
                              {entity.name}
                            </span>
                            <span
                              className={`
                                text-muted-foreground ml-1.5 text-[10px]
                              `}
                            >
                              {entity.code}
                            </span>
                          </TableCell>
                          <TableCell
                            className={`
                              text-foreground py-2.5 text-right tabular-nums
                            `}
                          >
                            {formatFullCurrency(entity.revenue)}
                          </TableCell>
                          <TableCell
                            className={`
                              text-foreground py-2.5 text-right tabular-nums
                            `}
                          >
                            {formatFullCurrency(entity.expenses)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "py-2.5 text-right font-medium tabular-nums",
                              entity.netIncome >= 0
                                ? "text-success"
                                : "text-destructive",
                            )}
                          >
                            {formatFullCurrency(entity.netIncome)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )
      )}
    </>
  );
}
