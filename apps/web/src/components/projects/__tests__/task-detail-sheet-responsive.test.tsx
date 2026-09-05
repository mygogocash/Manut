import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskDetailSheet } from "@/components/projects/task-detail-sheet";
import type {
  ProjectColumn,
  ProjectMember,
  Task,
} from "@/services/project.service";

// The responsive contract of the task detail sheet.
//
// A note on instrument choice. jsdom computes no layout, so the defects this
// phase fixed — a sheet rendering at 75% width, a 275px content column, a 28px
// close button — cannot be caught here by measuring anything. They were found
// and verified in a real browser, and the measurements are in PHASE_8.
//
// What these tests protect is narrower and still worth having: the specific
// class contracts that produce those geometries, each of which was silently
// wrong before and would be silently wrong again if someone "tidied" them.
// Where a behaviour IS observable in jsdom, it is asserted as behaviour.

vi.mock("@/services/project.service", async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>("@/services/project.service");
  return {
    ...actual,
    getTaskDetail: () => Promise.resolve({ data: null }),
  };
});

vi.mock("@/services/upload.service", () => ({
  uploadFile: () => Promise.resolve({ url: "", path: "" }),
}));

const COLUMNS: ProjectColumn[] = [
  { id: "c1", key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 0 },
  {
    id: "c2",
    key: "in_progress",
    label: "In Progress",
    color: "bg-amber-500",
    sortOrder: 1,
  },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
const MEMBERS = [
  { id: "pm-1", user: { id: "u-1", name: "Priya Sharma", email: "p@x.com" } },
] as any as ProjectMember[];

const task = {
  id: "11111111-2222-4333-8444-555555555555",
  title: "Reconcile settlement ledger",
  description: "Blocked on the partner sandbox",
  status: "in_progress",
  priority: "P0",
  order: 0,
  assigneeId: "u-1",
  assigneeName: "Priya Sharma",
  projectId: "p-1",
  createdAt: "2026-08-01T00:00:00.000Z",
} as any as Task;
/* eslint-enable @typescript-eslint/no-explicit-any */

function renderSheet(over: Record<string, unknown> = {}) {
  return render(
    <TaskDetailSheet
      task={task}
      open
      onOpenChange={() => {}}
      onUpdate={() => {}}
      onDelete={() => {}}
      projectId="p-1"
      projectName="Partner wallet integration"
      columns={COLUMNS}
      members={MEMBERS}
      assignableUsers={[]}
      {...over}
    />,
  );
}

/**
 * Renders and waits for the detail fetch to settle.
 *
 * The sheet sets `detailLoading` synchronously in an effect, so its first paint
 * is the spinner branch and `aside` does not exist yet. Querying before this
 * resolves is what made four of these fail on the first run.
 */
async function renderSettled(over: Record<string, unknown> = {}) {
  const r = renderSheet(over);
  await waitFor(() => expect(r.baseElement.querySelector("aside")).toBeTruthy());
  return r;
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("the sheet renders its task", () => {
  it("falls back to the passed task when the detail fetch returns nothing", async () => {
    // `effectiveTask = detail?.task ?? task`. Worth pinning: it is what keeps
    // the sheet usable on a flaky connection instead of showing an empty shell.
    const { baseElement } = await renderSettled();
    expect(baseElement.textContent).toContain("Reconcile settlement ledger");
  });

  it("has an accessible name", () => {
    renderSheet();
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/task details/i);
  });
});

describe("sheet geometry contract", () => {
  const content = (c: HTMLElement) =>
    c.querySelector('[data-slot="sheet-content"]') as HTMLElement;

  it("forces full width below lg, overriding the primitive", () => {
    // The Sheet primitive sets `data-[side=right]:w-3/4`. An attribute-prefixed
    // utility outranks a plain `w-full` however the classes are ordered, so the
    // sheet rendered at 75% — measured 292.5px at 390px, and a 275px content
    // column at 768px. The `!` is what beats it; dropping it silently restores
    // the defect, which is why this is asserted.
    const { baseElement } = renderSheet();
    expect(content(baseElement).className).toContain("max-lg:w-full!");
  });

  it("keeps the desktop max-width cap untouched", () => {
    const { baseElement } = renderSheet();
    expect(content(baseElement).className).toContain(
      "sm:max-w-[min(1080px,calc(100vw-24px))]!",
    );
  });

  it("raises the close button to 44px below md only", () => {
    // The close is 28px, and it comes from the shared primitive. Scoped here so
    // no other sheet in the app changes size.
    const { baseElement } = renderSheet();
    expect(content(baseElement).className).toContain(
      "max-md:[&_[data-slot=sheet-close]]:size-11",
    );
  });
});

describe("scroll ownership", () => {
  it("gives the sheet body the scroll below md, and main the scroll above", async () => {
    // Before: main owned the only scroller while the metadata rail sat below it
    // as `shrink-0` inside an `overflow-hidden` sheet, so the two competed for a
    // fixed height — 381px of rail against 426px of main for 1,815px of
    // content, with no way to push the metadata out of the way.
    const { baseElement } = await renderSettled();
    const aside = baseElement.querySelector("aside")!;
    const main = aside.previousElementSibling!;
    const body = main.parentElement!;

    // One column that scrolls on mobile; a row of two panes on desktop.
    expect(body.className).toContain("overflow-y-auto");
    expect(body.className).toContain("md:overflow-hidden");
    expect(body.className).toContain("md:flex-row");

    // Main only becomes a scroller at md, so on mobile there is exactly one.
    expect(main.className).toContain("md:overflow-y-auto");
    expect(main.className).not.toMatch(/(^|\s)overflow-y-auto(\s|$)/);
  });

  it("keeps the rail a 300px sidebar at md and full width below", async () => {
    const { baseElement } = await renderSettled();
    const aside = baseElement.querySelector("aside")!;
    expect(aside.className).toContain("w-full");
    expect(aside.className).toContain("md:w-[300px]");
  });
});

describe("mobile text entry", () => {
  it("keeps every visible text field at 16px on mobile", async () => {
    // iOS Safari zooms the page when a focused input or textarea is under 16px
    // and does not zoom back out. Five fields carried 13px. `md:` preserves the
    // desktop 13px exactly.
    const { baseElement } = await renderSettled();

    const fields = [
      ...baseElement.querySelectorAll<HTMLElement>("input, textarea"),
    ].filter((el) => !el.classList.contains("hidden"));

    expect(fields.length).toBeGreaterThan(0);
    for (const el of fields) {
      const cls = el.className.split(/\s+/);
      // An unprefixed small size is the defect; `md:`-prefixed is desktop.
      expect(cls, `${el.tagName} is under 16px on mobile`).not.toContain(
        "text-[13px]",
      );
      expect(cls).not.toContain("text-sm");
      expect(cls).not.toContain("text-xs");
    }
  });

  it("does not raise the hidden file input, which cannot be focused", async () => {
    // It is `display:none` and opened programmatically, so it can never trigger
    // a zoom. Recorded so a future sweep does not "fix" it and think it mattered.
    const { baseElement } = await renderSettled();
    const file = baseElement.querySelector('input[type="file"]');
    expect(file).not.toBeNull();
    expect(file!.className).toContain("hidden");
  });
});
