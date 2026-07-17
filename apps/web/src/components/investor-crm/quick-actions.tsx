import { FileText, Plus, Send } from "lucide-react";

import { formatCurrency } from "@/components/investor-crm/crm-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvestorDashboard } from "@/services/investor.service";

interface QuickActionsProps {
  dashboard: InvestorDashboard | null;
  onAddInvestor: () => void;
  onSendUpdate: () => void;
  onDataRoom: () => void;
}

const SECTION_LABEL =
  "text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase";

export function QuickActions({
  dashboard,
  onAddInvestor,
  onSendUpdate,
  onDataRoom,
}: QuickActionsProps) {
  return (
    <Card className="border-border/80 bg-card/90 gap-0 overflow-hidden">
      <CardHeader
        className={`border-border/60 flex flex-col gap-0.5 border-b px-5 py-4`}
      >
        <CardTitle className={SECTION_LABEL}>Quick actions</CardTitle>
        <p className="text-foreground-secondary text-[13px] leading-relaxed">
          Common tasks at a glance.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-5 py-4">
        <Button
          variant="outline"
          className="h-auto w-full justify-start gap-3 px-3 py-3"
          onClick={onAddInvestor}
        >
          <div
            className={`
              bg-primary/10 text-primary flex size-9 shrink-0 items-center
              justify-center rounded-lg
            `}
          >
            <Plus className="size-4" />
          </div>
          <div className="text-left">
            <p className="text-foreground text-sm font-medium">Add investor</p>
            <p className="text-muted-foreground text-[11px]">
              Create a new investor record.
            </p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto w-full justify-start gap-3 px-3 py-3"
          onClick={onSendUpdate}
        >
          <div
            className={`
              bg-info/10 text-info flex size-9 shrink-0 items-center
              justify-center rounded-lg
            `}
          >
            <Send className="size-4" />
          </div>
          <div className="text-left">
            <p className="text-foreground text-sm font-medium">Send update</p>
            <p className="text-muted-foreground text-[11px]">
              Share progress with investors.
            </p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto w-full justify-start gap-3 px-3 py-3"
          onClick={onDataRoom}
        >
          <div
            className={`
              bg-primary-light/20 text-primary flex size-9 shrink-0 items-center
              justify-center rounded-lg
            `}
          >
            <FileText className="size-4" />
          </div>
          <div className="text-left">
            <p className="text-foreground text-sm font-medium">Data room</p>
            <p className="text-muted-foreground text-[11px]">
              Manage investor documents.
            </p>
          </div>
        </Button>
      </CardContent>

      {dashboard && Object.keys(dashboard.byCurrency).length > 0 && (
        <>
          <CardHeader
            className={`
              border-border/60 flex flex-col gap-0.5 border-y px-5 py-3
            `}
          >
            <CardTitle className={SECTION_LABEL}>By currency</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <div className="flex flex-col gap-2">
              {Object.entries(dashboard.byCurrency).map(([currency, data]) => (
                <div
                  key={currency}
                  className={`
                    border-border/60 bg-muted/15 flex items-center
                    justify-between rounded-lg border px-3 py-2.5
                  `}
                >
                  <span className="text-foreground text-xs font-semibold">
                    {currency}
                  </span>
                  <div className="text-right">
                    <p
                      className={`
                        text-foreground font-serif text-sm tabular-nums
                      `}
                    >
                      {formatCurrency(data.committed)}{" "}
                      <span
                        className={`
                          text-muted-foreground font-sans text-[11px]
                          font-normal
                        `}
                      >
                        committed
                      </span>
                    </p>
                    <p className="text-success text-[11px] tabular-nums">
                      {formatCurrency(data.received)} received
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}
