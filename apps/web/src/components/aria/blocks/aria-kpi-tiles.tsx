import type { KpiTilesPayload } from "@/components/aria/blocks/types";

/**
 * Compact KPI strip rendered inline in an assistant reply. Mirrors
 * the headline tiles users already see on the dashboard cards
 * (label above, value below, optional hint). Capped width so two or
 * three tiles stay legible inside a chat bubble; longer lists wrap.
 */
export function AriaKpiTiles({ payload }: { payload: KpiTilesPayload }) {
  return (
    <div
      className={`
        my-2 grid gap-2
        sm:grid-cols-2
        md:grid-cols-3
      `}
    >
      {payload.tiles.map((tile, i) => (
        <div
          key={`${i}-${tile.label}`}
          className={`
            border-border/60 bg-background/60 rounded-md border px-3 py-2
          `}
        >
          <div
            className={`
              text-muted-foreground/80 text-[10px] font-medium tracking-wide
              uppercase
            `}
          >
            {tile.label}
          </div>
          <div
            className={`
              text-foreground mt-0.5 text-lg leading-tight font-semibold
            `}
          >
            {tile.value}
          </div>
          {tile.hint ? (
            <div className="text-muted-foreground mt-0.5 text-[11px]">
              {tile.hint}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
