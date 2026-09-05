import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { deriveMobileRoles } from "@/components/shared/data-table";

// Phase 10 — the two Sales & Revenue card faces that hid what the record is for.
//
// Measured on WebKit at 320/375/390/430 through the real DataTable with the real
// column shapes:
//
//   contacts    email=false phone=false. A contact is reached BY its email or
//               phone; the card showed name, account and job title instead.
//
//   activities  occurredAt=false, and the card was titled by `type` ("Meeting"),
//               a category rather than an identity. An activity log with no
//               "when" is not a log.
//
// These surfaces once existed twice, and both copies were asserted here. The
// separate `/sales-revenue` module was retired in #1164, so only the `/sales`
// split — components/{contacts,crm-activities,accounts}/* — remains, and the
// cases naming components/sales-revenue/* were dropped rather than repointed at
// a file that no longer exists.
//
// Also recorded here: the accounts grid's numeric cells were SUSPECTED of
// clipping money. They do not. See the last describe block.

const SRC = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

/** `{ key, mobileRole }` for the first column array of ≥3 columns in a file. */
function columnsOf(rel: string) {
  const source = read(rel);
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
    current.push({
      key: m[1],
      mobileRole: /mobileRole:\s*"(\w+)"/.exec(source.slice(at, end))?.[1],
    });
  }
  if (current.length > 0) groups.push(current);
  const usable = groups.filter((g) => g.length >= 3);
  expect(usable[0], `${rel} has no column array`).toBeDefined();
  return usable[0];
}

/** What the mobile card shows, via the REAL derivation. */
function cardFace(rel: string) {
  const roles = deriveMobileRoles(
    columnsOf(rel).map((c) => ({
      key: c.key,
      header: c.key,
      ...(c.mobileRole ? { mobileRole: c.mobileRole as "field" } : {}),
    })),
  );
  return {
    roles,
    shown: new Set(
      [roles.title, roles.subtitle, roles.badge, ...roles.fields].filter(
        Boolean,
      ) as string[],
    ),
  };
}

const CASES: { what: string; file: string; visible: string[]; title?: string }[] =
  [
    {
      what: "a contact card shows how to reach the contact",
      file: "components/contacts/contacts-tab.tsx",
      visible: ["name", "account", "email", "phone"],
      title: "name",
    },
    {
      what: "an activity card is titled by what it was, and says when",
      file: "components/crm-activities/activities-tab.tsx",
      visible: ["subject", "anchor", "type", "occurredAt", "owner"],
      title: "subject",
    },
  ];

describe("CRM cards carry the record's point", () => {
  for (const { what, file, visible, title } of CASES) {
    it(what, () => {
      const { roles, shown } = cardFace(file);
      if (title) {
        expect(
          roles.title,
          `${file}: the card is titled by "${roles.title}", not "${title}"`,
        ).toBe(title);
      }
      for (const key of visible) {
        expect(
          shown.has(key),
          `${file}: "${key}" is behind the card expander. Card shows: ${[...shown].join(", ")}`,
        ).toBe(true);
      }
    });
  }

  it("keeps the row action reachable on all four", () => {
    for (const { file } of CASES) {
      const { roles } = cardFace(file);
      expect(roles.actions, `${file} lost its actions role`).toBe("actions");
    }
  });

  it("is not a tautology: the default buried both", () => {
    // The pre-fix shapes, to document what these tests prevent.
    const contacts = deriveMobileRoles([
      { key: "name", header: "Name" },
      { key: "account", header: "Account" },
      { key: "title", header: "Title" },
      { key: "email", header: "Email" },
      { key: "phone", header: "Phone" },
      { key: "actions", header: "", mobileRole: "actions" },
    ]);
    expect(contacts.fields).toEqual(["account", "title"]);
    expect(contacts.details).toContain("email");
    expect(contacts.details).toContain("phone");

    const activities = deriveMobileRoles([
      { key: "type", header: "Type" },
      { key: "subject", header: "Subject" },
      { key: "anchor", header: "Tied to" },
      { key: "occurredAt", header: "When" },
      { key: "actions", header: "", mobileRole: "actions" },
    ]);
    expect(activities.title).toBe("type"); // a category, not an identity
    expect(activities.details).toContain("occurredAt");
  });
});

describe("the accounts grid's numeric cells were a false positive", () => {
  // Recorded so nobody re-opens it from the source alone. `tcv`, `totalUsers`,
  // `appUsers` and `probability` all render inside `<span className="truncate
  // …">` with NO `title` attribute, inside a `table-fixed` table whose `tcv`
  // column defaults to 130px. Reading that, a 22-character
  // "USD 18,000,000,000,000" looks certain to be cut — and a cut money value is
  // a WRONG money value with no tooltip to recover it.
  //
  // Measured at all twelve widths with that exact markup: clipped = 0, and the
  // value renders in full. `truncate` sets `overflow: hidden` on an INLINE
  // span, where it has no effect; the table container scrolls instead. The
  // classes are inert, not protective, and nothing is lost.
  const source = read("components/accounts/accounts-tab.tsx");

  it("still renders money through formatTcv, not a raw string", () => {
    expect(source).toContain("formatTcv(opp.value, opp.currency)");
  });

  it("still lets the table scroll rather than clipping cells", () => {
    // The protection that actually matters: the container scrolls. If someone
    // adds `overflow-hidden` to the numeric cells, the inert `truncate` becomes
    // live and money starts being cut.
    const numericCell =
      /case "tcv":[\s\S]{0,400}?<TableCell([^>]*)>/.exec(source)?.[1] ?? "";
    expect(
      numericCell.includes("overflow-hidden"),
      "the tcv cell now clips: `truncate` on the inner span becomes live and a " +
        "large TCV will be silently cut, with no title attribute to recover it",
    ).toBe(false);
  });
});
