"use client";

import { useMemo } from "react";

import { formatDateShort } from "@/components/projects/project-board-utils";
import { RecordCard } from "@/components/shared/responsive/record-card";
import { StateView } from "@/components/shared/responsive/state-view";
import { StatusBadge } from "@/components/shared/responsive/status-badge";
import type { TimelineSnapshot } from "@/services/project.service";

// The project schedule, below 1024px, as a chronology rather than a chart.
//
// Why not the Gantt itself. Its left label pane is `w-80 shrink-0` — 320px that
// cannot compress — so inside a 320px viewport (288px of content) the chart is
// left with zero pixels and the page shows labels and nothing else. The grid is
// `days × 32px`, so a quarter-long project is ~2,900px wide. And its
// reschedule/resize gestures are wired to `onMouseDown` plus window
// `mousemove` / `mouseup`, which touch browsers never fire during a gesture:
// the bars look draggable and are not.
//
// So this is deliberately READ-ONLY, and shows no drag affordance at all. That
// is the point rather than a shortfall — a handle that cannot work is worse
// than no handle. Tapping a row opens the same task sheet the Gantt opens, so
// dates are still editable on a phone, through a form instead of a gesture.
//
// Same `snapshot`, same tasks, same milestones. No second endpoint and no
// duplicated date arithmetic: ordering and grouping are derived here, and every
// date is rendered by the board's own `formatDateShort`.

export interface TimelineMobileListProps {
  snapshot: TimelineSnapshot;
  /** The page's existing handler — opens the task detail sheet. */
  onTaskClick?: (taskId: string) => void;
}

/** Month heading for a task's start, or a bucket for the undated. */
const UNDATED = "Not scheduled";

function monthKey(iso: string | null | undefined): string {
  if (!iso) return UNDATED;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return UNDATED;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function startOf(t: { startDate?: string | null; endDate?: string | null }) {
  return t.startDate ?? t.endDate ?? null;
}

export function TimelineMobileList({
  snapshot,
  onTaskClick,
}: TimelineMobileListProps) {
  const milestoneTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of snapshot.milestones) map.set(m.id, m.title);
    return map;
  }, [snapshot.milestones]);

  // Chronological, undated last. A schedule read top to bottom is the whole
  // reason this presentation is acceptable in place of a chart.
  const groups = useMemo(() => {
    const sorted = [...snapshot.tasks].sort((a, b) => {
      const sa = startOf(a);
      const sb = startOf(b);
      if (!sa && !sb) return a.title.localeCompare(b.title);
      if (!sa) return 1;
      if (!sb) return -1;
      return sa.localeCompare(sb);
    });

    const out: Array<{ key: string; tasks: typeof sorted }> = [];
    for (const task of sorted) {
      const key = monthKey(startOf(task));
      const last = out[out.length - 1];
      if (last && last.key === key) last.tasks.push(task);
      else out.push({ key, tasks: [task] });
    }
    return out;
  }, [snapshot.tasks]);

  if (snapshot.tasks.length === 0) {
    return (
      <StateView
        kind="empty"
        title="Nothing scheduled yet"
        message="Tasks with start or due dates appear here in date order."
        compact
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      {groups.map((group) => (
        <section key={group.key} className="mb-4">
          <h3
            className={`
              text-muted-foreground bg-background sticky top-0 z-10 mb-2 py-1
              text-[11px] font-bold tracking-widest uppercase
            `}
          >
            {group.key}
          </h3>
          <div className="space-y-2.5">
            {group.tasks.map((task) => {
              const start = formatDateShort(task.startDate ?? null);
              const end = formatDateShort(task.endDate ?? null);
              const milestone = task.milestoneId
                ? milestoneTitle.get(task.milestoneId)
                : undefined;

              const fields = [
                start || end
                  ? {
                      label: "Dates",
                      value:
                        start && end
                          ? `${start} → ${end}`
                          : (start ?? end ?? "—"),
                    }
                  : null,
                milestone ? { label: "Milestone", value: milestone } : null,
              ].filter((f) => f !== null);

              return (
                <RecordCard
                  key={task.id}
                  title={task.title}
                  badge={<StatusBadge status={task.status} />}
                  fields={fields}
                  onClick={onTaskClick ? () => onTaskClick(task.id) : undefined}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
