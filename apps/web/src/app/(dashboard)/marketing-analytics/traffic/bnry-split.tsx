"use client";

// BNRY-by-source donut — three slices (STW / Games / Videos) as an inline SVG,
// with a legend showing each source's share of total BNRY earned. Shared by the
// per-telco detail view and the holistic overview.
export function BnrySplit({
  bnry,
}: {
  bnry: { stw: number; games: number; videos: number; total: number };
}) {
  const slices = [
    { key: "stw", label: "Spin the Wheel", value: bnry.stw, color: "#9ecf3f" },
    { key: "games", label: "Games", value: bnry.games, color: "#7e9eff" },
    { key: "videos", label: "Videos", value: bnry.videos, color: "#eaff6a" },
  ];
  const total = bnry.total || 1;
  const cx = 90;
  const cy = 90;
  const r = 78;
  let angle = -Math.PI / 2;
  const paths = slices
    .map((s) => {
      const frac = s.value / total;
      if (frac <= 0) return null;
      if (frac >= 0.9999) {
        return (
          <circle
            key={s.key}
            cx={cx}
            cy={cy}
            r={r}
            fill={s.color}
            stroke="var(--color-card)"
            strokeWidth={2}
          />
        );
      }
      const start = angle;
      const end = angle + frac * 2 * Math.PI;
      angle = end;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const large = frac > 0.5 ? 1 : 0;
      return (
        <path
          key={s.key}
          d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
          fill={s.color}
          stroke="var(--color-card)"
          strokeWidth={2}
        />
      );
    })
    .filter(Boolean);

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 180 180" className="size-40 shrink-0">
        {paths}
        <circle cx={cx} cy={cy} r={40} fill="var(--color-card)" />
      </svg>
      <div className="flex-1 space-y-2">
        {slices.map((s) => {
          const pct = (s.value / total) * 100;
          return (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span
                className="size-3 rounded-sm"
                style={{ background: s.color }}
              />
              <span className="flex-1">{s.label}</span>
              <span className="font-medium tabular-nums">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
