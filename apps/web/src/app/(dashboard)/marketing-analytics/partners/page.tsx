"use client";

import { ArrowLeft, ArrowRight, Sigma, Table2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { flagFor } from "@/app/(dashboard)/marketing-analytics/partners/partner-ui";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/auth-provider";
import {
  listMarketingPartners,
  type MarketingPartner,
} from "@/services/marketing-analytics.service";

/**
 * Partner index — one card per telco, each drilling into that partner's Raw
 * Data and Metrics. Mirrors the Atlas operator console's Workspaces screen.
 *
 * Only fields we actually source are shown. Atlas's cards also carry Members /
 * MRR / Contract-until, but those are static seed config there (hardcoded to
 * "—", "$0" and "Ongoing" in its own markup), so reproducing them would be
 * inventing data rather than mirroring it.
 */
export default function MarketingPartnersPage() {
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(
    "marketing:dashboard:view",
    "marketing:raw:view",
  );

  const [partners, setPartners] = useState<MarketingPartner[] | null>(null);

  useEffect(() => {
    void listMarketingPartners()
      .then((r) => setPartners(r.data))
      .catch(() => setPartners([]));
  }, []);

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Partners" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to Marketing Analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Partners"
        subtitle="One workspace per carrier partner. Open a card to drill into raw data or the metrics catalog."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics">
            <ArrowLeft className="mr-1 size-3.5" />
            Marketing Analytics
          </Link>
        </Button>
      </PageHeader>

      <p
        className={`
          text-muted-foreground mb-5 text-[11px] tracking-wider uppercase
        `}
      >
        {partners ? `${partners.length} partners` : "Loading"} · sourced live
        from the BNII Analytics API
      </p>

      {!partners ? (
        <div
          className={`
            grid gap-4
            md:grid-cols-2
            xl:grid-cols-3
          `}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[190px] rounded-xl" />
          ))}
        </div>
      ) : partners.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No telco partners configured. Set MARKETING_ANALYTICS_PARTNER_IDS.
        </p>
      ) : (
        <div
          className={`
            grid gap-4
            md:grid-cols-2
            xl:grid-cols-3
          `}
        >
          {partners.map((p) => (
            <div
              key={p.id}
              className={`
                bg-card flex flex-col rounded-xl border p-5 transition-shadow
                hover:shadow-sm
              `}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h2 className="text-xl font-semibold">
                  {flagFor(p.country) ? `${flagFor(p.country)} ` : ""}
                  {p.name}
                </h2>
              </div>
              <p
                className={`
                  text-muted-foreground mb-4 font-mono text-[11px]
                  tracking-wider uppercase
                `}
              >
                {[p.country, p.subscribers ? `${p.subscribers} subs` : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>

              <dl className="mb-5 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Host MAU</dt>
                  <dd className="tabular-nums">
                    {p.hostMau ? p.hostMau.toLocaleString() : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Host DAU</dt>
                  <dd className="tabular-nums">
                    {p.hostDau ? p.hostDau.toLocaleString() : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Data status</dt>
                  <dd
                    className={`
                      inline-flex items-center gap-1.5 font-mono text-[11px]
                      text-emerald-700
                    `}
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    real (BNII)
                  </dd>
                </div>
              </dl>

              <div className="mt-auto flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/marketing-analytics/partners/${p.id}/raw`}>
                    <Table2 className="mr-1 size-3.5" />
                    Raw Data
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/marketing-analytics/partners/${p.id}/metrics`}>
                    <Sigma className="mr-1 size-3.5" />
                    Metrics
                  </Link>
                </Button>
              </div>

              <Link
                href={`/marketing-analytics/traffic/${p.id}`}
                className={`
                  text-muted-foreground mt-3 inline-flex items-center gap-1
                  text-xs
                  hover:underline
                `}
              >
                Traffic detail
                <ArrowRight className="size-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
