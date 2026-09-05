import type { Db } from "@nexora/db";
import * as repo from "./marketing-reports.repository.js";

export async function dashboard(db: Db, opts: { days?: number; telco?: string } = {}) {
  const days = opts.days ?? 30;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const to = end.toISOString().slice(0, 10);
  const from = start.toISOString().slice(0, 10);
  const [metrics, telcos] = await Promise.all([
    repo.recentMetrics(db, from, to, opts.telco),
    repo.listTelcos(db),
  ]);
  const latestByTelco = new Map<string, (typeof metrics)[number]>();
  for (const row of metrics) {
    if (!latestByTelco.has(row.telco)) latestByTelco.set(row.telco, row);
  }
  return {
    data: {
      window: { from, to, days },
      telcos,
      latestByTelco: Object.fromEntries(latestByTelco),
      series: metrics,
    },
  };
}
