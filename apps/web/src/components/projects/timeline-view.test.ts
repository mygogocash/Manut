import { describe, expect, it } from "vitest";

import type { Task, TaskDependency } from "@/services/project.service";

import { computeCriticalPath } from "./timeline-view";

// Helper — build a synthetic task with start/end inferred from a
// duration (in days) so the tests read like a Gantt diagram.
function task(id: string, startISO: string, durationDays: number): Task {
  const end = new Date(startISO + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + (durationDays - 1));
  return {
    id,
    title: id,
    description: null,
    status: "todo",
    priority: "P1",
    order: 0,
    assigneeId: null,
    assigneeName: null,
    startDate: startISO,
    endDate: end.toISOString().slice(0, 10),
    projectId: "p-1",
    createdAt: "2026-01-01T00:00:00Z",
  };
}

function dep(taskId: string, dependsOn: string): TaskDependency {
  return {
    id: `${taskId}<-${dependsOn}`,
    taskId,
    dependsOnTaskId: dependsOn,
    type: "finish_to_start",
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("computeCriticalPath", () => {
  it("returns an empty set when there are no tasks", () => {
    expect(computeCriticalPath([], [])).toEqual(new Set());
  });

  it("returns just the longest task when there are no dependencies", () => {
    const A = task("A", "2026-05-01", 3); // 3-day task
    const B = task("B", "2026-05-02", 5); // 5-day task — wins
    const C = task("C", "2026-05-03", 2);
    const result = computeCriticalPath([A, B, C], []);
    expect(result).toEqual(new Set(["B"]));
  });

  it("picks the chain with the largest total duration, not the most edges", () => {
    // Two candidate chains:
    //   A(2) → B(2) → D(2)   total 6
    //   C(8) → D(2)          total 10  ← wins
    const A = task("A", "2026-05-01", 2);
    const B = task("B", "2026-05-04", 2);
    const C = task("C", "2026-05-01", 8);
    const D = task("D", "2026-05-09", 2);
    const deps = [dep("B", "A"), dep("D", "B"), dep("D", "C")];
    const result = computeCriticalPath([A, B, C, D], deps);
    expect(result).toEqual(new Set(["C", "D"]));
  });

  it("treats tasks without a date range as 1-day duration", () => {
    const A: Task = {
      ...task("A", "2026-05-01", 1),
      startDate: null,
      endDate: null,
    };
    const B = task("B", "2026-05-02", 5); // 5-day, longer alone
    const result = computeCriticalPath([A, B], []);
    expect(result).toEqual(new Set(["B"]));
  });

  it("falls back to 1-day duration when start/end are missing on chained tasks", () => {
    // Phase 4c retired the legacy `dueDate` column. Tasks without
    // any range now count as 1 day each, regardless of priors.
    const A: Task = {
      ...task("A", "2026-05-01", 1),
      startDate: null,
      endDate: null,
    };
    const B = task("B", "2026-05-01", 1);
    // Chain A → B yields length 2 (1 + 1), vs B alone length 1.
    const result = computeCriticalPath([A, B], [dep("B", "A")]);
    expect(result).toEqual(new Set(["A", "B"]));
  });
});
