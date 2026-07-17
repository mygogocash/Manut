import { describe, expect, it } from "vitest";

import { normalizeProjectTaskPriority } from "@/modules/projects/project-task-priority";

describe("normalizeProjectTaskPriority", () => {
  it("maps legacy values to P0|P1|P2", () => {
    expect(normalizeProjectTaskPriority("critical")).toBe("P0");
    expect(normalizeProjectTaskPriority("urgent")).toBe("P0");
    expect(normalizeProjectTaskPriority("high")).toBe("P0");
    expect(normalizeProjectTaskPriority("medium")).toBe("P1");
    expect(normalizeProjectTaskPriority("low")).toBe("P2");
  });

  it("keeps canonical P values", () => {
    expect(normalizeProjectTaskPriority("P0")).toBe("P0");
    expect(normalizeProjectTaskPriority("p1")).toBe("P1");
    expect(normalizeProjectTaskPriority("P2")).toBe("P2");
  });

  it("defaults unknown to P1", () => {
    expect(normalizeProjectTaskPriority("")).toBe("P1");
    expect(normalizeProjectTaskPriority("unknown")).toBe("P1");
  });
});
