import { describe, expect, it } from "vitest";

import {
  buildTerminalTaskKeys,
  isTerminalTaskStatus,
  TASK_TERMINAL_ALIASES,
} from "@/modules/crm-shared/crm-task-terminal";

describe("buildTerminalTaskKeys", () => {
  it("always includes the hardcoded done/completed aliases", () => {
    const keys = buildTerminalTaskKeys([]);
    for (const alias of TASK_TERMINAL_ALIASES) {
      expect(keys.has(alias)).toBe(true);
    }
  });

  it("treats the rightmost column as terminal (custom Done key)", () => {
    const keys = buildTerminalTaskKeys([
      { key: "todo", label: "To Do", sortOrder: 0 },
      { key: "doing", label: "In Progress", sortOrder: 1 },
      { key: "finished", label: "Ship It", sortOrder: 2 },
    ]);
    expect(keys.has("finished")).toBe(true);
    expect(keys.has("doing")).toBe(false);
    expect(isTerminalTaskStatus("finished", keys)).toBe(true);
    expect(isTerminalTaskStatus("doing", keys)).toBe(false);
  });

  it("treats a Done-labelled column as terminal even when not last", () => {
    // Rare layout: Done then Archive — both should stop reminders.
    const keys = buildTerminalTaskKeys([
      { key: "todo", label: "To Do", sortOrder: 0 },
      { key: "shipped", label: "Done", sortOrder: 1 },
      { key: "archive", label: "Archive", sortOrder: 2 },
    ]);
    expect(keys.has("shipped")).toBe(true);
    expect(keys.has("archive")).toBe(true);
  });

  it("matches completed / closed labels case-insensitively", () => {
    const keys = buildTerminalTaskKeys([
      { key: "open", label: "Open", sortOrder: 0 },
      { key: "wrap", label: "COMPLETED", sortOrder: 1 },
    ]);
    expect(keys.has("wrap")).toBe(true);
  });
});
