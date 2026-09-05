import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable, deriveMobileRoles } from "@/components/shared/data-table";

// Phase 8B -- the card must carry the information the table exists to support.
//
// `deriveMobileRoles` titles a card with the FIRST column and promotes the next
// two, putting everything else behind the expander. Business tables here order
// their columns `identifier, descriptor, descriptor, amount, dates, status`, so
// the default reliably surfaced the least useful columns and buried the amount,
// the deadline and the status. Measured on WebKit at 320/390/430 before the
// change: a payroll-invoice card showed the reference and two descriptors, with
// all three money columns and the status absent.
//
// Worse, five tables opened with a checkbox, a chevron or a row number, so the
// card was headed by a control -- `head=""` and `head="1"` in the same run.
//
// Both are asserted here: the per-table expectations below, and the invariant
// that no card is ever titled by table chrome.

const SRC = resolve(__dirname, "../../..");

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

/* -------------------------------------------------------------------------- */
/* Source parsing                                                             */
/* -------------------------------------------------------------------------- */

// Three details here are load-bearing, each learned by getting it wrong first:
//   `\r?`            -- 24 of the 74 consumers are CRLF; without it a third of
//                       the columns are invisible and the audit reads clean.
//   no `^` anchor    -- single-line objects `{ key: "x", header: "y" }` exist.
//   role searched in
//   the key's slice  -- `mobileRole: "x" as const,` does not have to sit on the
//                       line straight after `key:`.
const KEY = /\bkey:\s*"([a-zA-Z0-9_.]+)"\s*,/g;
const ROLE = /mobileRole:\s*"(\w+)"/;
const BOUND =
  /(?:const\s+\w+\s*(?::[^=]*)?=\s*(?:useMemo\(\s*\([^)]*\)\s*=>\s*)?\[)|(?:columns=\{\[)/g;

type ParsedColumn = { key: string; header: string; mobileRole?: string };

/** The column arrays declared in a file, in source order. */
function columnArrays(source: string): ParsedColumn[][] {
  const hits = [...source.matchAll(KEY)];
  if (hits.length === 0) return [];
  const bounds = [...source.matchAll(BOUND)].map((m) => m.index ?? 0);

  const parsed: { at: number; col: ParsedColumn }[] = hits.map((m, i) => {
    const at = m.index ?? 0;
    const end = i + 1 < hits.length ? (hits[i + 1].index ?? 0) : at + 4000;
    const slice = source.slice(at, end);
    return {
      at,
      col: {
        key: m[1],
        header: /header:\s*"([^"]*)"/.exec(slice)?.[1] ?? "",
        mobileRole: ROLE.exec(slice)?.[1],
      },
    };
  });

  const groups: ParsedColumn[][] = [];
  let current: ParsedColumn[] = [];
  let bi = 0;
  for (const { at, col } of parsed) {
    let started = false;
    while (bi < bounds.length && bounds[bi] <= at) {
      if (current.length > 0) started = true;
      bi++;
    }
    if (started) {
      groups.push(current);
      current = [];
    }
    current.push(col);
  }
  if (current.length > 0) groups.push(current);
  return groups.filter((g) => g.length > 0);
}

function rolesFor(file: string, arrayIndex: number) {
  const source = readFileSync(resolve(SRC, file), "utf8");
  const arrays = columnArrays(source).filter((a) => a.length >= 3);
  const cols = arrays[arrayIndex];
  expect(
    cols,
    `${file} has ${arrays.length} column arrays, so index ${arrayIndex} does not exist`,
  ).toBeDefined();
  // The REAL function, so these assertions can never drift from the component.
  return {
    cols,
    roles: deriveMobileRoles(
      cols.map((c) => ({
        key: c.key,
        header: c.header,
        ...(c.mobileRole ? { mobileRole: c.mobileRole as "field" } : {}),
      })),
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* 1. Per-table expectations                                                  */
/* -------------------------------------------------------------------------- */

// Deliberately table-specific, per the brief: NOT "every table must expose N
// fields", but "this record cannot be judged without these values".
const EXPECTATIONS: {
  what: string;
  file: string;
  array: number;
  visible: string[];
}[] = [
  {
    what: "a payroll invoice — you cannot pay it without the net amount",
    file: "components/payroll/payroll-invoices-tab.tsx",
    array: 0,
    visible: ["invoiceNo", "consultant", "netAmount", "status"],
  },
  {
    what: "a payroll run — the total is the run",
    file: "components/payroll/payroll-runs-tab.tsx",
    array: 0,
    visible: ["period", "entity", "totalNet", "status"],
  },
  {
    what: "an expense claim — reference, who, amount, state",
    file: "app/(dashboard)/expenses/page.tsx",
    array: 0,
    visible: ["title", "period", "total", "status"],
  },
  {
    what: "a travel request — budget and state drive the approval",
    file: "app/(dashboard)/travel/page.tsx",
    array: 0,
    visible: ["code", "route", "budget", "status"],
  },
  {
    what: "a visa — the expiry date is the whole point of the tracker",
    file: "components/visa/visa-tracker-tab.tsx",
    array: 0,
    visible: ["employee", "visaType", "expiryDate", "status"],
  },
  {
    what: "a 90-day report — the due date is a legal deadline",
    file: "components/visa/ninety-day-tab.tsx",
    array: 0,
    visible: ["applicant", "entity", "due", "status"],
  },
  {
    what: "a legal document — expiry and status decide whether to act",
    file: "app/(dashboard)/legal/page.tsx",
    array: 0,
    visible: ["title", "owner", "expiry", "status"],
  },
  {
    what: "an employee — name and identifier, not a row number",
    file: "components/employees/employee-table.tsx",
    array: 0,
    visible: ["employee", "employeeId", "status"],
  },
  {
    what: "a CRM task — due date and state, and the done control stays reachable",
    file: "components/crm-tasks/tasks-tab.tsx",
    array: 0,
    visible: ["subject", "anchor", "dueDate", "status", "complete"],
  },
  {
    what: "a lead — owner and age are what triage runs on",
    file: "components/leads/leads-tab.tsx",
    array: 0,
    visible: ["company", "name", "owner", "status"],
  },
  {
    what: "an onboarding run — progress and state, not a chevron",
    file: "components/hrms/onboarding-tab.tsx",
    array: 0,
    visible: ["employeeName", "startDate", "progress", "status"],
  },
  {
    what: "an offboarding run — last working day is the deadline",
    file: "components/hrms/offboarding-tab.tsx",
    array: 0,
    visible: ["employeeName", "lastWorkingDay", "progress", "status"],
  },
  {
    what: "an ESOP grant — vested-to-date is the figure people ask about",
    file: "components/hrms/esop-tab.tsx",
    array: 0,
    visible: ["employee", "grantType", "vestedToDate", "status"],
  },
  {
    what: "an attendance row — status and hours",
    file: "components/hrms/attendance-tab.tsx",
    array: 0,
    visible: ["employee", "department", "totalHours", "status"],
  },
  {
    what: "an office asset — who holds it and what it is worth",
    file: "components/office/assets-tab.tsx",
    array: 0,
    visible: ["name", "assignee", "bookValue", "status"],
  },
  {
    what: "a benefit — annual cost and state",
    file: "app/(dashboard)/benefits/page.tsx",
    array: 0,
    visible: ["name", "provider", "cost", "status"],
  },
  {
    what: "a proposal — the tier it sits at is the record's whole meaning",
    file: "app/(dashboard)/projects/proposals/page.tsx",
    array: 1,
    visible: ["title", "raisedBy", "status"],
  },
  {
    what: "an accounting invoice — the Phase 8A contract still holds",
    file: "components/accounting/invoices-tab.tsx",
    array: 0,
    visible: ["invoiceNo", "counterparty", "amount", "dueDate", "status"],
  },
];

describe("mobile cards carry the information the record is judged on", () => {
  for (const { what, file, array, visible } of EXPECTATIONS) {
    it(what, () => {
      const { roles } = rolesFor(file, array);
      const shown = new Set(
        [roles.title, roles.subtitle, roles.badge, ...roles.fields].filter(
          Boolean,
        ) as string[],
      );
      for (const key of visible) {
        expect(
          shown.has(key),
          `${file} [array ${array}]: "${key}" is not visible on the card — it ` +
            `resolved to ${roles.details.includes(key) ? "the expander" : "nowhere"}. ` +
            `Card shows: ${[...shown].join(", ")}`,
        ).toBe(true);
      }
    });
  }
});

/* -------------------------------------------------------------------------- */
/* 2. No card is titled by table chrome                                       */
/* -------------------------------------------------------------------------- */

/**
 * Columns that render a control or an index rather than a value. A card titled
 * with one of these has no heading at all: measured `head=""` for a checkbox
 * and `head="1"` for a row number.
 */
const CHROME = new Set(["expand", "complete", "select", "rowNo", "drag"]);

const CONSUMERS = (function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = resolve(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(p, out);
    } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
})(SRC);

describe("no card is headed by a control", () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const file of CONSUMERS) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("components/shared/data-table")) continue;
    for (const [i, cols] of columnArrays(source).entries()) {
      if (cols.length < 3) continue;
      checked++;
      const roles = deriveMobileRoles(
        cols.map((c) => ({
          key: c.key,
          header: c.header,
          ...(c.mobileRole ? { mobileRole: c.mobileRole as "field" } : {}),
        })),
      );
      if (CHROME.has(roles.title)) {
        offenders.push(
          `${file.slice(SRC.length + 1).replace(/\\/g, "/")} [array ${i}] ` +
            `is titled by "${roles.title}"`,
        );
      }
    }
  }

  it("finds the tables it is meant to be guarding", () => {
    // Guards the guard. Measured at the time of writing: 93 column arrays.
    expect(checked).toBeGreaterThan(70);
  });

  it("gives every card a heading a reader can identify it by", () => {
    expect(
      offenders,
      `these tables open with a checkbox, chevron or row number, so the card ` +
        `heading renders no identifying text. Give the real identifier ` +
        `mobileRole="title" and the control column mobileRole="hidden" (or ` +
        `"field", if the control must stay reachable on a phone):\n  ` +
        offenders.join("\n  "),
    ).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. The mechanism, on the real component                                    */
/* -------------------------------------------------------------------------- */

type Row = {
  id: string;
  invoiceNo: string;
  consultant: string;
  entity: string;
  netAmount: string;
  period: string;
  status: string;
};

const ROW: Row[] = [
  {
    id: "1",
    invoiceNo: "PAY-INV-2026-0007",
    consultant: "Kunanon Chirathivat-Wongsawat",
    entity: "TBH (Thailand) Co., Ltd.",
    netAmount: "THB 1,234,567,890.12",
    period: "Sept 2026",
    status: "Awaiting Second-Line Confirmation",
  },
];

const COLUMNS = [
  { key: "invoiceNo", header: "Invoice No", mobileRole: "title" as const },
  { key: "consultant", header: "Consultant", mobileRole: "subtitle" as const },
  { key: "entity", header: "Entity", mobileRole: "detail" as const },
  { key: "netAmount", header: "Net", mobileRole: "field" as const },
  { key: "period", header: "Period", mobileRole: "field" as const },
  { key: "status", header: "Status", mobileRole: "badge" as const },
];

describe("the card and the table show the same record", () => {
  it("surfaces the net amount and the status at 375px", () => {
    setViewport(375);
    render(<DataTable data={ROW} columns={COLUMNS} />);

    expect(screen.getByText("THB 1,234,567,890.12")).toBeInTheDocument();
    expect(
      screen.getByText("Awaiting Second-Line Confirmation"),
    ).toBeInTheDocument();
    expect(screen.getByText("PAY-INV-2026-0007")).toBeInTheDocument();
  });

  it("still renders every column as a table at 1280px", () => {
    setViewport(1280);
    render(<DataTable data={ROW} columns={COLUMNS} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    for (const value of Object.values(ROW[0])) {
      if (value === "1") continue; // the id is not a column
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it("is a regression guard, not a tautology: the default buries the amount", () => {
    const shipped = [
      { key: "invoiceNo", header: "Invoice No" },
      { key: "consultant", header: "Consultant" },
      { key: "entity", header: "Entity" },
      { key: "netAmount", header: "Net" },
      { key: "status", header: "Status" },
    ];
    const roles = deriveMobileRoles(shipped);

    expect(roles.fields).toEqual(["consultant", "entity"]);
    expect(roles.details).toContain("netAmount");
    expect(roles.details).toContain("status");
  });
});
