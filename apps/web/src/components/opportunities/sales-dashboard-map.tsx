"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import { useMemo, useState } from "react";
import { feature } from "topojson-client";
import worldRaw from "world-atlas/countries-110m.json";

import {
  countryMatchesFeature,
  type DisplayStage,
  fmtMoney,
  STAGE_COLOR,
} from "@/components/opportunities/sales-dashboard-utils";

const W = 820;
const H = 400;

export interface MapDeal {
  country: string;
  stage: DisplayStage;
  value: number;
}

type CountryFeature = Feature<Geometry, GeoJsonProperties>;

interface CountryAgg {
  count: number;
  tcv: number;
  stage: DisplayStage;
}

interface TooltipState {
  x: number;
  y: number;
  lines: string[];
}

export function SalesDashboardMap({ deals }: { deals: MapDeal[] }) {
  // Parse + project once. The TopoJSON labels features by
  // `properties.name`, which we match against CRM country values.
  const { features, pathFor } = useMemo(() => {
    const fc = feature(
      worldRaw as unknown as Parameters<typeof feature>[0],
      (worldRaw as unknown as { objects: { countries: unknown } }).objects
        .countries as Parameters<typeof feature>[1],
    ) as FeatureCollection<Geometry, GeoJsonProperties>;
    const projection = geoNaturalEarth1()
      .scale(150)
      .translate([W / 2, H / 2]);
    const path = geoPath(projection);
    return {
      features: fc.features,
      pathFor: (f: CountryFeature) =>
        path(f as Parameters<typeof path>[0]) ?? "",
    };
  }, []);

  // Aggregate deals by CRM country. First-seen stage wins for the fill —
  // the legend below the map carries the full stage key regardless.
  const byCountry = useMemo(() => {
    const map = new Map<string, CountryAgg>();
    for (const d of deals) {
      if (!d.country) continue;
      const cur = map.get(d.country);
      if (cur) {
        cur.count += 1;
        cur.tcv += d.value;
      } else {
        map.set(d.country, { count: 1, tcv: d.value, stage: d.stage });
      }
    }
    return map;
  }, [deals]);

  const [tip, setTip] = useState<TooltipState | null>(null);

  function aggForFeature(name: string): [string, CountryAgg] | null {
    for (const [country, agg] of byCountry) {
      if (countryMatchesFeature(country, name)) return [country, agg];
    }
    return null;
  }

  const stagesPresent = Array.from(new Set(deals.map((d) => d.stage)));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Deal stage by country"
        onMouseLeave={() => setTip(null)}
      >
        {features.map((f, i) => {
          const name =
            (f.properties?.name as string | undefined) ?? String(f.id ?? i);
          const hit = aggForFeature(name);
          const fill = hit
            ? `${STAGE_COLOR[hit[1].stage]}66`
            : "hsl(var(--muted))";
          const stroke = hit
            ? "hsl(var(--muted-foreground))"
            : "hsl(var(--border))";
          return (
            <path
              key={(f.id as string | number | undefined) ?? i}
              d={pathFor(f)}
              fill={fill}
              stroke={stroke}
              strokeWidth={hit ? 0.7 : 0.4}
              onMouseMove={(e) => {
                if (!hit) {
                  setTip(null);
                  return;
                }
                const rect = (
                  e.currentTarget.ownerSVGElement as SVGSVGElement
                ).getBoundingClientRect();
                const [country, agg] = hit;
                setTip({
                  x: e.clientX - rect.left + 12,
                  y: e.clientY - rect.top - 8,
                  lines: [
                    country,
                    `${agg.count} deal${agg.count > 1 ? "s" : ""} · ${agg.stage}`,
                    agg.tcv ? `TCV ${fmtMoney(agg.tcv)}` : "",
                  ].filter(Boolean),
                });
              }}
            />
          );
        })}
      </svg>

      {tip ? (
        <div
          className={`
            bg-foreground text-background pointer-events-none absolute z-10
            rounded px-2 py-1 text-[11px] leading-tight shadow
          `}
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.lines.map((l, i) => (
            <div key={i} className={i === 0 ? "font-semibold" : ""}>
              {l}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3">
        {stagesPresent.map((s) => (
          <span
            key={s}
            className={`
              text-muted-foreground flex items-center gap-1.5 text-[11px]
            `}
          >
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{
                background: `${STAGE_COLOR[s]}66`,
                border: `1px solid ${STAGE_COLOR[s]}`,
              }}
            />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
