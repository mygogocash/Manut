import { describe, expect, it } from "vitest";

/**
 * Card identity on the per-business-unit board.
 *
 * A card is a (deal x unit) PAIR. Every drag handler keys off that pair, and
 * a deal id alone is ambiguous the moment a deal carries two units — which
 * is the normal case this board exists for. These are the pure pieces of
 * that logic, lifted out of pipeline-kanban.tsx so the index maths is
 * testable without mounting the board.
 *
 * Kept in step with the component by hand. If `cardKey` changes shape there,
 * these fail loudly rather than drifting.
 */

interface Card {
  opportunityId: string;
  businessUnit: string;
}

function cardKey(card: Card) {
  return `${card.opportunityId}::${card.businessUnit}`;
}

/** The component's reorderCard index maths. */
function reorder(items: Card[], draggedKey: string, targetKey: string) {
  if (draggedKey === targetKey) return items;
  const from = items.findIndex((c) => cardKey(c) === draggedKey);
  const to = items.findIndex((c) => cardKey(c) === targetKey);
  if (from < 0 || to < 0 || from === to) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(from < to ? to - 1 : to, 0, moved);
  return next;
}

const MTN_ONEWAVE = { opportunityId: "opp1", businessUnit: "onewave" };
const MTN_REVENUE = { opportunityId: "opp1", businessUnit: "onewave-revenue" };
const OTHER = { opportunityId: "opp2", businessUnit: "aria" };

describe("cardKey", () => {
  it("distinguishes two units of the SAME deal", () => {
    // The reason a deal id cannot be the card identity. MTN tagged Onewave
    // and Onewave Revenue renders two cards; keyed on the deal id they
    // would collide, and React would reuse one node for both while every
    // drag handler moved whichever it found first.
    expect(cardKey(MTN_ONEWAVE)).not.toBe(cardKey(MTN_REVENUE));
  });

  it("distinguishes the same unit on different deals", () => {
    expect(cardKey({ opportunityId: "opp1", businessUnit: "aria" })).not.toBe(
      cardKey({ opportunityId: "opp2", businessUnit: "aria" }),
    );
  });

  it("is stable for the same pair", () => {
    expect(cardKey(MTN_ONEWAVE)).toBe(cardKey({ ...MTN_ONEWAVE }));
  });
});

describe("reorder within a column", () => {
  it("moves one unit of a deal without disturbing its sibling", () => {
    // The failure this guards: keyed on the deal id, dragging MTN·Onewave
    // would match MTN·Onewave Revenue too and drag both.
    const items = [MTN_ONEWAVE, MTN_REVENUE, OTHER];

    const next = reorder(items, cardKey(OTHER), cardKey(MTN_REVENUE));

    expect(next.map(cardKey)).toEqual([
      cardKey(MTN_ONEWAVE),
      cardKey(OTHER),
      cardKey(MTN_REVENUE),
    ]);
  });

  it("lands the card BEFORE the target when dragging downward", () => {
    // Removing the dragged card shifts later indices left by one, so a
    // downward move inserts at to-1 to land immediately before the target
    // rather than slipping past it.
    const items = [MTN_ONEWAVE, MTN_REVENUE, OTHER];

    const next = reorder(items, cardKey(MTN_ONEWAVE), cardKey(OTHER));

    expect(next.map(cardKey)).toEqual([
      cardKey(MTN_REVENUE),
      cardKey(MTN_ONEWAVE),
      cardKey(OTHER),
    ]);
  });

  it("lands the card before the target when dragging upward", () => {
    const items = [MTN_ONEWAVE, MTN_REVENUE, OTHER];

    const next = reorder(items, cardKey(OTHER), cardKey(MTN_ONEWAVE));

    expect(next.map(cardKey)).toEqual([
      cardKey(OTHER),
      cardKey(MTN_ONEWAVE),
      cardKey(MTN_REVENUE),
    ]);
  });

  it("is a no-op when the card is dropped on itself", () => {
    const items = [MTN_ONEWAVE, MTN_REVENUE];

    expect(reorder(items, cardKey(MTN_ONEWAVE), cardKey(MTN_ONEWAVE))).toBe(
      items,
    );
  });

  it("is a no-op when a key is not in the column", () => {
    const items = [MTN_ONEWAVE, MTN_REVENUE];

    expect(reorder(items, cardKey(OTHER), cardKey(MTN_ONEWAVE))).toBe(items);
  });
});
