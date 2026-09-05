import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataTable } from "@/components/shared/data-table";

// The width-dependent half of the DataTable change.
//
// `data-table.test.tsx` covers the desktop path — the global test setup reports
// `matchMedia().matches === false`, so those 14 tests are already a regression
// guard proving the table still renders as a table. This file drives the query
// the other way and checks the card path, plus the one thing that must hold at
// both widths: the same rows, from the same data, with nothing dropped.

type Row = {
  id: string;
  name: string;
  owner: string;
  status: string;
  notes: string;
};

const ROWS: Row[] = [
  {
    id: "1",
    name: "Wallet integration",
    owner: "Priya",
    status: "Approved",
    notes: "Q4",
  },
  {
    id: "2",
    name: "Payroll import",
    owner: "Kunanon",
    status: "Pending",
    notes: "blocked",
  },
];

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "owner", header: "Owner" },
  { key: "status", header: "Status" },
  { key: "notes", header: "Notes" },
];

/** Points `matchMedia` at a viewport width so the component's hooks resolve. */
function setViewport(width: number) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      const min = /min-width:\s*(\d+)px/.exec(query);
      const matches = max
        ? width <= Number(max[1])
        : min
          ? width >= Number(min[1])
          : false;
      return {
        matches,
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

describe("DataTable at desktop width", () => {
  beforeEach(() => setViewport(1440));

  it("renders a real table, exactly as before", () => {
    render(<DataTable columns={COLUMNS} data={ROWS} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    // Column headers are a table-only affordance.
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });
});

describe("DataTable at mobile width", () => {
  beforeEach(() => setViewport(375));

  it("renders cards instead of a table", () => {
    render(<DataTable columns={COLUMNS} data={ROWS} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // Every row is still present — the representation changed, not the data.
    expect(screen.getByText("Wallet integration")).toBeInTheDocument();
    expect(screen.getByText("Payroll import")).toBeInTheDocument();
  });

  it("shows the scannable fields and hides the rest behind an expander", () => {
    render(<DataTable columns={COLUMNS} data={ROWS} />);
    // Derived roles: name = title, owner + status = visible fields.
    expect(screen.getAllByText("Owner").length).toBeGreaterThan(0);
    expect(screen.getByText("Priya")).toBeInTheDocument();
    // Notes is detail, so it is not rendered until the card is expanded.
    expect(screen.queryByText("Q4")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /show more/i })).toHaveLength(
      2,
    );
  });

  it("respects mobileMode=table for matrix-shaped data", () => {
    render(<DataTable columns={COLUMNS} data={ROWS} mobileMode="table" />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("uses a caller's own card when given one", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        renderMobileCard={(row) => <div>custom:{row.name}</div>}
      />,
    );
    expect(screen.getByText("custom:Wallet integration")).toBeInTheDocument();
  });

  it("still shows the empty message", () => {
    render(
      <DataTable columns={COLUMNS} data={[]} emptyMessage="No requests" />,
    );
    expect(screen.getByText("No requests")).toBeInTheDocument();
  });
});

/* ── The action column ──────────────────────────────────────────────── */
//
// Left to the derivation, an action column is indistinguishable from a data
// column: it becomes the third-or-later "field", which means it is rendered as
// a labelled value INSIDE the expander. For a row menu that is a nuisance; for
// an Approve button it is a defect, because the decision ends up one tap
// further away on a phone than it is on a desktop. Project Requests is the
// caller that made this matter.

const WITH_ACTIONS = [
  { key: "name", header: "Name", mobileRole: "title" as const },
  { key: "owner", header: "Owner", mobileRole: "field" as const },
  {
    key: "actions",
    header: "Actions",
    mobileRole: "actions" as const,
    render: () => <button type="button">Approve</button>,
  },
];

describe("an action column on a card", () => {
  beforeEach(() => setViewport(375));

  it("is reachable without expanding the card", () => {
    render(<DataTable columns={WITH_ACTIONS} data={ROWS} />);
    // Two rows, two Approve buttons, none of them behind a tap.
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(2);
  });

  it("is not also rendered as a labelled value", () => {
    render(<DataTable columns={WITH_ACTIONS} data={ROWS} />);
    // The header would appear as a field label if the column had fallen
    // through to the derivation.
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("leaves the card with nothing to expand when nothing else is left over", () => {
    render(<DataTable columns={WITH_ACTIONS} data={ROWS} />);
    expect(
      screen.queryByRole("button", { name: /show more/i }),
    ).not.toBeInTheDocument();
  });

  it("changes nothing for a table that does not declare one", () => {
    // The regression that matters for the ~75 tables that predate this: an
    // un-annotated action column keeps its existing (buried) placement rather
    // than silently moving, so no other module's card changes shape today.
    render(
      <DataTable
        columns={[...COLUMNS, { key: "actions", header: "Actions" }]}
        data={ROWS}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: /show more/i }).length,
    ).toBeGreaterThan(0);
  });
});

/* ── Migration safety ───────────────────────────────────────────────── */
//
// 49 of the 50 tables that define an action column currently bury it. Migrating
// one is meant to be a ONE-LINE change: add the role, touch nothing else. That
// is only true if annotating `actions` alone leaves every other column exactly
// where the derivation had already put it — otherwise each migration silently
// reshuffles a card and the change stops being reviewable.

describe("annotating only the action column", () => {
  beforeEach(() => setViewport(375));

  const PLAIN = [
    { key: "name", header: "Name" },
    { key: "owner", header: "Owner" },
    { key: "status", header: "Status" },
    { key: "notes", header: "Notes" },
    { key: "actions", header: "", render: () => <button type="button">Go</button> },
  ];
  const ANNOTATED = PLAIN.map((c) =>
    c.key === "actions" ? { ...c, mobileRole: "actions" as const } : c,
  );

  it("moves the actions out of the expansion and nowhere else", () => {
    const { unmount } = render(<DataTable columns={PLAIN} data={ROWS} />);
    // Before: Owner and Status are the two visible fields.
    expect(screen.getAllByText("Owner").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    unmount();

    render(<DataTable columns={ANNOTATED} data={ROWS} />);
    // After: identical placement for every data column.
    expect(screen.getAllByText("Owner").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    // And the control is now reachable without expanding.
    expect(screen.getAllByRole("button", { name: "Go" })).toHaveLength(2);
  });

  it("keeps the expansion for the columns that were already in it", () => {
    render(<DataTable columns={ANNOTATED} data={ROWS} />);
    fireEvent.click(screen.getAllByRole("button", { name: /show more/i })[0]!);
    expect(screen.getAllByText("Notes").length).toBeGreaterThan(0);
  });

  it("does not render an empty label for a headerless action column", () => {
    // These columns carry `header: ""` so the desktop table shows no heading.
    // Before the role existed that became a field with a blank label.
    const { container } = render(<DataTable columns={ANNOTATED} data={ROWS} />);
    const labels = [...container.querySelectorAll("dt, [class*='uppercase']")]
      .map((n) => n.textContent?.trim())
      .filter((t) => t !== undefined);
    expect(labels).not.toContain("");
  });
});

/* ── The opt-in card breakpoint ─────────────────────────────────────── */
//
// A nine-column queue needs roughly 1,100px. Between 768px and 1024px it stays a
// table scrolling sideways inside its own container: contained, but not
// readable. `cardBreakpoint` lets one table opt that span into cards WITHOUT
// moving the default for the ~75 tables that never ask.

describe("cardBreakpoint", () => {
  const COLS = [
    { key: "name", header: "Name" },
    { key: "owner", header: "Owner" },
  ];

  it("defaults to md, so an unconfigured table is a table at 900px", () => {
    // The whole safety argument for this phase rests on this assertion.
    setViewport(900);
    render(<DataTable columns={COLS} data={ROWS} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("defaults to md, so an unconfigured table is cards at 700px", () => {
    setViewport(700);
    render(<DataTable columns={COLS} data={ROWS} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders cards below an opted-in lg breakpoint", () => {
    setViewport(900);
    render(<DataTable columns={COLS} data={ROWS} cardBreakpoint="lg" />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Wallet integration")).toBeInTheDocument();
  });

  it("returns to a table exactly AT the opted-in breakpoint", () => {
    // 1024 is lg. The boundary is inclusive-at-the-top: `useIsBelow` queries
    // max-width 1023px, so 1024 is a table and 1023 is not.
    setViewport(1024);
    render(<DataTable columns={COLS} data={ROWS} cardBreakpoint="lg" />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("is still a card one pixel below the boundary", () => {
    setViewport(1023);
    render(<DataTable columns={COLS} data={ROWS} cardBreakpoint="lg" />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("does not override an explicit mobileMode, which is absolute", () => {
    // `mobileMode` answers WHETHER, `cardBreakpoint` answers WHERE. A caller
    // that has said "always a table" must not be overruled by a width.
    setViewport(320);
    render(
      <DataTable
        columns={COLS}
        data={ROWS}
        mobileMode="table"
        cardBreakpoint="lg"
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("keeps the same column mapping at the wider breakpoint", () => {
    // The breakpoint moves WHERE the switch happens, never WHAT a card shows.
    setViewport(900);
    render(
      <DataTable
        columns={[...COLS, { key: "status", header: "Status" }]}
        data={ROWS}
        cardBreakpoint="lg"
      />,
    );
    expect(screen.getAllByText("Owner").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
  });
});

/* ── Interaction boundaries ─────────────────────────────────────────── */
//
// A card can carry three separate gestures at once: open the record, expand it,
// and act on it. If those bleed into each other, tapping Approve navigates
// away, or tapping Show more approves something. `RecordCard` avoids this
// structurally — the root is a plain div and each gesture owns its own
// element — so no `stopPropagation` is needed anywhere. These tests exist to
// keep it that way, because the usual fix for the symptom is to reach for
// stopPropagation and paper over a nesting mistake.

describe("the three gestures on a card stay separate", () => {
  beforeEach(() => setViewport(375));

  const build = (onAct: () => void) => [
    { key: "name", header: "Name" },
    { key: "owner", header: "Owner" },
    { key: "status", header: "Status" },
    { key: "notes", header: "Notes" },
    {
      key: "actions",
      header: "",
      mobileRole: "actions" as const,
      render: () => (
        <button type="button" onClick={onAct}>
          Approve
        </button>
      ),
    },
  ];

  it("acting does not open the record", () => {
    const onAct = vi.fn();
    const onRowClick = vi.fn();
    render(
      <DataTable columns={build(onAct)} data={ROWS} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]!);
    expect(onAct).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("acting does not expand the card", () => {
    const onAct = vi.fn();
    render(<DataTable columns={build(onAct)} data={ROWS} />);
    const expander = screen.getAllByRole("button", { name: /show more/i })[0]!;
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]!);
    expect(expander).toHaveAttribute("aria-expanded", "false");
  });

  it("expanding does not act", () => {
    const onAct = vi.fn();
    render(<DataTable columns={build(onAct)} data={ROWS} />);
    fireEvent.click(screen.getAllByRole("button", { name: /show more/i })[0]!);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("expanding does not open the record", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={build(() => {})}
        data={ROWS}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /show more/i })[0]!);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("opening the record does not act", () => {
    const onAct = vi.fn();
    const onRowClick = vi.fn();
    render(
      <DataTable columns={build(onAct)} data={ROWS} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getAllByText("Wallet integration")[0]!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("keeps an action button a button, and each gesture separately focusable", () => {
    render(<DataTable columns={build(() => {})} data={ROWS} onRowClick={() => {}} />);
    const act = screen.getAllByRole("button", { name: "Approve" })[0]!;
    expect(act.tagName).toBe("BUTTON");
    // Not nested inside the card-open control, which would be an invalid
    // interactive-in-interactive nesting and a real focus-order problem.
    expect(act.closest("button")).toBe(act);
  });
});

/* ── Selection, states and hostile content in card mode ─────────────── */

describe("card mode leaves the rest of the table's behaviour alone", () => {
  beforeEach(() => setViewport(375));

  const COLS = [
    { key: "name", header: "Name" },
    { key: "owner", header: "Owner" },
  ];

  it("still offers row selection, without it opening or expanding the row", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={COLS}
        data={ROWS}
        enableRowSelection
        onRowClick={onRowClick}
      />,
    );
    const boxes = screen.getAllByRole("checkbox", { name: /select row/i });
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[0]!);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("shows skeletons rather than an empty message while loading", () => {
    const { container } = render(
      <DataTable columns={COLS} data={[]} loading emptyMessage="No records" />,
    );
    expect(screen.queryByText("No records")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length)
      .toBeGreaterThan(0);
  });

  it("renders the caller's pagination in card mode too", () => {
    render(
      <DataTable
        columns={COLS}
        data={ROWS}
        pagination={<div>pager</div>}
      />,
    );
    expect(screen.getByText("pager")).toBeInTheDocument();
  });

  it("survives hostile content without stretching the page", () => {
    const nasty = [
      {
        id: "x",
        name: "A".repeat(120),
        owner: "https://intranet.example.com/a/very/long/path?query=" + "z".repeat(80),
        status: "123456789012345678",
        notes: "",
      },
    ];
    const { container } = render(<DataTable columns={COLS} data={nasty} />);
    // `break-anywhere` on the heading is what makes an unbroken string wrap.
    const heading = screen.getByText("A".repeat(120));
    expect(heading.className).toMatch(/break-anywhere/);
    // Nothing is min-width:auto-locked open, which is what pushes a page wide.
    expect(container.querySelector('[class*="min-w-0"]')).not.toBeNull();
  });

  it("renders an empty value without inventing content", () => {
    render(
      <DataTable
        columns={COLS}
        data={[{ id: "y", name: "Row", owner: "" }]}
      />,
    );
    expect(screen.getByText("Row")).toBeInTheDocument();
  });
});
