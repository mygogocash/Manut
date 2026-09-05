import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimelineMobileList } from "@/components/projects/timeline-mobile-list";
import type { TimelineSnapshot } from "@/services/project.service";

// The project schedule below 1024px.
//
// The Gantt is not made responsive here, and that is the decision rather than a
// gap: its label pane is a non-shrinking 320px, so at 320px the chart gets zero
// pixels, and its reschedule gestures are wired to mouse events that a touch
// browser never fires during a drag. So this presentation is READ-ONLY, and the
// property most worth pinning is that it offers no gesture it cannot honour.

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

/* eslint-disable @typescript-eslint/no-explicit-any */
const snapshot = {
  tasks: [
    {
      id: "t-late",
      title: "Close the quarter",
      status: "todo",
      priority: "P1",
      startDate: "2026-11-02T00:00:00.000Z",
      endDate: "2026-11-20T00:00:00.000Z",
      milestoneId: "m-1",
    },
    {
      id: "t-early",
      title: "Reconcile settlement ledger",
      status: "in_progress",
      priority: "P0",
      startDate: "2026-09-01T00:00:00.000Z",
      endDate: "2026-09-30T00:00:00.000Z",
      milestoneId: null,
    },
    {
      id: "t-undated",
      title: "Backlog groom",
      status: "backlog",
      priority: "P2",
      startDate: null,
      endDate: null,
      milestoneId: null,
    },
  ],
  milestones: [{ id: "m-1", title: "Go live" }],
  dependencies: [],
} as any as TimelineSnapshot;
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("the schedule reads as a chronology", () => {
  it("groups by month, earliest first", () => {
    render(<TimelineMobileList snapshot={snapshot} />);
    const headings = screen
      .getAllByRole("heading")
      .map((h) => h.textContent?.trim());
    expect(headings).toEqual(["September 2026", "November 2026", "Not scheduled"]);
  });

  it("puts undated work last rather than dropping it", () => {
    render(<TimelineMobileList snapshot={snapshot} />);
    expect(screen.getByText("Backlog groom")).toBeInTheDocument();
  });

  it("shows each task's date range", () => {
    // Matched on shape rather than a literal: `formatDateShort` delegates to
    // `toLocaleDateString("en-GB")`, which abbreviates September as "Sept" —
    // four letters, unlike every other month. Hardcoding one month's quirk
    // makes the test about ICU rather than about the card.
    render(<TimelineMobileList snapshot={snapshot} />);
    // Both dated tasks carry a range; the undated one carries none.
    expect(
      screen.getAllByText(/^\d{2} \w{3,4} → \d{2} \w{3,4}$/),
    ).toHaveLength(2);
  });

  it("names the milestone a task belongs to", () => {
    // The Gantt conveys this by nesting rows under a milestone; a list has to
    // say it.
    render(<TimelineMobileList snapshot={snapshot} />);
    expect(screen.getByText("Milestone")).toBeInTheDocument();
    expect(screen.getByText("Go live")).toBeInTheDocument();
  });

  it("shows status for each task", () => {
    render(<TimelineMobileList snapshot={snapshot} />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});

describe("it offers no gesture it cannot honour", () => {
  it("renders no drag handle", () => {
    render(<TimelineMobileList snapshot={snapshot} />);
    expect(
      screen.queryByRole("button", { name: /reorder|drag|resize/i }),
    ).not.toBeInTheDocument();
  });

  it("opts nothing out of browser scrolling", () => {
    // `touch-none` here would only ever break scrolling, since nothing drags.
    const { container } = render(<TimelineMobileList snapshot={snapshot} />);
    expect(container.querySelectorAll(".touch-none")).toHaveLength(0);
  });

  it("opens the task rather than editing dates inline", () => {
    // Dates stay editable on a phone — through the task sheet, which is a form.
    const onTaskClick = vi.fn();
    render(
      <TimelineMobileList snapshot={snapshot} onTaskClick={onTaskClick} />,
    );
    fireEvent.click(screen.getByText("Reconcile settlement ledger"));
    expect(onTaskClick).toHaveBeenCalledWith("t-early");
  });

  it("is inert when the caller offers no handler", () => {
    render(<TimelineMobileList snapshot={snapshot} />);
    // No clickable title, so nothing implies an action that does not exist.
    expect(
      screen.queryByRole("button", { name: /^Reconcile settlement ledger/ }),
    ).not.toBeInTheDocument();
  });
});

describe("empty", () => {
  it("says nothing is scheduled instead of rendering an empty chart", () => {
    render(
      <TimelineMobileList
        snapshot={
          { tasks: [], milestones: [], dependencies: [] } as TimelineSnapshot
        }
      />,
    );
    expect(screen.getByText(/nothing scheduled yet/i)).toBeInTheDocument();
  });
});
