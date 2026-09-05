import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectBoardPage from "@/app/(dashboard)/projects/[projectId]/page";

// The board, at both sides of 1024px.
//
// Phase 7B measured the reason for this split: five 270px columns are 1,414px
// of horizontal scroll, which shows about one column at a time on a phone, and
// a card cannot be dragged on touch at all. So below `lg` the page renders a
// status tab plus a card list, and the drag context is not rendered.
//
// What must stay true across that split: same data, same columns, same
// statuses, same endpoint. These tests exist mostly to prove the mobile branch
// did not become a second board with its own idea of any of that.

// dnd-kit is stubbed to passthroughs. Not to dodge a failure: `DndContext`
// throws under jsdom, and an unhandled error from it fails the whole vitest run
// even when every assertion passes. These tests are about WHICH branch the page
// renders and what the mobile branch does with the data — not about dnd-kit, so
// the library is replaced with the smallest shims that let the desktop tree
// mount. Real drag behaviour is a browser concern and is verified there.
vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dnd-context">{children}</div>
    ),
    DragOverlay: () => null,
    // Record which sensors the page registers. The keyboard one is the point:
    // board drag was mouse/pointer-only on every device before this.
    useSensor: (sensor: { name?: string }, opts: unknown) => {
      sensorCalls.push({ name: sensor?.name ?? String(sensor), opts });
      return {};
    },
    useSensors: (...s: unknown[]) => s,
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  };
});

vi.mock("@dnd-kit/sortable", async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>("@dnd-kit/sortable");
  return {
    ...actual,
    SortableContext: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      setActivatorNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  };
});

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u-owner" } }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "p-1" }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("nextjs-toploader/app", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const reorderTasks = vi.fn();
const getProject = vi.fn();
const getTimeline = vi.fn();
const sensorCalls: Array<{ name: string; opts: unknown }> = [];

vi.mock("@/services/project.service", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/services/project.service",
  );
  return {
    ...actual,
    getProject: (id: string) => getProject(id),
    getMilestones: () => Promise.resolve({ data: [] }),
    getTimeline: () => getTimeline(),
    reorderTasks: (...args: unknown[]) => reorderTasks(...args),
  };
});

vi.mock("@/services/directory.service", () => ({
  listAssignableUsers: () => Promise.resolve({ data: [] }),
}));

const COLUMNS = [
  { id: "c1", key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 0 },
  {
    id: "c2",
    key: "in_progress",
    label: "In Progress",
    color: "bg-amber-500",
    sortOrder: 1,
  },
  { id: "c3", key: "done", label: "Done", color: "bg-green-500", sortOrder: 2 },
];

const TASKS = [
  {
    id: "t-1",
    title: "Reconcile settlement ledger",
    description: null,
    status: "todo",
    priority: "P0",
    order: 0,
    assigneeId: null,
    assigneeName: "Priya Sharma",
    endDate: "2026-09-30T00:00:00.000Z",
    projectId: "p-1",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "t-2",
    title: "Draft the partner addendum",
    description: null,
    status: "todo",
    priority: "P1",
    order: 1,
    assigneeId: null,
    assigneeName: null,
    projectId: "p-1",
    createdAt: "2026-08-02T00:00:00.000Z",
  },
  {
    id: "t-3",
    title: "Ship the reconciliation job",
    description: null,
    status: "in_progress",
    priority: "P1",
    order: 0,
    assigneeId: null,
    assigneeName: null,
    projectId: "p-1",
    createdAt: "2026-08-03T00:00:00.000Z",
  },
];

/** Points `matchMedia` at a width so the layout hooks resolve. */
function setViewport(width: number) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      const min = /min-width:\s*(\d+)px/.exec(query);
      return {
        matches: max
          ? width <= Number(max[1])
          : min
            ? width >= Number(min[1])
            : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sensorCalls.length = 0;
  reorderTasks.mockResolvedValue({ data: { updated: 1 } });
  getTimeline.mockResolvedValue({
    data: {
      tasks: [
        { ...TASKS[0], startDate: "2026-09-01T00:00:00.000Z" },
        { ...TASKS[2], startDate: "2026-10-05T00:00:00.000Z" },
      ],
      milestones: [],
      dependencies: [],
    },
  });
  getProject.mockResolvedValue({
    data: {
      id: "p-1",
      name: "Partner wallet integration",
      description: "Settlement reconciliation",
      team: "general",
      owner: { id: "u-owner", name: "Owner", email: "o@x.com" },
      workflowStatus: "approved",
      columns: COLUMNS,
      tasks: TASKS,
      members: [],
      customFields: [],
    },
  });
});

/* ── The boundary ───────────────────────────────────────────────────── */

describe("which board renders", () => {
  it("is a status list at 1023px", async () => {
    setViewport(1023);
    render(<ProjectBoardPage />);
    expect(await screen.findByRole("tablist", { name: /task status/i }))
      .toBeInTheDocument();
  });

  it("is the column board at 1024px", async () => {
    // One pixel decides it, and `useIsBelow("lg")` queries max-width 1023.
    setViewport(1024);
    render(<ProjectBoardPage />);
    expect(await screen.findByTestId("dnd-context")).toBeInTheDocument();
    expect(
      screen.queryByRole("tablist", { name: /task status/i }),
    ).not.toBeInTheDocument();
  });

  it("is a status list on a phone", async () => {
    setViewport(390);
    render(<ProjectBoardPage />);
    expect(await screen.findByRole("tablist", { name: /task status/i }))
      .toBeInTheDocument();
  });

  it("is the column board on a desktop", async () => {
    setViewport(1440);
    render(<ProjectBoardPage />);
    await screen.findByTestId("dnd-context");
    expect(
      screen.queryByRole("tablist", { name: /task status/i }),
    ).not.toBeInTheDocument();
    // And no mobile-only control leaked into the desktop tree.
    expect(screen.queryByRole("button", { name: "Move" })).toBeNull();
  });

  it("does not render the drag context on a phone at all", async () => {
    // Rendering one there would offer a drag that cannot complete on touch.
    setViewport(390);
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    expect(screen.queryByTestId("dnd-context")).toBeNull();
  });
});

/* ── Status tabs ────────────────────────────────────────────────────── */

describe("the status strip", () => {
  beforeEach(() => setViewport(390));

  it("has one tab per board column, in board order", async () => {
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    const labels = screen.getAllByRole("tab").map((t) => t.textContent ?? "");
    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain("To Do");
    expect(labels[1]).toContain("In Progress");
    expect(labels[2]).toContain("Done");
  });

  it("counts tasks from the data already on screen", async () => {
    // Not a per-status request: `tasksByStatus` is the same map the columns use.
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]!.textContent).toContain("2");
    expect(tabs[1]!.textContent).toContain("1");
    expect(tabs[2]!.textContent).toContain("0");
  });

  it("opens on the board's first column", async () => {
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    expect(screen.getAllByRole("tab")[0]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Reconcile settlement ledger")).toBeInTheDocument();
    expect(screen.queryByText("Ship the reconciliation job")).toBeNull();
  });

  it("shows the selected status's tasks and only those", async () => {
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    fireEvent.click(screen.getByRole("tab", { name: /In Progress/ }));
    expect(screen.getByText("Ship the reconciliation job")).toBeInTheDocument();
    expect(screen.queryByText("Reconcile settlement ledger")).toBeNull();
  });

  it("says the status is empty rather than showing nothing", async () => {
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    fireEvent.click(screen.getByRole("tab", { name: /Done/ }));
    expect(screen.getByText(/nothing in this status/i)).toBeInTheDocument();
    expect(screen.getByText(/No tasks are in Done/i)).toBeInTheDocument();
  });

  it("does not refetch when the status changes", async () => {
    // Switching status is a filter over data already held, not a new request.
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    const before = getProject.mock.calls.length;
    fireEvent.click(screen.getByRole("tab", { name: /In Progress/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Done/ }));
    expect(getProject.mock.calls.length).toBe(before);
  });
});

/* ── Moving ─────────────────────────────────────────────────────────── */

describe("moving a task without dragging it", () => {
  beforeEach(() => setViewport(390));

  it("goes through the same endpoint the drag uses", async () => {
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });

    fireEvent.click(screen.getAllByRole("button", { name: "Move" })[0]!);
    fireEvent.click(
      await screen.findByRole("button", { name: /In Progress/ }),
    );

    await waitFor(() => expect(reorderTasks).toHaveBeenCalledTimes(1));
    const [projectId, orderedIds, status] = reorderTasks.mock.calls[0]!;
    expect(projectId).toBe("p-1");
    expect(status).toBe("in_progress");
    // Appended to the destination: the task already there, then the moved one.
    expect(orderedIds).toEqual(["t-3", "t-1"]);
  });

  it("moves the task into the destination status", async () => {
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    fireEvent.click(screen.getAllByRole("button", { name: "Move" })[0]!);
    fireEvent.click(
      await screen.findByRole("button", { name: /In Progress/ }),
    );
    await waitFor(() => expect(reorderTasks).toHaveBeenCalled());

    // The source tab drops to one, the destination rises to two.
    await waitFor(() => {
      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]!.textContent).toContain("1");
      expect(tabs[1]!.textContent).toContain("2");
    });
  });
});

/* ── Sensors ────────────────────────────────────────────────────────── */

describe("what can drive a drag", () => {
  it("registers a keyboard sensor alongside the pointer one", async () => {
    // Board drag has never been keyboard-operable, on any device. Both sensors
    // must be present, and only on the desktop branch.
    setViewport(1440);
    render(<ProjectBoardPage />);
    await screen.findByTestId("dnd-context");
    const names = sensorCalls.map((c) => c.name);
    expect(names).toContain("PointerSensor");
    expect(names).toContain("KeyboardSensor");
  });

  it("gives the keyboard sensor a sortable coordinate getter", async () => {
    // Without one the arrow keys move a fixed 25px, which means nothing
    // against 270px columns.
    setViewport(1440);
    render(<ProjectBoardPage />);
    await screen.findByTestId("dnd-context");
    const kb = sensorCalls.find((c) => c.name === "KeyboardSensor");
    expect(kb?.opts).toHaveProperty("coordinateGetter");
    expect(
      typeof (kb?.opts as { coordinateGetter?: unknown }).coordinateGetter,
    ).toBe("function");
  });

  it("keeps the pointer sensor's existing activation distance", async () => {
    setViewport(1440);
    render(<ProjectBoardPage />);
    await screen.findByTestId("dnd-context");
    const ptr = sensorCalls.find((c) => c.name === "PointerSensor");
    expect(ptr?.opts).toEqual({ activationConstraint: { distance: 8 } });
  });

  it("registers no sensors at all on a phone", async () => {
    // No DndContext below `lg`, so nothing should even be wired up.
    setViewport(390);
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    expect(screen.queryByTestId("dnd-context")).toBeNull();
  });
});

/* ── Timeline ───────────────────────────────────────────────────────── */

describe("the timeline branch", () => {
  it("is the read-only schedule list on a phone", async () => {
    setViewport(390);
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    fireEvent.click(screen.getByRole("button", { name: /timeline/i }));

    // Grouped by month, in date order — the chronology, not a chart. Matched
    // on the HEADING role: the Gantt also prints month labels, in its date
    // grid, so plain text is not a discriminator between the two.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "September 2026" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "October 2026" }),
    ).toBeInTheDocument();
    // And no drag affordance anywhere: the Gantt's reschedule gestures are
    // mouse-only, so a handle here could never work.
    expect(
      screen.queryByRole("button", { name: /reorder task/i }),
    ).not.toBeInTheDocument();
  });

  it("is the Gantt on a desktop", async () => {
    setViewport(1440);
    render(<ProjectBoardPage />);
    await screen.findByTestId("dnd-context");
    fireEvent.click(screen.getByRole("button", { name: /timeline/i }));
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    // The mobile chronology's month HEADINGS are absent. The Gantt does print
    // "September 2026" in its grid, which is why this is role-scoped.
    expect(
      screen.queryByRole("heading", { name: "September 2026" }),
    ).toBeNull();
  });

  it("does not refetch the project when the view is toggled", async () => {
    setViewport(390);
    render(<ProjectBoardPage />);
    await screen.findByRole("tablist", { name: /task status/i });
    const before = getProject.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /timeline/i }));
    await waitFor(() => expect(getTimeline).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /board/i }));
    expect(getProject.mock.calls.length).toBe(before);
  });
});
