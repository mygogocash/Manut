import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SortableTaskCard } from "@/components/projects/task-card";
import type { Task } from "@/services/project.service";

// The desktop card's drag surface.
//
// Phase 7B established, from the installed bundle, why this needed changing:
// dnd-kit's PointerSensor aborts on `pointercancel`, and a draggable with the
// default `touch-action` is exactly what makes a touch browser fire one. With
// the whole card carrying the listeners there was nowhere to put
// `touch-action: none` that did not also stop the board scrolling.
//
// So the drag surface is now a dedicated grip. These tests pin the three
// properties that make that correct: only the grip drags, only the grip opts
// out of browser scrolling, and the grip is not nested in the control that
// opens the task.

vi.mock("@dnd-kit/sortable", async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>("@dnd-kit/sortable");
  return {
    ...actual,
    // The listeners are what dnd-kit would attach to the activator. Tagging
    // them lets a test assert WHERE they landed, which is the whole point.
    useSortable: () => ({
      attributes: { role: "button", "aria-roledescription": "sortable" },
      listeners: { onPointerDown: () => {}, "data-dnd-listener": "yes" },
      setNodeRef: () => {},
      setActivatorNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  };
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const task = {
  id: "t-1",
  title: "Reconcile settlement ledger",
  description: "<p>Blocked on the partner sandbox</p>",
  status: "todo",
  priority: "P0",
  assigneeName: "Priya Sharma",
  endDate: "2026-09-30T00:00:00.000Z",
} as any as Task;
/* eslint-enable @typescript-eslint/no-explicit-any */

const grip = () =>
  screen.getByRole("button", { name: /^Reorder task: Reconcile/i });
/** The opener's name starts with the title; the grip's starts with "Reorder". */
const opener = () =>
  screen.getByRole("button", { name: /^Reconcile settlement ledger/ });

describe("the drag activator", () => {
  it("exists as a named control rather than the whole card", () => {
    render(<SortableTaskCard task={task} onOpen={() => {}} />);
    expect(grip()).toBeInTheDocument();
  });

  it("is the only element carrying the drag listeners", () => {
    const { container } = render(
      <SortableTaskCard task={task} onOpen={() => {}} />,
    );
    const carriers = container.querySelectorAll("[data-dnd-listener]");
    expect(carriers).toHaveLength(1);
    expect(carriers[0]).toBe(grip());
  });

  it("opts out of browser scrolling, and nothing else does", () => {
    // `touch-none` on the card body would stop the board scrolling by touch —
    // trading one broken gesture for another.
    const { container } = render(
      <SortableTaskCard task={task} onOpen={() => {}} />,
    );
    const optedOut = container.querySelectorAll(".touch-none");
    expect(optedOut).toHaveLength(1);
    expect(optedOut[0]).toBe(grip());
  });

  it("is focusable and shows focus", () => {
    render(<SortableTaskCard task={task} onOpen={() => {}} />);
    const g = grip();
    g.focus();
    expect(g).toHaveFocus();
    expect(g.className).toMatch(/focus-visible:ring/);
  });

  it("names the task it would move, not just itself", () => {
    // One of these per card. "Drag handle" ×12 tells a screen-reader user
    // nothing about which card they are on.
    render(<SortableTaskCard task={task} onOpen={() => {}} />);
    expect(grip()).toHaveAccessibleName(
      "Reorder task: Reconcile settlement ledger",
    );
  });
});

describe("opening the task", () => {
  it("is its own control, so it works from the keyboard", () => {
    const onOpen = vi.fn();
    render(<SortableTaskCard task={task} onOpen={onOpen} />);
    expect(opener().tagName).toBe("BUTTON");
    fireEvent.click(opener());
    expect(onOpen).toHaveBeenCalledWith(task);
  });

  it("is a sibling of the grip, never its parent", () => {
    // Nesting them would make the grip un-activatable and the markup invalid.
    render(<SortableTaskCard task={task} onOpen={() => {}} />);
    const g = grip();
    expect(g.closest("button")).toBe(g);
    expect(opener().contains(g)).toBe(false);
    expect(g.contains(opener())).toBe(false);
  });

  it("does not open the task when the grip is used", () => {
    const onOpen = vi.fn();
    render(<SortableTaskCard task={task} onOpen={onOpen} />);
    fireEvent.click(grip());
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("the card still shows what it showed", () => {
  it("keeps title, description, priority, date and assignee", () => {
    render(<SortableTaskCard task={task} onOpen={() => {}} />);
    expect(screen.getByText("Reconcile settlement ledger")).toBeInTheDocument();
    expect(
      screen.getByText("Blocked on the partner sandbox"),
    ).toBeInTheDocument();
    expect(screen.getByText("P0-High")).toBeInTheDocument();
    // `formatDateShort` renders "30 Sep".
    expect(screen.getByText(/30 Sep/)).toBeInTheDocument();
    // Assignee is initials on the desktop card, by design.
    expect(screen.getByText("PS")).toBeInTheDocument();
  });
});
