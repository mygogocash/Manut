import { DollarSign, TrendingUp, Users } from "lucide-react";

import { formatCurrency } from "@/components/investor-crm/crm-utils";
import { Card, CardContent } from "@/components/ui/card";
import type { InvestorDashboard } from "@/services/investor.service";

interface KpiCardsProps {
  dashboard: InvestorDashboard | null;
  activeCount: number;
}

export function KpiCards({ dashboard, activeCount }: KpiCardsProps) {
  return (
    <div
      className={`
        grid gap-4
        md:grid-cols-4
      `}
    >
      <Card
        className={`
          border-border bg-surface gap-0 rounded-lg px-5 py-4 shadow-sm
          transition-shadow
          hover:shadow-md
        `}
      >
        <CardContent className="p-0">
          <div className="flex items-start justify-between">
            <div>
              <div
                className={`
                  text-muted-foreground mb-2 text-[9.5px] font-bold
                  tracking-widest uppercase
                `}
              >
                Total Investors
              </div>
              <div
                className={`
                  text-foreground font-sans text-[28px] leading-[1.1] font-light
                  tabular-nums
                `}
              >
                {dashboard?.totalInvestors ?? 0}
              </div>
            </div>
            <div
              className={`
                bg-primary/10 text-primary flex size-9 items-center
                justify-center rounded-lg
              `}
            >
              <Users className="size-4" />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-[10.5px]">
            All registered investors
          </p>
        </CardContent>
      </Card>

      <Card
        className={`
          border-border bg-surface gap-0 rounded-lg px-5 py-4 shadow-sm
          transition-shadow
          hover:shadow-md
        `}
      >
        <CardContent className="p-0">
          <div className="flex items-start justify-between">
            <div>
              <div
                className={`
                  text-muted-foreground mb-2 text-[9.5px] font-bold
                  tracking-widest uppercase
                `}
              >
                Est. investment
              </div>
              <div
                className={`
                  text-foreground font-sans text-[28px] leading-[1.1] font-light
                  tabular-nums
                `}
              >
                {formatCurrency(dashboard?.totalEstInvestment ?? 0)}
              </div>
            </div>
            <div
              className={`
                bg-primary/10 text-primary flex size-9 items-center
                justify-center rounded-lg
              `}
            >
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-[10.5px]">
            Estimated investment value
          </p>
        </CardContent>
      </Card>

      <Card
        className={`
          border-border bg-surface gap-0 rounded-lg px-5 py-4 shadow-sm
          transition-shadow
          hover:shadow-md
        `}
      >
        <CardContent className="p-0">
          <div className="flex items-start justify-between">
            <div>
              <div
                className={`
                  text-muted-foreground mb-2 text-[9.5px] font-bold
                  tracking-widest uppercase
                `}
              >
                Active Investors
              </div>
              <div
                className={`
                  text-success font-sans text-[28px] leading-[1.1] font-light
                  tabular-nums
                `}
              >
                {activeCount}
              </div>
            </div>
            <div
              className={`
                bg-success/10 text-success flex size-9 items-center
                justify-center rounded-lg
              `}
            >
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-[10.5px]">
            Currently active relationships
          </p>
        </CardContent>
      </Card>

      <Card
        className={`
          border-border bg-surface gap-0 rounded-lg px-5 py-4 shadow-sm
          transition-shadow
          hover:shadow-md
        `}
      >
        <CardContent className="p-0">
          <div className="flex items-start justify-between">
            <div>
              <div
                className={`
                  text-muted-foreground mb-2 text-[9.5px] font-bold
                  tracking-widest uppercase
                `}
              >
                Total Invested
              </div>
              <div
                className={`
                  text-foreground font-sans text-[28px] leading-[1.1] font-light
                  tabular-nums
                `}
              >
                {formatCurrency(dashboard?.totalActInvestment ?? 0)}
              </div>
            </div>
            <div
              className={`
                bg-primary/10 text-primary flex size-9 items-center
                justify-center rounded-lg
              `}
            >
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-[10.5px]">
            Actual money received to date
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
