import { describe, expect, it } from "vitest";

import { deriveMobileRoles } from "@/components/shared/data-table";
import type { ResponsiveAction } from "@/components/shared/responsive/responsive-actions";
import { splitActions } from "@/components/shared/responsive/responsive-actions";
import { BREAKPOINTS } from "@/hooks/use-breakpoint";

// The two pieces of Phase 1 that are decisions rather than markup: which
// columns a card shows, and which actions survive as buttons. Both are pure, so
// they are tested without a DOM — a jsdom test of the rendered card would prove
// far less about the rules and break on every style change.

type Row = { id: string; name: string };
const col = (
  key: string,
  mobileRole?: "title" | "subtitle" | "badge" | "field" | "detail" | "hidden",
) => ({ key, header: key, mobileRole });

describe("card layout falls back sensibly with no annotations", () => {
  // ~75 existing tables declare no mobileRole at all. The default has to be
  // useful for all of them, or the mobile view ships broken by default.
  it("uses the first column as the title and the next two as visible fields", () => {
    const roles = deriveMobileRoles<Row>([
      col("name"),
      col("owner"),
      col("status"),
      col("created"),
      col("updated"),
    ]);

    expect(roles.title).toBe("name");
    expect(roles.fields).toEqual(["owner", "status"]);
    // Everything past the first three is detail, not dropped.
    expect(roles.details).toEqual(["created", "updated"]);
  });

  it("never silently drops a column", () => {
    const keys = ["a", "b", "c", "d", "e", "f"];
    const roles = deriveMobileRoles<Row>(keys.map((k) => col(k)));
    const shown = [
      roles.title,
      roles.subtitle,
      roles.badge,
      ...roles.fields,
      ...roles.details,
    ].filter(Boolean);
    expect([...shown].sort()).toEqual([...keys].sort());
  });

  it("survives a single-column table", () => {
    const roles = deriveMobileRoles<Row>([col("name")]);
    expect(roles.title).toBe("name");
    expect(roles.fields).toEqual([]);
    expect(roles.details).toEqual([]);
  });

  it("survives an empty column set rather than throwing", () => {
    const roles = deriveMobileRoles<Row>([]);
    expect(roles.title).toBe("");
    expect(roles.fields).toEqual([]);
  });
});

describe("explicit roles win", () => {
  it("honours declared title, subtitle, badge and detail", () => {
    const roles = deriveMobileRoles<Row>([
      col("ref"),
      col("name", "title"),
      col("owner", "subtitle"),
      col("status", "badge"),
      col("amount", "field"),
      col("notes", "detail"),
    ]);

    expect(roles.title).toBe("name");
    expect(roles.subtitle).toBe("owner");
    expect(roles.badge).toBe("status");
    expect(roles.fields).toEqual(["amount"]);
    // `ref` was not annotated, so it lands in detail rather than vanishing.
    expect(roles.details).toContain("ref");
    expect(roles.details).toContain("notes");
  });

  it("omits hidden columns entirely", () => {
    const roles = deriveMobileRoles<Row>([
      col("name", "title"),
      col("internalId", "hidden"),
      col("owner", "field"),
    ]);
    const all = [roles.title, ...roles.fields, ...roles.details];
    expect(all).not.toContain("internalId");
  });

  // A column carrying an actions menu must not be rendered as a card field —
  // the card has its own actions row.
  it("keeps a claimed column out of the field lists", () => {
    const roles = deriveMobileRoles<Row>([
      col("name", "title"),
      col("status", "badge"),
    ]);
    expect(roles.fields).not.toContain("name");
    expect(roles.fields).not.toContain("status");
    expect(roles.details).not.toContain("name");
  });
});

describe("action demotion", () => {
  const actions: ResponsiveAction[] = [
    { id: "edit", label: "Edit", onSelect: () => {}, variant: "secondary" },
    { id: "approve", label: "Approve", onSelect: () => {}, variant: "primary" },
    {
      id: "delete",
      label: "Delete",
      onSelect: () => {},
      variant: "destructive",
    },
  ];

  it("promotes the primary action and demotes the rest on mobile", () => {
    const { visible, overflow } = splitActions(actions, 1);
    expect(visible.map((a) => a.id)).toEqual(["approve"]);
    expect(overflow.map((a) => a.id)).toEqual(["edit", "delete"]);
  });

  // The rule that matters: a destructive action never becomes a bare button
  // where a primary one sits at a wider breakpoint.
  it("never promotes a destructive action, even with room to spare", () => {
    const { visible, overflow } = splitActions(actions, 5);
    expect(visible.map((a) => a.id)).not.toContain("delete");
    expect(overflow.map((a) => a.id)).toEqual(["delete"]);
  });

  it("promotes nothing when the only action is destructive", () => {
    const { visible, overflow } = splitActions([actions[2]!], 3);
    expect(visible).toEqual([]);
    expect(overflow.map((a) => a.id)).toEqual(["delete"]);
  });

  it("demotes everything rather than dropping it at maxVisible 0", () => {
    const { visible, overflow } = splitActions(actions, 0);
    expect(visible).toEqual([]);
    expect(overflow).toHaveLength(3);
  });

  it("orders by intent, not by the order given", () => {
    const reversed = [...actions].reverse();
    expect(splitActions(reversed, 2).visible.map((a) => a.id)).toEqual([
      "approve",
      "edit",
    ]);
  });

  it("hides hidden actions completely, so a permission gate cannot leak", () => {
    const withHidden: ResponsiveAction[] = [
      ...actions,
      { id: "secret", label: "Archive", onSelect: () => {}, hidden: true },
    ];
    const { visible, overflow } = splitActions(withHidden, 3);
    const ids = [...visible, ...overflow].map((a) => a.id);
    expect(ids).not.toContain("secret");
  });
});

describe("breakpoints match Tailwind", () => {
  // If these drift, a component that branches in JS and a sibling that branches
  // in CSS disagree at exactly one width, and the layout tears there.
  it("keeps the documented values", () => {
    expect(BREAKPOINTS).toEqual({
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      "2xl": 1536,
    });
  });
});
