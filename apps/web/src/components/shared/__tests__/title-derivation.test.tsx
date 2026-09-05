import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable, deriveMobileRoles } from "@/components/shared/data-table";

// Phase 8C — which column becomes the card's heading.
//
// `titleKey` used to be `explicit("title")[0] ?? usable[0]?.key`: whatever came
// first, regardless of what it renders. Phase 8B measured the consequence on
// WebKit at 320/390/430 — a card headed by a Checkbox produced `head=""` and one
// headed by a row number produced `head="1"`.
//
// The derivation sees column DESCRIPTORS only. It has no row data, so it cannot
// ask what a cell renders; the sole signal available is the header. That makes
// the rule easy to get wrong in the other direction, and the audit found the
// counter-example already in the tree: `it-operations` heads its request-number
// column "#", and that column IS the record's identifier.
//
// Hence: skip only a COMPLETELY EMPTY header, only while a labelled column
// remains, and never title with the explicit `actions` column. Measured across
// all 93 column arrays in the repository, this changes ZERO existing titles — it
// is a guard against the next table, not a migration.
//
// These tests assert the RENDERED heading, not the derivation's return value,
// because the defect was one a user could see.

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

type Row = { id: string; ref: string; person: string; status: string };

const ROW: Row[] = [
  { id: "1", ref: "REQ-2026-0042", person: "Kunanon Ratchaprasong", status: "Open" },
];

/** Renders at 375px and returns the text of the card's heading. */
function cardTitle(columns: Parameters<typeof DataTable<Row>>[0]["columns"]) {
  setViewport(375);
  const { container } = render(<DataTable data={ROW} columns={columns} />);
  const el = container.querySelector('[data-slot="record-card-title"]');
  expect(el, "the card rendered without a heading element").not.toBeNull();
  return (el?.textContent ?? "").trim();
}

const REF = { key: "ref", header: "Reference" };
const PERSON = { key: "person", header: "Requester" };
const STATUS = { key: "status", header: "Status" };

describe("the card heading is never a control", () => {
  it("1. a leading checkbox does not become the title", () => {
    expect(
      cardTitle([
        {
          key: "select",
          header: "",
          render: () => <input type="checkbox" aria-label="Select" />,
        },
        REF,
        PERSON,
        STATUS,
      ]),
    ).toBe("REQ-2026-0042");
  });

  it("2. a leading row number does not become the title", () => {
    expect(
      cardTitle([
        { key: "rowNo", header: "", render: (_r, i) => <span>{i + 1}</span> },
        REF,
        PERSON,
        STATUS,
      ]),
    ).toBe("REQ-2026-0042");
  });

  it("3. a leading chevron does not become the title", () => {
    expect(
      cardTitle([
        { key: "expand", header: "", render: () => <span aria-hidden>›</span> },
        REF,
        PERSON,
        STATUS,
      ]),
    ).toBe("REQ-2026-0042");
  });

  it("4. an actions column declared first does not become the title", () => {
    // Not currently reachable in this repository — no consumer declares actions
    // first — but `usable[0]` would have taken it, and an action control is not
    // a heading under any reading.
    expect(
      cardTitle([
        {
          key: "actions",
          header: "",
          mobileRole: "actions" as const,
          render: () => <button type="button">Edit</button>,
        },
        REF,
        PERSON,
        STATUS,
      ]),
    ).toBe("REQ-2026-0042");
  });
});

describe("the card heading respects what the caller said", () => {
  it("5. an explicit title wins, even over an earlier labelled column", () => {
    expect(
      cardTitle([
        REF,
        { ...PERSON, mobileRole: "title" as const },
        STATUS,
      ]),
    ).toBe("Kunanon Ratchaprasong");
  });

  it("5b. an explicit title wins even when it is the last column", () => {
    expect(
      cardTitle([
        { key: "select", header: "", render: () => <input type="checkbox" aria-label="Select" /> },
        REF,
        PERSON,
        { ...STATUS, mobileRole: "title" as const },
      ]),
    ).toBe("Open");
  });

  it("6. an identifier with a presentation-only header is still the title", () => {
    // The counter-example this rule had to survive: `it-operations` labels its
    // request-number column "#". Non-empty, so it stays titleable.
    expect(
      cardTitle([{ key: "ref", header: "#" }, PERSON, STATUS]),
    ).toBe("REQ-2026-0042");
  });

  it("6b. a table whose headers are ALL blank keeps its first column", () => {
    // No labelled column to prefer, so the old fallback stands rather than the
    // card losing its heading entirely.
    expect(
      cardTitle([
        { key: "ref", header: "" },
        { key: "person", header: "" },
        { key: "status", header: "" },
      ]),
    ).toBe("REQ-2026-0042");
  });

  it("7. a normal leading identifier is unaffected", () => {
    expect(cardTitle([REF, PERSON, STATUS])).toBe("REQ-2026-0042");
  });
});

describe("skipping a column for the title does not lose it", () => {
  it("keeps the skipped chrome column available as a field", () => {
    // The column is passed over for the HEADING, not removed: only
    // `mobileRole: "hidden"` removes a column from the card.
    const roles = deriveMobileRoles([
      { key: "select", header: "" },
      { key: "ref", header: "Reference" },
      { key: "person", header: "Requester" },
      { key: "status", header: "Status" },
    ]);

    expect(roles.title).toBe("ref");
    expect([...roles.fields, ...roles.details]).toContain("select");
  });

  it("still honours mobileRole:hidden", () => {
    const roles = deriveMobileRoles([
      { key: "select", header: "", mobileRole: "hidden" },
      { key: "ref", header: "Reference" },
      { key: "person", header: "Requester" },
    ]);

    expect(roles.title).toBe("ref");
    expect([...roles.fields, ...roles.details]).not.toContain("select");
  });

  it("leaves the Phase 8B promotion rule alone", () => {
    // Phase 8B concluded positional promotion is not universally safe but that
    // explicit per-table roles are the fix. 8C changes the TITLE rule only;
    // columns 2 and 3 are still promoted when nothing is declared.
    const roles = deriveMobileRoles([
      { key: "ref", header: "Reference" },
      { key: "person", header: "Requester" },
      { key: "status", header: "Status" },
      { key: "amount", header: "Amount" },
    ]);

    expect(roles.title).toBe("ref");
    expect(roles.fields).toEqual(["person", "status"]);
    expect(roles.details).toEqual(["amount"]);
  });
});
