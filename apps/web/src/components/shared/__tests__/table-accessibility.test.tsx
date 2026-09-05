import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { blankHeaderLabel, DataTable } from "@/components/shared/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Phase 8D — the three shared-table accessibility fixes.
//
// All three were measured on WebKit before being written, because two of them
// could have been wrong in a way that only shows up on a real device:
//
//   Action target — a table row is 46-47px and consecutive rows' controls sit
//     23px apart, so a 44px HIT AREA fits inside a row without any row getting
//     taller and without two targets ever overlapping. Verified by clicking 8px
//     above and 8px below a control: both landed on that control, never a
//     neighbour. The painted button stays 24px.
//
//   Scroll region — making every container focusable would add a tab stop to all
//     ~93 tables, so it is added only while the table is actually wider than its
//     container. Measured at 390px: 4 containers, 3 scrolling, 3 focusable.
//
//   Accessible name — `DataTable` always rendered the title as a visible <h3>;
//     it was simply never announced as the table's name. axe on the table
//     surface, light and dark, mobile and desktop: 1 violation → 0.
//
// jsdom cannot measure layout, so hit-area size, scroll thresholds and tab-stop
// counts are asserted in the browser probe. What is asserted here is everything
// structural: the wiring, the labels, and the conditions.

type Row = { id: string; ref: string; amount: string };
const ROWS: Row[] = [{ id: "1", ref: "INV-1", amount: "1,000.00" }];
const COLUMNS = [
  { key: "ref", header: "Reference" },
  { key: "amount", header: "Amount" },
  {
    key: "actions",
    header: "",
    mobileRole: "actions" as const,
    render: () => <button type="button">Edit</button>,
  },
];

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

/** jsdom reports 0 for both, so the overflow threshold has to be simulated. */
function stubWidths(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      return this.dataset?.slot === "table-container" ? scrollWidth : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return this.dataset?.slot === "table-container" ? clientWidth : 0;
    },
  });
}

// `src/test/setup.ts` already provides a ResizeObserver stub, so none is added
// here. Its `observe` is a no-op, which is fine: `Table` measures once
// synchronously on mount before it ever creates the observer.

afterEach(() => {
  for (const p of ["scrollWidth", "clientWidth"]) {
    Object.defineProperty(HTMLElement.prototype, p, {
      configurable: true,
      get() {
        return 0;
      },
    });
  }
});

/* -------------------------------------------------------------------------- */
/* 1. Accessible name                                                         */
/* -------------------------------------------------------------------------- */

describe("a table is named by the heading the user can already see", () => {
  it("points aria-labelledby at the visible title", () => {
    setViewport(1280);
    render(<DataTable data={ROWS} columns={COLUMNS} title="Payslips" />);

    const table = screen.getByRole("table");
    const id = table.getAttribute("aria-labelledby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)?.textContent).toBe("Payslips");
  });

  it("does not invent a name when there is no title", () => {
    setViewport(1280);
    render(<DataTable data={ROWS} columns={COLUMNS} />);

    const table = screen.getByRole("table");
    expect(table.getAttribute("aria-labelledby")).toBeNull();
    expect(table.getAttribute("aria-label")).toBeNull();
  });

  it("accepts an explicit ariaLabel for a table with no visible title", () => {
    setViewport(1280);
    render(<DataTable data={ROWS} columns={COLUMNS} ariaLabel="Open invoices" />);
    expect(screen.getByRole("table")).toHaveAttribute(
      "aria-label",
      "Open invoices",
    );
  });

  it("prefers the visible title over ariaLabel rather than naming it twice", () => {
    setViewport(1280);
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        title="Payslips"
        ariaLabel="Something else"
      />,
    );
    const table = screen.getByRole("table");
    expect(table.getAttribute("aria-labelledby")).toBeTruthy();
    expect(table.getAttribute("aria-label")).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Blank header labels                                                     */
/* -------------------------------------------------------------------------- */

describe("a deliberately blank header still has a name", () => {
  it("labels the actions column for a screen reader", () => {
    setViewport(1280);
    render(<DataTable data={ROWS} columns={COLUMNS} title="Invoices" />);
    // axe `empty-table-header`: the visible header stays empty, the name does not
    expect(
      screen.getByRole("columnheader", { name: "Actions" }),
    ).toBeInTheDocument();
  });

  it("uses mobileLabel when the caller supplied one", () => {
    setViewport(1280);
    render(
      <DataTable
        data={ROWS}
        columns={[
          { key: "ref", header: "Reference" },
          { key: "complete", header: "", mobileLabel: "Done" },
        ]}
        title="Tasks"
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "Done" }),
    ).toBeInTheDocument();
  });

  it("humanises the key as a last resort", () => {
    expect(blankHeaderLabel({ key: "actions", header: "" })).toBe("Actions");
    expect(blankHeaderLabel({ key: "rowNo", header: "" })).toBe("Row No");
    expect(blankHeaderLabel({ key: "last_seen", header: "" })).toBe("Last seen");
    expect(blankHeaderLabel({ key: "x", header: "", mobileLabel: "Pick" })).toBe(
      "Pick",
    );
  });

  it("leaves a real header alone", () => {
    setViewport(1280);
    render(<DataTable data={ROWS} columns={COLUMNS} title="Invoices" />);
    expect(
      screen.getByRole("columnheader", { name: "Reference" }),
    ).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Scroll region                                                           */
/* -------------------------------------------------------------------------- */

const SIMPLE = (
  <Table aria-label="Payslips">
    <TableHeader>
      <TableRow>
        <TableHead>Reference</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>INV-1</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

describe("the scroll region takes focus only when it scrolls", () => {
  it("adds no tab stop when the table fits", () => {
    stubWidths(300, 300);
    const { container } = render(SIMPLE);
    const region = container.querySelector('[data-slot="table-container"]');

    expect(region?.getAttribute("tabindex")).toBeNull();
    expect(region?.getAttribute("role")).toBeNull();
    expect(region?.getAttribute("data-scrollable")).toBeNull();
  });

  it("becomes a focusable named region when the table overflows", () => {
    stubWidths(1200, 300);
    const { container } = render(SIMPLE);
    const region = container.querySelector('[data-slot="table-container"]');

    expect(region?.getAttribute("tabindex")).toBe("0");
    expect(region?.getAttribute("role")).toBe("region");
    expect(region?.getAttribute("aria-label")).toBe("Payslips");
    expect(region?.getAttribute("data-scrollable")).toBe("true");
  });

  it("borrows aria-labelledby rather than duplicating a label", () => {
    stubWidths(1200, 300);
    const { container } = render(
      <>
        <h3 id="tbl-heading">Payslips</h3>
        <Table aria-labelledby="tbl-heading">
          <TableBody>
            <TableRow>
              <TableCell>INV-1</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </>,
    );
    const region = container.querySelector('[data-slot="table-container"]');
    expect(region?.getAttribute("aria-labelledby")).toBe("tbl-heading");
    expect(region?.getAttribute("aria-label")).toBeNull();
  });

  it("is focusable but claims no landmark when the table has no name", () => {
    // `role="region"` without an accessible name is itself a violation, so an
    // unnamed scrolling table is made scrollable without pretending to be one.
    stubWidths(1200, 300);
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>INV-1</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const region = container.querySelector('[data-slot="table-container"]');
    expect(region?.getAttribute("tabindex")).toBe("0");
    expect(region?.getAttribute("role")).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Semantics that must not regress                                         */
/* -------------------------------------------------------------------------- */

describe("native table semantics are preserved", () => {
  it("keeps scope=col on every column header", () => {
    setViewport(1280);
    render(<DataTable data={ROWS} columns={COLUMNS} title="Invoices" />);
    const heads = screen.getAllByRole("columnheader");
    expect(heads.length).toBe(3);
    for (const th of heads) expect(th).toHaveAttribute("scope", "col");
  });

  it("still renders the mobile card path below the breakpoint", () => {
    setViewport(375);
    render(<DataTable data={ROWS} columns={COLUMNS} title="Invoices" />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("grows the hit area of a control in a cell without resizing it", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <TableCell>
              <button type="button">Edit</button>
            </TableCell>
          </tr>
        </tbody>
      </table>,
    );
    const cell = container.querySelector('[data-slot="table-cell"]');
    // the overlay is a max-md rule, so desktop is untouched; measured size is
    // asserted in the browser probe, presence of the rule here
    expect(cell?.className).toContain("max-md:[&_button]:after:h-11");
    expect(cell?.className).toContain("max-md:[&_button]:relative");
  });
});
