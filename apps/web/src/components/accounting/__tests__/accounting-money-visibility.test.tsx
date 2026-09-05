import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable, deriveMobileRoles } from "@/components/shared/data-table";

// Phase 8A — an accounting row's amount and status must survive the phone.
//
// `deriveMobileRoles` promotes the first two unannotated columns to visible
// fields and buries the rest behind the card's expander. Accounting column
// orders put the identifier first and the money in the middle, so with only
// `mobileRole: "actions"` declared (the state Phase 8's sweep left them in),
// EVERY money-bearing list showed identifier + two descriptors and hid the
// amount, the due date and the status.
//
// Measured on WebKit at 320/375/390/430 before the fix: amount, status and due
// date were all absent from the card; only "Type" -- the least useful column of
// the seven -- was visible. Desktop was and remains unaffected: `mobileRole`
// has no effect above the card breakpoint.

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

// ---------------------------------------------------------------------------
// 1. The mechanism, on the real component and the real invoices column order.
// ---------------------------------------------------------------------------

type Invoice = {
  id: string;
  invoiceNo: string;
  type: string;
  counterparty: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  status: string;
};

const INVOICE: Invoice[] = [
  {
    id: "1",
    invoiceNo: "INV-2026-0007",
    type: "Sales",
    counterparty: "Reconciliation & Settlement Holdings (Thailand) Co. Ltd",
    amount: "THB 1,234,567,890.12",
    issueDate: "01 Sept 2026",
    dueDate: "31 Oct 2026",
    status: "Partially Paid",
  },
];

/** The shipped order from `invoices-tab.tsx`, with the roles it now declares. */
const INVOICE_COLUMNS = [
  { key: "invoiceNo", header: "Invoice No", mobileRole: "title" as const },
  { key: "type", header: "Type", mobileRole: "detail" as const },
  {
    key: "counterparty",
    header: "Counterparty",
    mobileRole: "subtitle" as const,
  },
  { key: "amount", header: "Amount", mobileRole: "field" as const },
  { key: "issueDate", header: "Issue Date", mobileRole: "detail" as const },
  { key: "dueDate", header: "Due Date", mobileRole: "field" as const },
  { key: "status", header: "Status", mobileRole: "badge" as const },
];

describe("an accounting card shows the money", () => {
  it("surfaces amount, due date and status at 375px without expanding", () => {
    setViewport(375);
    render(<DataTable data={INVOICE} columns={INVOICE_COLUMNS} />);

    expect(screen.getByText("THB 1,234,567,890.12")).toBeInTheDocument();
    expect(screen.getByText("Partially Paid")).toBeInTheDocument();
    expect(screen.getByText("31 Oct 2026")).toBeInTheDocument();
  });

  it("still renders every column as a table at 1280px", () => {
    setViewport(1280);
    render(<DataTable data={INVOICE} columns={INVOICE_COLUMNS} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    for (const value of Object.values(INVOICE[0])) {
      if (value === "1") continue; // the id is not a column
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it("is a regression guard, not a tautology: unannotated hides the amount", () => {
    // The pre-fix shape -- only `actions` declared -- for contrast.
    const shipped = [
      { key: "invoiceNo", header: "Invoice No" },
      { key: "type", header: "Type" },
      { key: "counterparty", header: "Counterparty" },
      { key: "amount", header: "Amount" },
      { key: "dueDate", header: "Due Date" },
      { key: "status", header: "Status" },
      { key: "actions", header: "", mobileRole: "actions" as const },
    ];
    const roles = deriveMobileRoles(shipped);

    expect(roles.fields).toEqual(["type", "counterparty"]);
    expect(roles.details).toContain("amount");
    expect(roles.details).toContain("status");
  });
});

// ---------------------------------------------------------------------------
// 2. The source invariant, so a new accounting table cannot ship the defect.
// ---------------------------------------------------------------------------

const ACCOUNTING = resolve(__dirname, "..");

/**
 * Accounting key names that carry a figure a reader is scanning for.
 * Deliberately an explicit list rather than a regex over "amount|total|credit",
 * because `creditDays` is a payment term, not money, and a fuzzy pattern
 * reports it forever.
 */
const MONEY_KEYS = new Set([
  "amount",
  "balance",
  "grandTotal",
  "totalDebit",
  "totalCredit",
  "netBookValue",
  "purchasePrice",
  "proceeds",
  "nbvDisposed",
  "gainLoss",
  "charge",
  "deferredTax",
  "temporaryDifference",
  "bookCarrying",
  "taxWdv",
  "carryingBefore",
  "carryingAfter",
  "movement",
  "profitOrLoss",
  "oci",
  "balancesAfter",
  "costTransferred",
  "accumulatedTransferred",
  "variance",
  "expectedQuantity",
]);

/**
 * Figures deliberately left behind the tap, with the reason. Each is a second
 * copy of, or an input to, a figure the card already shows, so promoting it
 * would cost a card slot without telling the reader anything new.
 */
const DELIBERATELY_BEHIND_THE_TAP: Record<string, string> = {
  totalCredit: "a balanced entry has debit === credit; totalDebit is shown",
  purchasePrice: "historic cost; netBookValue is the live figure and is shown",
  bookCarrying: "an input to temporaryDifference, which is shown",
  taxWdv: "an input to temporaryDifference, which is shown",
  carryingBefore: "the opening side of movement, which is shown",
  balancesAfter: "a roll-up of carryingAfter, which is shown",
  profitOrLoss: "a split of movement, which is shown",
  oci: "a split of movement, which is shown",
  costTransferred: "a component of movement, which is shown",
  accumulatedTransferred: "a component of movement, which is shown",
  nbvDisposed: "an input to gainLoss, which is shown",
  expectedQuantity: "an input to variance, which is shown",
};

/** `{ key: "x", mobileRole: "y" }` pairs, grouped into their column arrays. */
function columnArrays(source: string): { key: string; role?: string }[][] {
  const found: { at: number; key: string; role?: string }[] = [];
  // `\r?` is not decoration: 37 of the 54 files in this directory are CRLF, and
  // a bare `,\n` matches none of them. An earlier draft of this guard reported a
  // clean sweep because it silently skipped two thirds of the module.
  const re =
    /^(\s*)key:\s*"([a-zA-Z0-9_.]+)",\r?\n(?:\s*mobileRole:\s*"(\w+)")?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    found.push({ at: m.index, key: m[2], role: m[3] });
  }
  if (found.length === 0) return [];

  // Columns of one array sit within a few hundred characters of each other; a
  // separate array in the same file is far further off.
  const arrays: { key: string; role?: string }[][] = [];
  let current = [found[0]];
  for (let i = 1; i < found.length; i++) {
    if (found[i].at - found[i - 1].at > 2200) {
      arrays.push(current);
      current = [];
    }
    current.push(found[i]);
  }
  arrays.push(current);
  return arrays.map((a) => a.map(({ key, role }) => ({ key, role })));
}

describe("no accounting table hides a figure by accident", () => {
  const offenders: string[] = [];
  let arraysChecked = 0;
  let moneyColumnsChecked = 0;

  for (const entry of readdirSync(ACCOUNTING)) {
    if (!entry.endsWith(".tsx")) continue;
    const source = readFileSync(join(ACCOUNTING, entry), "utf8");
    if (!source.includes("components/shared/data-table")) continue;

    for (const [i, cols] of columnArrays(source).entries()) {
      const money = cols.filter((c) => MONEY_KEYS.has(c.key));
      if (money.length === 0) continue;
      arraysChecked++;
      moneyColumnsChecked += money.length;

      // The real function, so this can never drift from the implementation.
      const roles = deriveMobileRoles(
        cols.map((c) => ({
          key: c.key,
          header: c.key,
          ...(c.role ? { mobileRole: c.role as "field" } : {}),
        })),
      );

      for (const { key } of money) {
        if (!roles.details.includes(key)) continue; // visible -- fine
        if (key in DELIBERATELY_BEHIND_THE_TAP) continue; // named and reasoned
        offenders.push(
          `${entry} [array ${i}] hides "${key}" behind the expander`,
        );
      }
    }
  }

  it("finds the money columns it is meant to be guarding", () => {
    // Guards the guard: a broken parser must fail loudly, not report a clean
    // sweep over nothing. Measured at the time of writing: 16 column arrays
    // across 15 files, carrying 31 money columns.
    expect(arraysChecked).toBeGreaterThan(12);
    expect(moneyColumnsChecked).toBeGreaterThan(25);
  });

  it("surfaces every figure that is not deliberately deferred", () => {
    expect(
      offenders,
      `these accounting columns carry a figure but land in the card's expander, ` +
        `so the amount is invisible on a phone. Either give the column a ` +
        `mobileRole of "field"/"badge"/"subtitle"/"title", or add it to ` +
        `DELIBERATELY_BEHIND_THE_TAP with the reason:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
