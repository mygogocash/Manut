import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EquityMonthlySalaryTab } from "@/components/hrms/equity-monthly-salary-tab";
import { deriveMobileRoles } from "@/components/shared/data-table";
import type { EquityMonthlySalary } from "@/services/equity-salary.service";
import { MONTH_NAMES } from "@/services/equity-salary.service";

// Phase 9 — the HRMS defects, each measured on WebKit before being fixed.
//
//   Toolbars      Four HRMS toolbars were `flex items-center gap-2` with no
//                 wrap, plus a `flex-1` spacer. At 320px that pushed "Manage
//                 template" and "New onboarding" to x=603 in a 320px viewport:
//                 283px of PAGE overflow and 3 uncontained elements.
//
//   Equity matrix `equity-monthly-salary-tab` generates TWELVE month columns
//                 from MONTH_NAMES, so a static column scan cannot see them.
//                 As cards at 320-430px: 0 of 12 month values visible. It is a
//                 year-of-allocations matrix, not a record list.
//
//   Payslips      A hand-rolled `<div class="overflow-hidden"><table>` CLIPPED
//                 below 768px — Status, PDF and Actions simply unreachable —
//                 and bypassed every Phase 8D table behaviour.
//
//   Hidden fields A manager's team dashboard hid "Late (min)", which is the
//                 question the screen exists to answer.

const HRMS = resolve(__dirname, "..");
const read = (f: string) => readFileSync(resolve(HRMS, f), "utf8");

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

/* -------------------------------------------------------------------------- */
/* 1. The equity matrix stays a table                                         */
/* -------------------------------------------------------------------------- */

const SALARY: EquityMonthlySalary[] = [
  {
    id: "1",
    employeeName: "Kunanon Chirathivat-Wongsawat Ratchaprasong",
    position: "Senior Group Financial Controller",
    startDate: "2019-09-01",
    currency: "THB",
    year: 2026,
    monthlyShares: Object.fromEntries(
      MONTH_NAMES.map((m, i) => [m, (i + 1) * 1000]),
    ),
    notes: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

describe("the equity allocation matrix survives a phone", () => {
  it("renders as a table at 320px, not as cards", () => {
    setViewport(320);
    render(
      <EquityMonthlySalaryTab
        rows={SALARY}
        loading={false}
        canManage
        onImport={() => {}}
        onDeleteAll={() => {}}
      />,
    );
    // As cards this measured 0 of 12 month values visible.
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows every one of the twelve months at 320px", () => {
    setViewport(320);
    render(
      <EquityMonthlySalaryTab
        rows={SALARY}
        loading={false}
        canManage
        onImport={() => {}}
        onDeleteAll={() => {}}
      />,
    );
    for (const m of MONTH_NAMES) {
      expect(
        screen.getByRole("columnheader", { name: m }),
        `month column ${m} is missing`,
      ).toBeInTheDocument();
    }
  });

  it("is a matrix by construction — the months are generated", () => {
    // Guards the guard: if MONTH_NAMES ever shrank, the two tests above would
    // pass over a table that is no longer a matrix.
    expect(MONTH_NAMES.length).toBe(12);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Source invariants                                                       */
/* -------------------------------------------------------------------------- */

describe("HRMS toolbars can wrap", () => {
  const TOOLBARS = [
    "onboarding-tab.tsx",
    "offboarding-tab.tsx",
    "esop-tab.tsx",
    "agreements-tab.tsx",
  ];

  for (const file of TOOLBARS) {
    it(`${file} wraps its toolbar`, () => {
      const source = read(file);
      // the shared toolbar shell, which without `flex-wrap` overflowed the page
      const shell =
        /border-border bg-surface flex([\s\S]{0,40}?)items-center gap-2 rounded-lg/.exec(
          source,
        );
      expect(shell, `${file} no longer has the toolbar shell`).not.toBeNull();
      expect(
        shell?.[1],
        `${file}'s toolbar does not wrap: at 320px its buttons overflow the page`,
      ).toContain("flex-wrap");
    });
  }
});

describe("the payslip table is a real table", () => {
  const source = read("payslip-management-tab.tsx");

  it("does not clip its own content", () => {
    expect(
      /overflow-hidden[^"]*"[\s\S]{0,80}?<table/.test(source),
      "the payslip table is back inside an overflow-hidden wrapper, which " +
        "clips the Status, PDF and Actions columns below 768px instead of " +
        "scrolling to them",
    ).toBe(false);
  });

  it("uses the shared Table primitive", () => {
    // Phase 8D put contained scrolling, the conditional tab stop, role=region
    // and the focus ring on `Table`. A bare <div><table> gets none of it.
    expect(source).toContain('from "@/components/ui/table"');
    expect(source).toContain("<Table");
  });
});

describe("HRMS filter selects have accessible names", () => {
  // `role="combobox"` does not take its name from content, so a trigger
  // reading "All statuses" is still unnamed. axe: button-name × 4 → 0.
  const FILTERS: [string, string][] = [
    ["onboarding-tab.tsx", "Filter onboarding by status"],
    ["offboarding-tab.tsx", "Filter offboarding by status"],
    ["esop-tab.tsx", "Filter grants by status"],
    ["attendance-tab.tsx", "Filter by work mode"],
    ["payslip-management-tab.tsx", "Filter by period"],
  ];

  for (const [file, label] of FILTERS) {
    it(`${file} names its filter`, () => {
      expect(read(file)).toContain(`aria-label="${label}"`);
    });
  }
});

/* -------------------------------------------------------------------------- */
/* 3. Fields a screen exists to show                                          */
/* -------------------------------------------------------------------------- */

/** `{ key, mobileRole }` pairs for one column array in a file. */
function columnsOf(file: string, index = 0) {
  const source = read(file);
  const hits = [...source.matchAll(/\bkey:\s*"([a-zA-Z0-9_.]+)"\s*,/g)];
  const bounds = [
    ...source.matchAll(
      /(?:const\s+\w+\s*(?::[^=]*)?=\s*(?:useMemo\(\s*\([^)]*\)\s*=>\s*)?\[)|(?:columns=\{\[)/g,
    ),
  ].map((m) => m.index ?? 0);

  const groups: { key: string; mobileRole?: string }[][] = [];
  let current: { key: string; mobileRole?: string }[] = [];
  let bi = 0;
  for (const [i, m] of hits.entries()) {
    const at = m.index ?? 0;
    let started = false;
    while (bi < bounds.length && bounds[bi] <= at) {
      if (current.length > 0) started = true;
      bi++;
    }
    if (started) {
      groups.push(current);
      current = [];
    }
    const end = i + 1 < hits.length ? (hits[i + 1].index ?? 0) : at + 4000;
    const slice = source.slice(at, end);
    current.push({
      key: m[1],
      mobileRole: /mobileRole:\s*"(\w+)"/.exec(slice)?.[1],
    });
  }
  if (current.length > 0) groups.push(current);
  const usable = groups.filter((g) => g.length >= 3);
  expect(usable[index], `${file} has no column array ${index}`).toBeDefined();
  return usable[index];
}

describe("an HRMS card shows what the screen is for", () => {
  const CASES: {
    what: string;
    file: string;
    index?: number;
    visible: string[];
  }[] = [
    {
      what: "a manager's team dashboard shows who is late, and by how much",
      file: "attendance-manager-panel.tsx",
      visible: ["name", "status", "late", "checkIn"],
    },
    {
      what: "a shift assignment shows when it takes effect",
      file: "attendance-shift-assignment-panel.tsx",
      visible: ["employee", "shift", "effective"],
    },
    {
      what: "a shift definition shows whether it is in use",
      file: "attendance-settings-panel.tsx",
      visible: ["name", "active"],
    },
    {
      what: "an attendance exception shows its decision",
      file: "attendance-settings-panel.tsx",
      index: 1,
      visible: ["type", "status"],
    },
  ];

  for (const { what, file, index, visible } of CASES) {
    it(what, () => {
      const cols = columnsOf(file, index ?? 0);
      const roles = deriveMobileRoles(
        cols.map((c) => ({
          key: c.key,
          header: c.key,
          ...(c.mobileRole ? { mobileRole: c.mobileRole as "field" } : {}),
        })),
      );
      const shown = new Set(
        [roles.title, roles.subtitle, roles.badge, ...roles.fields].filter(
          Boolean,
        ) as string[],
      );
      for (const key of visible) {
        expect(
          shown.has(key),
          `${file}: "${key}" is behind the card expander. Card shows: ${[...shown].join(", ")}`,
        ).toBe(true);
      }
    });
  }
});
