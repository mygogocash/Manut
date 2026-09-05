"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// First-entry-only pop-banner saturation model. A one-shot banner fires the
// first time a user opens the host app; conversions saturate as the
// un-converted pool shrinks. Pure client-side calculator — no data feed.
type Freq = "daily" | "weekly" | "random_mega" | "combo";

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.round(n).toString();
}

function intensityFor(freq: Freq, day: number): number {
  if (freq === "daily") return 1;
  if (freq === "weekly") return day % 7 === 0 ? 2.5 : 0;
  if (freq === "random_mega") return day % 30 === 0 ? 4 : 0;
  // combo: daily base + weekly bump + monthly mega
  let i = 1;
  if (day % 7 === 0) i += 1.5;
  if (day % 30 === 0) i += 2.5;
  return i;
}

export function PopBannerModel({
  hostName,
  hostMau,
  hostDau,
  startingCumulative,
}: {
  hostName: string;
  hostMau: number;
  hostDau: number;
  startingCumulative: number;
}) {
  const [ratePct, setRatePct] = useState(30);
  const [freq, setFreq] = useState<Freq>("combo");
  const [days, setDays] = useState(90);

  const model = useMemo(() => {
    const rate = (ratePct || 0) / 100;
    const targetPct = 0.7;
    const target = hostMau * targetPct;
    let cumulative = startingCumulative;
    let daysToTarget: number | null = null;
    const series: Array<{ day: string; cumulative: number; daily: number }> =
      [];
    for (let d = 0; d < days; d++) {
      const pool = Math.max(0, hostMau - cumulative);
      const firstTimeDau = hostDau * (pool / hostMau);
      const newConverts = firstTimeDau * rate * intensityFor(freq, d);
      cumulative += newConverts;
      series.push({
        day: `D${d + 1}`,
        cumulative: Math.round(cumulative),
        daily: Math.round(newConverts),
      });
      if (daysToTarget === null && cumulative >= target) {
        daysToTarget = d + 1;
      }
    }
    const day1 = series[0]?.daily ?? 0;
    const day30 = series[29]?.daily ?? null;
    return {
      series,
      target,
      finalCumulative: cumulative,
      finalPenetration: (cumulative / hostMau) * 100,
      daysToTarget,
      decay: day30 !== null && day1 > 0 ? (1 - day30 / day1) * 100 : null,
    };
  }, [ratePct, freq, days, hostMau, hostDau, startingCumulative]);

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Pop banner — first-entry-only conversion model
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-xs">
          A one-shot banner on first app open. Conversions saturate as the
          un-converted pool shrinks — tune the inputs to see where the curve
          crosses 70% of {hostName}&apos;s MAU.
        </p>

        <div
          className={`
            mb-4 grid gap-3
            sm:grid-cols-3
          `}
        >
          <div className="grid gap-1.5">
            <Label className="text-xs">
              Conversion (% of first-time viewers)
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={ratePct}
              onChange={(e) => setRatePct(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Campaign frequency</Label>
            <Select value={freq} onValueChange={(v) => setFreq(v as Freq)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily mini</SelectItem>
                <SelectItem value="weekly">Weekly (1×/wk)</SelectItem>
                <SelectItem value="random_mega">Monthly mega</SelectItem>
                <SelectItem value="combo">Daily + weekly + monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Run duration (days)</Label>
            <Input
              type="number"
              min={7}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </div>
        </div>

        <div
          className={`
            mb-4 grid gap-3
            sm:grid-cols-4
          `}
        >
          <Output
            label="Users captured"
            value={fmtNum(model.finalCumulative)}
            desc={`${model.finalPenetration.toFixed(1)}% of host MAU`}
          />
          <Output
            label="Days to 70% MAU"
            value={model.daysToTarget ? String(model.daysToTarget) : "—"}
            desc={
              model.daysToTarget
                ? `~${Math.max(1, Math.round(model.daysToTarget / 30))} mo`
                : `Not reached in ${days}d`
            }
          />
          <Output
            label="MAU at end of run"
            value={model.finalPenetration.toFixed(1) + "%"}
            desc={`of ${fmtNum(hostMau)} MAU`}
          />
          <Output
            label="Day 1 → Day 30 decay"
            value={model.decay === null ? "—" : model.decay.toFixed(0) + "%"}
            desc="Saturation drop-off"
          />
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={model.series}
            margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} minTickGap={28} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => fmtNum(v as number)}
              width={44}
            />
            <Tooltip
              formatter={(v) => fmtNum(v as number)}
              contentStyle={{ fontSize: 12 }}
            />
            <ReferenceLine
              y={model.target}
              stroke="#7e9eff"
              strokeDasharray="4 3"
              label={{
                value: "70% MAU",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#7e9eff",
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#7e9eff"
              fill="#7e9eff"
              fillOpacity={0.12}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>

        <p className="text-muted-foreground mt-3 text-xs">
          Because the banner is first-entry only, every converted user leaves
          the addressable pool for good — daily converts decay as the pool
          shrinks. Sustained growth needs other levers stacked on top.
        </p>
      </CardContent>
    </Card>
  );
}

function Output({
  label,
  value,
  desc,
}: {
  label: string;
  value: string;
  desc: string;
}) {
  return (
    <div className="border-border rounded-lg border p-3">
      <p
        className={`
          text-muted-foreground text-[10px] font-medium tracking-wider uppercase
        `}
      >
        {label}
      </p>
      <p className="font-serif text-xl font-medium">{value}</p>
      <p className="text-muted-foreground text-xs">{desc}</p>
    </div>
  );
}
