import { CalendarPlus, Loader2 } from "lucide-react";

import { ProgressBar } from "@/components/shared/progress-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LeaveBalance } from "@/services/leave.service";

interface LeaveBalanceCardsProps {
  balances: LeaveBalance[];
  loading: boolean;
  pendingCount?: number;
  onApply?: (leaveTypeId: string) => void;
  applyDisabled?: boolean;
}

export function LeaveBalanceCards({
  balances,
  loading,
  pendingCount,
  onApply,
  applyDisabled,
}: LeaveBalanceCardsProps) {
  if (loading) {
    return (
      <div
        className={`
          mb-6 grid gap-4
          md:grid-cols-4
        `}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardDescription>
                <Loader2 className="size-3.5 animate-spin" />
              </CardDescription>
              <CardTitle
                className={`text-muted-foreground text-xl tabular-nums`}
              >
                &mdash;
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressBar value={0} className="h-1.5" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`
        mb-2 grid gap-4
        md:grid-cols-4
      `}
    >
      {balances.map((b) => {
        const pct = b.entitled > 0 ? (b.used / b.entitled) * 100 : 0;
        // Carried bucket sits OUTSIDE the entitled-vs-used tally now,
        // so HR's expiring carry-over doesn't quietly inflate the
        // headline number for the entitlement column.
        const carriedExpiryLabel = b.carriedExpiry
          ? `expires ${b.carriedExpiry.split("-").reverse().join("/")}`
          : null;
        return (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                {b.leaveType.name}
              </CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {b.remaining} / {b.entitled} days
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <ProgressBar value={pct} className="h-1.5" />
              <p className="text-muted-foreground text-[11px]">
                {b.used} used
                {b.carried > 0 && (
                  <>
                    {" · "}
                    {b.carriedRemaining} of {b.carried} carried
                    {carriedExpiryLabel && (
                      <span
                        className={
                          b.carriedExpired ? "text-destructive" : undefined
                        }
                      >
                        {` (${b.carriedExpired ? "expired" : carriedExpiryLabel})`}
                      </span>
                    )}
                  </>
                )}
              </p>
              {onApply && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 h-7 text-xs"
                  disabled={
                    applyDisabled ||
                    (b.remaining <= 0 && b.carriedRemaining <= 0)
                  }
                  onClick={() => onApply(b.leaveType.id)}
                >
                  <CalendarPlus className="size-3" />
                  Apply
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
      {pendingCount !== undefined && balances.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Requests</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {pendingCount}
            </CardTitle>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
