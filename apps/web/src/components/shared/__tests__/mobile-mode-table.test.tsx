import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "@/components/shared/data-table";
import { TableCell, TableRow } from "@/components/ui/table";

// Phase 8C — when a table must stay a table.
//
// `mobileMode="table"` shipped with `DataTable` and had no production consumer.
// Two tables needed it, for two different reasons, and both were measured on
// WebKit before anything changed:
//
//   payroll-run-detail-sheet (19 columns)
//     As cards at 390px: 0 of 12 financial values visible without expanding, an
//     expanded card 645px tall carrying 19 labelled rows, and the run totals row
//     absent. As a table: 12/12 visible, totals present, 2781px scrolling inside
//     a 356px container, page overflow 0, sticky header aligned after a 400px
//     horizontal scroll.
//
//   fixed-asset-depreciation-run-panel (3 columns)
//     Nothing to do with width. `footer` is rendered inside the <Table> element,
//     so the CARD PATH NEVER RENDERS IT — and this table's footer is the run's
//     total depreciation charge. Measured at 320px: cards totals=MISSING, table
//     totals=YES.
//
// The second reason generalises, so it is enforced as an invariant below.

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

type Slip = {
  id: string;
  employee: string;
  baseSalary: string;
  ded_tax: string;
  total_thb: string;
};

const SLIPS: Slip[] = [
  {
    id: "1",
    employee: "Kunanon Chirathivat-Wongsawat",
    baseSalary: "9,999,999,999.00",
    ded_tax: "-1,899,999.50",
    total_thb: "9,999,999,999,999.00",
  },
];

const SLIP_COLUMNS = [
  { key: "employee", header: "Employee Name" },
  { key: "baseSalary", header: "Salary (fiat)" },
  { key: "ded_tax", header: "Tax" },
  { key: "total_thb", header: "Total Payout THB" },
  {
    key: "actions",
    header: "",
    mobileRole: "actions" as const,
    render: () => <button type="button">Edit</button>,
  },
];

const TOTALS = (
  <TableRow>
    <TableCell>Run totals</TableCell>
    <TableCell>9,999,999,999.00</TableCell>
    <TableCell>-1,899,999.50</TableCell>
    <TableCell>9,999,999,999,999.00</TableCell>
    <TableCell />
  </TableRow>
);

describe("mobileMode=table keeps a matrix a matrix", () => {
  it("renders a table at 320px instead of cards", () => {
    setViewport(320);
    render(
      <DataTable data={SLIPS} columns={SLIP_COLUMNS} mobileMode="table" />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows every financial value at 320px without expanding", () => {
    setViewport(320);
    render(
      <DataTable data={SLIPS} columns={SLIP_COLUMNS} mobileMode="table" />,
    );
    for (const v of ["9,999,999,999.00", "-1,899,999.50", "9,999,999,999,999.00"]) {
      expect(screen.getByText(v)).toBeInTheDocument();
    }
  });

  it("keeps the totals row at 320px", () => {
    setViewport(320);
    const { container } = render(
      <DataTable
        data={SLIPS}
        columns={SLIP_COLUMNS}
        footer={TOTALS}
        mobileMode="table"
      />,
    );
    const foot = container.querySelector("tfoot");
    expect(foot).not.toBeNull();
    expect(within(foot as HTMLElement).getByText("Run totals")).toBeInTheDocument();
  });

  it("keeps the row action reachable at 320px", () => {
    setViewport(320);
    render(
      <DataTable data={SLIPS} columns={SLIP_COLUMNS} mobileMode="table" />,
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("documents the defect: card mode drops the totals row entirely", () => {
    // Not a tautology — this is the measured information loss that decided the
    // depreciation panel. The footer is not behind the expander; it is absent.
    setViewport(320);
    const { container } = render(
      <DataTable data={SLIPS} columns={SLIP_COLUMNS} footer={TOTALS} />,
    );
    expect(container.querySelector("table")).toBeNull(); // cards
    expect(container.querySelector("tfoot")).toBeNull(); // totals gone
    expect(screen.queryByText("Run totals")).toBeNull();
  });

  it("leaves desktop identical whichever mode is asked for", () => {
    setViewport(1280);
    const auto = render(
      <DataTable data={SLIPS} columns={SLIP_COLUMNS} footer={TOTALS} />,
    );
    const autoHtml = auto.container.innerHTML;
    auto.unmount();

    const forced = render(
      <DataTable
        data={SLIPS}
        columns={SLIP_COLUMNS}
        footer={TOTALS}
        mobileMode="table"
      />,
    );
    expect(forced.container.innerHTML).toBe(autoHtml);
  });
});

/* -------------------------------------------------------------------------- */
/* The invariant: a totals row implies table mode                             */
/* -------------------------------------------------------------------------- */

const SRC = resolve(__dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(p, out);
    } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
}

/** The opening `<DataTable …>` tags in a file, brace-aware. */
function dataTableTags(source: string): string[] {
  const tags: string[] = [];
  const re = /<DataTable\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
    }
    tags.push(source.slice(m.index, i));
  }
  return tags;
}

describe("a table with a totals row is never rendered as cards", () => {
  const offenders: string[] = [];
  let withFooter = 0;

  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("components/shared/data-table")) continue;
    for (const tag of dataTableTags(source)) {
      if (!/\bfooter=/.test(tag)) continue;
      withFooter++;
      if (!/mobileMode=["{]?["']?table/.test(tag)) {
        offenders.push(file.slice(SRC.length + 1).replace(/\\/g, "/"));
      }
    }
  }

  it("finds the footered tables it is meant to be guarding", () => {
    // Guards the guard. Two at the time of writing: the payroll payslip grid
    // and the fixed-asset depreciation run.
    expect(withFooter).toBeGreaterThanOrEqual(2);
  });

  it("gives every footered table mobileMode=table", () => {
    expect(
      offenders,
      `these pass a \`footer\` (a totals row) but render as cards below 768px, ` +
        `and the card path does not render \`footer\` at all — so the totals ` +
        `silently disappear on a phone. Add mobileMode="table", or move the ` +
        `total somewhere the card path renders:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
