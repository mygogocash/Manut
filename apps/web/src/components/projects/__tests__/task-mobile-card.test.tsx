import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskMobileCard } from "@/components/projects/task-mobile-card";
import type { Task } from "@/services/project.service";

// A task, as a card, below 1024px.
//
// The property under test is the same one every card in this programme has had
// to hold: the card and the thing it replaces show the SAME record. The desktop
// board card shows five things — title, description, priority, due date,
// assignee. If one of them fell out of this mapping, a person triaging on a
// phone would be deciding on less information than a person at a desk, without
// being told.

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
const task = {
  id: "t-1",
  title: "Reconcile settlement ledger",
  description: "<p>Blocked on the partner sandbox</p>",
  status: "in_progress",
  priority: "P0",
  endDate: "2026-09-30T00:00:00.000Z",
  // `getAssigneeName` reads `owner.name`, then `assigneeName` — there is no
  // `assignee` field on Task. Using the real shape is the point: a fixture that
  // invents fields tests the fixture, not the card.
  assigneeId: "u-1",
  assigneeName: "Priya Sharma",
} as any as Task;
/* eslint-enable @typescript-eslint/no-explicit-any */

const noop = () => {};

describe("what the card shows", () => {
  it("leads with the task title", () => {
    render(<TaskMobileCard task={task} onOpen={noop} />);
    expect(screen.getByText("Reconcile settlement ledger")).toBeInTheDocument();
  });

  it("renders the description as text, not stored HTML", () => {
    render(<TaskMobileCard task={task} onOpen={noop} />);
    expect(screen.getByText("Blocked on the partner sandbox")).toBeInTheDocument();
    expect(screen.queryByText(/<p>/)).not.toBeInTheDocument();
  });

  it("shows priority using the board's own vocabulary", () => {
    // Via `taskPriorityBadge` / `formatTaskPriority` from project-board-utils —
    // the same helpers the desktop card uses, so the two cannot disagree. The
    // module's vocabulary is "P0-High", not "High"; asserting the module's own
    // label is what makes this a real check.
    render(<TaskMobileCard task={task} onOpen={noop} />);
    expect(screen.getByText("P0-High")).toBeInTheDocument();
  });

  it("shows the assignee and the due date", () => {
    render(<TaskMobileCard task={task} onOpen={noop} />);
    expect(screen.getByText("Assignee")).toBeInTheDocument();
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("Due")).toBeInTheDocument();
  });

  it("accounts for everything the desktop card shows", () => {
    // The desktop card has exactly five things on it. None is behind an
    // expander here, so there should be nothing to expand.
    render(<TaskMobileCard task={task} onOpen={noop} />);
    expect(
      screen.queryByRole("button", { name: /show more/i }),
    ).not.toBeInTheDocument();
  });

  it("omits a field the task does not have rather than showing a blank", () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const bare = {
      ...task,
      endDate: null,
      assigneeName: null,
      owner: null,
    } as any as Task;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    render(<TaskMobileCard task={bare} onOpen={noop} />);
    expect(screen.queryByText("Due")).not.toBeInTheDocument();
    expect(screen.queryByText("Assignee")).not.toBeInTheDocument();
    expect(screen.getByText("Reconcile settlement ledger")).toBeInTheDocument();
  });

  it("wraps a long title instead of clipping it", () => {
    // The desktop card `truncate`s because it lives in a fixed 270px column.
    // A card is the only place the title appears before opening the task, so
    // clipping it here is how somebody taps the wrong one.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const long = { ...task, title: "A ".repeat(60) + "end" } as any as Task;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const { container } = render(<TaskMobileCard task={long} onOpen={noop} />);
    expect(container.querySelector(".break-anywhere")).not.toBeNull();
    expect(container.querySelector(".truncate")).toBeNull();
  });
});

describe("actions", () => {
  it("opens the task from the card body", () => {
    const onOpen = vi.fn();
    render(<TaskMobileCard task={task} onOpen={onOpen} />);
    fireEvent.click(screen.getByText("Reconcile settlement ledger"));
    expect(onOpen).toHaveBeenCalledWith(task);
  });

  it("offers Open and Move, both on the face of the card", () => {
    render(<TaskMobileCard task={task} onOpen={noop} onMove={noop} />);
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move" })).toBeInTheDocument();
    // Neither is behind an overflow menu.
    expect(
      screen.queryByRole("button", { name: /more actions/i }),
    ).not.toBeInTheDocument();
  });

  it("asks to move the task it belongs to", () => {
    const onMove = vi.fn();
    render(<TaskMobileCard task={task} onOpen={noop} onMove={onMove} />);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(onMove).toHaveBeenCalledWith(task);
  });

  it("omits Move entirely when the caller offers no move", () => {
    // A read-only board passes no handler; the card must not imply otherwise.
    render(<TaskMobileCard task={task} onOpen={noop} />);
    expect(screen.queryByRole("button", { name: "Move" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("keeps the action a real button, not nested in the card's own control", () => {
    render(<TaskMobileCard task={task} onOpen={noop} onMove={noop} />);
    const move = screen.getByRole("button", { name: "Move" });
    expect(move.tagName).toBe("BUTTON");
    expect(move.closest("button")).toBe(move);
  });
});
