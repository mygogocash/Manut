import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EsopPool } from "@/services/hrms.service";

export function EsopPoolCards({
  pool,
  loading,
}: {
  pool: EsopPool | null;
  loading: boolean;
}) {
  return (
    <div
      className={`
        grid gap-4
        md:grid-cols-4
      `}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Grand Total</CardDescription>
          <CardTitle className="text-xl tabular-nums">
            {loading ? "..." : (pool?.grandTotal.toLocaleString() ?? "0")}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Vesting</CardDescription>
          <CardTitle className="text-warning text-xl tabular-nums">
            {loading ? "..." : (pool?.vesting.toLocaleString() ?? "0")}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Vested</CardDescription>
          <CardTitle className="text-success text-xl tabular-nums">
            {loading ? "..." : (pool?.vested.toLocaleString() ?? "0")}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Vesting to date</CardDescription>
          <CardTitle className="text-xl tabular-nums">
            {loading ? "..." : (pool?.vestedToDate.toLocaleString() ?? "0")}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
