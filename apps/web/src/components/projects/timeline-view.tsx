"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ProjectMilestone,
  Task,
  TaskDependency,
  TimelineSnapshot,
} from "@/services/project.service";

// ─── Time math ──────────────────────────────────────────

const DAY_MS = 86_400_000;
const DEFAULT_DAY_WIDTH = 32;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 56;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // Accept either YYYY-MM-DD or full ISO. Day precision only.
  const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "2-digit" });
}

function formatMonthLong(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatWeekdayShort(d: Date): string {
  // Single-letter weekday — Mon/Tue/Wed/Thu/Fri/Sat/Sun → M/T/W/T/F/S/S.
  // `narrow` is locale-aware so e.g. ja-JP renders 月/火/水… rather than M/T/W.
  return d.toLocaleDateString(undefined, { weekday: "narrow" });
}

/**
 * Groups consecutive days by (year, month) so the header can render a
 * single banner across all of "May 2026", "Jun 2026", etc. instead of
 * cramming "May 26" into every 32 px day cell. Returns the segments
 * in left-to-right order with the cell-count needed to size each
 * banner.
 */
function buildMonthSegments(
  rangeStart: Date,
  totalDays: number,
): Array<{ key: string; label: string; count: number }> {
  const segments: Array<{ key: string; label: string; count: number }> = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(rangeStart, i);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const last = segments[segments.length - 1];
    if (last && last.key === key) {
      last.count++;
    } else {
      segments.push({ key, label: formatMonthLong(d), count: 1 });
    }
  }
  return segments;
}

// ─── Types ──────────────────────────────────────────────

type RowKind = "milestone" | "task";

interface TimelineRow {
  kind: RowKind;
  id: string;
  parentId: string | null;
  title: string;
  depth: number;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  hasChildren: boolean;
  /** original payload for dialog open / drag ops */
  raw: ProjectMilestone | Task;
}

interface TimelineViewProps {
  snapshot: TimelineSnapshot;
  onTaskClick?: (taskId: string) => void;
  onMilestoneClick?: (milestoneId: string) => void;
  onAddMilestone?: () => void;
  onTaskDateChange?: (
    taskId: string,
    range: { startDate: string; endDate: string },
  ) => void;
}

// ─── Helpers ────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  todo: "bg-slate-400",
  backlog: "bg-zinc-400",
  in_progress: "bg-amber-500",
  in_review: "bg-purple-500",
  done: "bg-emerald-500",
  not_started: "bg-slate-400",
  blocked: "bg-rose-500",
};

const colourFor = (status: string) => STATUS_COLOURS[status] ?? "bg-slate-400";

/**
 * Returns the set of task ids on the project's critical path — the
 * longest chain of dependencies measured in days.
 *
 * Algorithm: DAG longest-path via memoized DFS over predecessor
 * edges. For each task we compute the longest chain whose terminal
 * node is that task, then pick the global max. The chain comes back
 * in order so the caller can also expose it as a sequence if needed.
 *
 * Duration: max(1, endDate - startDate + 1) so a single-day task
 * still contributes one unit and tasks with no range fall back to 1.
 *
 * Complexity: O(V + E) per call thanks to memoization. Phase 2's
 * cycle check guarantees the input is acyclic.
 */
export function computeCriticalPath(
  tasks: Task[],
  dependencies: TaskDependency[],
): Set<string> {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const preds = new Map<string, string[]>();
  for (const d of dependencies) {
    if (!preds.has(d.taskId)) preds.set(d.taskId, []);
    preds.get(d.taskId)!.push(d.dependsOnTaskId);
  }

  const durationDays = (t: Task): number => {
    const s = parseISODate(t.startDate ?? null);
    const e = parseISODate(t.endDate ?? null);
    if (!s || !e) return 1;
    return Math.max(1, daysBetween(s, e) + 1);
  };

  const memo = new Map<string, { len: number; chain: string[] }>();
  function longestPathTo(id: string): { len: number; chain: string[] } {
    const cached = memo.get(id);
    if (cached) return cached;
    const task = taskMap.get(id);
    const dur = task ? durationDays(task) : 1;
    let best: { len: number; chain: string[] } = { len: dur, chain: [id] };
    for (const p of preds.get(id) ?? []) {
      const sub = longestPathTo(p);
      const combined = sub.len + dur;
      if (combined > best.len) {
        best = { len: combined, chain: [...sub.chain, id] };
      }
    }
    memo.set(id, best);
    return best;
  }

  let max: { len: number; chain: string[] } = { len: 0, chain: [] };
  for (const t of tasks) {
    const r = longestPathTo(t.id);
    if (r.len > max.len) max = r;
  }
  return new Set(max.chain);
}

/**
 * Walks `tasks` to build a flat ordered list where each parent is
 * immediately followed by its descendants. Honours sortOrder within a
 * sibling group. Tasks without a parent and without a milestone are
 * grouped under a synthetic "unassigned" bucket by the caller.
 */
function flattenTaskTree(
  tasks: Task[],
  rootFilter: (t: Task) => boolean,
  expanded: Set<string>,
  depth: number,
  parentId: string | null,
): TimelineRow[] {
  const roots = tasks
    .filter(rootFilter)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const rows: TimelineRow[] = [];
  for (const t of roots) {
    const children = tasks.filter((x) => x.parentTaskId === t.id);
    rows.push({
      kind: "task",
      id: t.id,
      parentId,
      title: t.title,
      depth,
      status: t.status,
      startDate: parseISODate(t.startDate ?? null),
      endDate: parseISODate(t.endDate ?? null),
      hasChildren: children.length > 0,
      raw: t,
    });
    if (children.length > 0 && expanded.has(t.id)) {
      rows.push(
        ...flattenTaskTree(
          tasks,
          (x) => x.parentTaskId === t.id,
          expanded,
          depth + 1,
          t.id,
        ),
      );
    }
  }
  return rows;
}

// ─── Component ──────────────────────────────────────────

export function TimelineView({
  snapshot,
  onTaskClick,
  onMilestoneClick,
  onAddMilestone,
  onTaskDateChange,
}: TimelineViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Start fully expanded so the user sees the whole tree on first
    // open. Collapse state persists per-session.
    const ids = new Set<string>();
    for (const t of snapshot.tasks) ids.add(t.id);
    for (const m of snapshot.milestones) ids.add(m.id);
    ids.add("__unassigned__");
    return ids;
  });

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Flatten everything into rows the grid can render in order.
  const rows = useMemo<TimelineRow[]>(() => {
    const result: TimelineRow[] = [];
    const milestones = [...snapshot.milestones].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    // Milestones (and their tasks).
    for (const m of milestones) {
      const tasksUnder = snapshot.tasks.filter(
        (t) => t.milestoneId === m.id && !t.parentTaskId,
      );
      result.push({
        kind: "milestone",
        id: m.id,
        parentId: null,
        title: m.title,
        depth: 0,
        status: m.status,
        startDate: parseISODate(m.startDate),
        endDate: parseISODate(m.endDate),
        hasChildren: tasksUnder.length > 0,
        raw: m,
      });
      if (tasksUnder.length > 0 && expanded.has(m.id)) {
        result.push(
          ...flattenTaskTree(
            snapshot.tasks,
            (t) => t.milestoneId === m.id && !t.parentTaskId,
            expanded,
            1,
            m.id,
          ),
        );
      }
    }
    // Orphan tasks (no milestone) — synthetic bucket.
    const orphans = snapshot.tasks.filter(
      (t) => !t.milestoneId && !t.parentTaskId,
    );
    if (orphans.length > 0) {
      result.push({
        kind: "milestone",
        id: "__unassigned__",
        parentId: null,
        title: "Unassigned",
        depth: 0,
        status: "not_started",
        startDate: null,
        endDate: null,
        hasChildren: true,
        raw: {
          id: "__unassigned__",
          title: "Unassigned",
        } as unknown as ProjectMilestone,
      });
      if (expanded.has("__unassigned__")) {
        result.push(
          ...flattenTaskTree(
            snapshot.tasks,
            (t) => !t.milestoneId && !t.parentTaskId,
            expanded,
            1,
            "__unassigned__",
          ),
        );
      }
    }
    return result;
  }, [snapshot, expanded]);

  // Date range for the grid — span of every row, padded ±3 days on
  // each side so the bars don't sit flush against the viewport edges.
  // Falls back to a 30-day window anchored on today when nothing has a
  // date yet.
  const { rangeStart, totalDays } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const r of rows) {
      if (r.startDate && (!min || r.startDate < min)) min = r.startDate;
      if (r.endDate && (!max || r.endDate > max)) max = r.endDate;
    }
    if (!min || !max) {
      const today = new Date();
      const start = addDays(today, -7);
      return { rangeStart: start, totalDays: 30 };
    }
    const start = addDays(min, -3);
    const end = addDays(max, 3);
    return { rangeStart: start, totalDays: daysBetween(start, end) + 1 };
  }, [rows]);

  const dayWidth = DEFAULT_DAY_WIDTH;
  const gridWidth = totalDays * dayWidth;
  const gridHeight = rows.length * ROW_HEIGHT;

  const today = useMemo(() => new Date(isoDay(new Date()) + "T00:00:00Z"), []);
  const todayOffset = useMemo(() => {
    const d = daysBetween(rangeStart, today);
    return d * dayWidth;
  }, [rangeStart, today, dayWidth]);

  const xForDate = useCallback(
    (d: Date | null) => {
      if (!d) return null;
      return daysBetween(rangeStart, d) * dayWidth;
    },
    [rangeStart, dayWidth],
  );

  // Index rows by id for dependency arrow lookup.
  const rowIndex = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.id, i));
    return m;
  }, [rows]);

  // Critical-path set — recomputed only when tasks or dependencies
  // shift, not on every collapse / drag preview tick.
  const criticalIds = useMemo(
    () => computeCriticalPath(snapshot.tasks, snapshot.dependencies),
    [snapshot.tasks, snapshot.dependencies],
  );

  // ─── Drag-to-reschedule ─────────────────────────────────

  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    taskId: string;
    mode: "move" | "resize-end";
    startX: number;
    origStart: Date | null;
    origEnd: Date | null;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    start: Date;
    end: Date;
  } | null>(null);

  const onBarMouseDown = (
    e: React.MouseEvent<HTMLElement>,
    row: TimelineRow,
    mode: "move" | "resize-end",
  ) => {
    if (row.kind !== "task") return;
    if (!row.startDate || !row.endDate) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      taskId: row.id,
      mode,
      startX: e.clientX,
      origStart: row.startDate,
      origEnd: row.endDate,
    };
    setDragPreview({ id: row.id, start: row.startDate, end: row.endDate });
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd, { once: true });
  };

  const onDragMove = (e: MouseEvent) => {
    const st = dragState.current;
    if (!st || !st.origStart || !st.origEnd) return;
    const deltaPx = e.clientX - st.startX;
    const deltaDays = Math.round(deltaPx / dayWidth);
    if (st.mode === "move") {
      setDragPreview({
        id: st.taskId,
        start: addDays(st.origStart, deltaDays),
        end: addDays(st.origEnd, deltaDays),
      });
    } else {
      const proposedEnd = addDays(st.origEnd, deltaDays);
      // Don't allow end to slide past start — snap to start.
      const end = proposedEnd < st.origStart ? st.origStart : proposedEnd;
      setDragPreview({ id: st.taskId, start: st.origStart, end });
    }
  };

  const onDragEnd = () => {
    const st = dragState.current;
    const preview = dragPreview;
    dragState.current = null;
    window.removeEventListener("mousemove", onDragMove);
    if (!st || !preview || !onTaskDateChange) {
      setDragPreview(null);
      return;
    }
    onTaskDateChange(st.taskId, {
      startDate: isoDay(preview.start),
      endDate: isoDay(preview.end),
    });
    setDragPreview(null);
  };

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="bg-card flex flex-col rounded-md border">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div
          className={`
            text-foreground flex items-center gap-3 text-sm font-medium
          `}
        >
          <span>
            {totalDays} days · {rows.length} items
          </span>
          {criticalIds.size > 0 ? (
            <span
              className={`text-muted-foreground flex items-center gap-1 text-xs`}
            >
              <span
                className={`
                  inline-block size-2 rounded-sm bg-rose-600 ring-1
                  ring-rose-700
                `}
              />
              Critical path · {criticalIds.size} tasks
            </span>
          ) : null}
        </div>
        {onAddMilestone ? (
          <Button size="sm" variant="outline" onClick={onAddMilestone}>
            <Plus className="mr-1 h-4 w-4" />
            Milestone
          </Button>
        ) : null}
      </div>

      <div className="flex max-h-[70vh] overflow-hidden">
        {/* Left: tree pane */}
        <div className="w-80 shrink-0 overflow-auto border-r">
          <div
            className={`
              bg-muted/40 text-muted-foreground border-b px-3 py-2 text-xs
              font-medium tracking-wide uppercase
            `}
            style={{ height: HEADER_HEIGHT }}
          >
            Name
          </div>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                if (row.kind === "task") {
                  onTaskClick?.(row.id);
                } else if (row.id !== "__unassigned__") {
                  onMilestoneClick?.(row.id);
                }
              }}
              className={`
                hover:bg-muted/60
                flex w-full items-center gap-1 border-b px-2 text-left text-sm
              `}
              style={{ height: ROW_HEIGHT, paddingLeft: 8 + row.depth * 16 }}
            >
              {row.hasChildren ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(row.id);
                  }}
                  className={`
                    text-muted-foreground flex h-5 w-5 items-center
                    justify-center
                    hover:text-foreground
                  `}
                >
                  {expanded.has(row.id) ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
              ) : (
                <span className="w-5" />
              )}
              <span
                className={cn(
                  "truncate",
                  row.kind === "milestone" && "font-medium",
                )}
              >
                {row.title}
              </span>
              {row.kind === "milestone" && row.id !== "__unassigned__" ? (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {row.status.replace(/_/g, " ")}
                </Badge>
              ) : null}
            </button>
          ))}
        </div>

        {/* Right: grid + bars */}
        <div className="relative flex-1 overflow-auto" ref={gridScrollRef}>
          {/* Two-band header: month banner on top, day cells with
              weekday letter on the bottom. Splitting the strip avoids
              cramming "May 2026" into every 32 px column — the month
              label now spans every day in its month, much easier to
              parse at a glance. */}
          <div
            className={`
              bg-muted/40 text-muted-foreground sticky top-0 z-10 border-b
            `}
            style={{ width: gridWidth, height: HEADER_HEIGHT }}
          >
            {/* Top band — month banners. */}
            <div className="flex h-6 border-b">
              {buildMonthSegments(rangeStart, totalDays).map((seg) => (
                <div
                  key={seg.key}
                  className={`
                    text-foreground flex items-center border-r px-2 text-[11px]
                    font-semibold tracking-wide uppercase
                  `}
                  style={{ width: seg.count * dayWidth }}
                >
                  <span className="truncate">{seg.label}</span>
                </div>
              ))}
            </div>

            {/* Bottom band — day numbers with single-letter weekday. */}
            <div className="flex" style={{ height: HEADER_HEIGHT - 24 }}>
              {Array.from({ length: totalDays }, (_, i) => {
                const d = addDays(rangeStart, i);
                const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                const isToday = isoDay(d) === isoDay(today);
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col items-center justify-center border-r",
                      isWeekend ? "bg-muted/60" : "",
                    )}
                    style={{ width: dayWidth }}
                  >
                    <span
                      className={cn(
                        "text-[12px] leading-tight",
                        isToday
                          ? "bg-rose-500 text-white font-bold rounded-full flex h-5 w-5 items-center justify-center"
                          : "text-foreground font-medium",
                      )}
                    >
                      {formatDay(d)}
                    </span>
                    <span
                      className={`
                        text-muted-foreground mt-0.5 text-[9px] leading-none
                        tracking-wide uppercase
                      `}
                    >
                      {formatWeekdayShort(d)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bar rows */}
          <div
            className="relative"
            style={{ width: gridWidth, height: gridHeight }}
          >
            {/* Today line */}
            {todayOffset >= 0 && todayOffset <= gridWidth ? (
              <div
                className={`
                  pointer-events-none absolute top-0 z-10 w-px bg-rose-500
                `}
                style={{ left: todayOffset, height: gridHeight }}
              />
            ) : null}

            {/* Row backgrounds + weekend stripes */}
            {rows.map((_, i) => (
              <div
                key={`bg-${i}`}
                className="border-border/50 absolute right-0 left-0 border-b"
                style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
              />
            ))}

            {/* Bars */}
            {rows.map((row, i) => {
              const isPreview = dragPreview && dragPreview.id === row.id;
              const start = isPreview
                ? dragPreview.start
                : (row.startDate ?? null);
              const end = isPreview ? dragPreview.end : (row.endDate ?? null);
              const xStart = xForDate(start);
              const xEnd = xForDate(end);
              if (xStart === null || xEnd === null) return null;
              const w = Math.max(8, xEnd - xStart + dayWidth);
              const top = i * ROW_HEIGHT + 6;
              const onCritical = row.kind === "task" && criticalIds.has(row.id);
              return (
                <div
                  key={`bar-${row.id}`}
                  data-row-id={row.id}
                  onClick={() => {
                    if (row.kind === "task") {
                      onTaskClick?.(row.id);
                    } else if (row.id !== "__unassigned__") {
                      onMilestoneClick?.(row.id);
                    }
                  }}
                  onMouseDown={(e) => onBarMouseDown(e, row, "move")}
                  className={cn(
                    `
                      absolute flex items-center rounded-sm px-2 text-[11px]
                      font-medium text-white shadow-sm
                    `,
                    colourFor(row.status),
                    row.kind === "milestone" ? "h-5" : "h-6 cursor-grab",
                    onCritical && "ring-2 ring-rose-600 ring-offset-1",
                  )}
                  style={{ left: xStart, top, width: w }}
                  title={`${row.title}${start && end ? ` · ${isoDay(start)} → ${isoDay(end)}` : ""}${onCritical ? " · critical path" : ""}`}
                >
                  <span className="truncate">{row.title}</span>
                  {row.kind === "task" ? (
                    <span
                      onMouseDown={(e) => onBarMouseDown(e, row, "resize-end")}
                      className={`
                        absolute top-0 right-0 h-full w-1.5 cursor-ew-resize
                        bg-white/30
                      `}
                    />
                  ) : null}
                </div>
              );
            })}

            {/* Dependency arrows (SVG overlay). Maps each dep
                `task → dependsOnTask` to a finish→start polyline:
                  start at right edge of predecessor bar end
                  bend at midpoint of vertical gap
                  end at left edge of dependent bar start. */}
            <svg
              className="pointer-events-none absolute inset-0"
              width={gridWidth}
              height={gridHeight}
              style={{ overflow: "visible" }}
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#a1a1aa" />
                </marker>
              </defs>
              {snapshot.dependencies.map((d: TaskDependency) => {
                const fromIdx = rowIndex.get(d.dependsOnTaskId);
                const toIdx = rowIndex.get(d.taskId);
                if (fromIdx === undefined || toIdx === undefined) return null;
                const fromRow = rows[fromIdx];
                const toRow = rows[toIdx];
                if (!fromRow.endDate || !toRow.startDate || fromIdx === toIdx) {
                  return null;
                }
                const fromX = (xForDate(fromRow.endDate) ?? 0) + dayWidth;
                const fromY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const toX = xForDate(toRow.startDate) ?? 0;
                const toY = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const midX = Math.max(fromX + 12, toX - 12);
                const path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
                // An arrow is on the critical path when both endpoints
                // belong to it. Highlights the chain visually.
                const onCritical =
                  criticalIds.has(d.taskId) &&
                  criticalIds.has(d.dependsOnTaskId);
                return (
                  <path
                    key={d.id}
                    d={path}
                    fill="none"
                    stroke={onCritical ? "#e11d48" : "#a1a1aa"}
                    strokeWidth={onCritical ? 2 : 1.25}
                    markerEnd="url(#arrow)"
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
