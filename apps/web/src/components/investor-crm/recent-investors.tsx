import { ArrowRight, Users } from "lucide-react";

import { timeAgo } from "@/components/investor-crm/crm-utils";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type Investor,
  INVESTOR_TYPE_LABELS,
  investorStatusLabel,
} from "@/services/investor.service";

interface RecentInvestorsProps {
  investors: Investor[];
  onViewAll: () => void;
}

export function RecentInvestors({
  investors,
  onViewAll,
}: RecentInvestorsProps) {
  const recentInvestors = [...investors]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Recently Added Investors
            </CardTitle>
            <CardDescription>
              Latest additions to your investor database
            </CardDescription>
          </div>
          <Button variant="ghost" onClick={onViewAll} className="text-xs">
            View All
            <ArrowRight className="ml-1 size-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recentInvestors.length === 0 ? (
          <div
            className={`
              flex flex-col items-center justify-center rounded-lg border
              border-dashed py-10
            `}
          >
            <Users className="text-muted-foreground/40 mb-2 size-8" />
            <p className="text-muted-foreground text-sm">
              No investors added yet
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentInvestors.map((inv) => (
              <div
                key={inv.id}
                className={`
                  hover:bg-muted/50
                  flex items-center justify-between rounded-lg border p-3
                  transition-colors
                `}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-foreground truncate text-sm font-medium`}
                    >
                      {inv.name}
                    </p>
                    <Badge status={inv.status}>
                      {investorStatusLabel(inv.status)}
                    </Badge>
                  </div>
                  <div
                    className={`
                      text-muted-foreground mt-0.5 flex items-center gap-2
                      text-xs
                    `}
                  >
                    <span>{INVESTOR_TYPE_LABELS[inv.type] ?? inv.type}</span>
                    {inv.location && (
                      <>
                        <span>·</span>
                        <span>{inv.location}</span>
                      </>
                    )}
                    {inv.contactEmail && (
                      <>
                        <span>·</span>
                        <span className="truncate">{inv.contactEmail}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className={`text-muted-foreground shrink-0 text-[10px]`}>
                  {timeAgo(inv.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
