import { describe, expect, it } from "vitest";

import {
  type ActionsPayload,
  ariaBlockKindFromClassName,
  type ChecklistPayload,
  extractPartialActions,
  type KpiTilesPayload,
  parseAriaBlock,
} from "@/components/aria/blocks/types";

describe("ariaBlockKindFromClassName", () => {
  it.each([
    ["language-aria-checklist", "checklist"],
    ["language-aria-kpi-tiles", "kpi-tiles"],
    ["language-aria-actions", "actions"],
  ])("%s -> %s", (className, expected) => {
    expect(ariaBlockKindFromClassName(className)).toBe(expected);
  });

  it.each([
    ["language-js", null],
    ["language-aria-unknown", null],
    [undefined, null],
    ["", null],
  ])("rejects %s", (className, expected) => {
    expect(ariaBlockKindFromClassName(className as string | undefined)).toBe(
      expected,
    );
  });
});

describe("parseAriaBlock — checklist", () => {
  it("parses a happy-path checklist", () => {
    const out = parseAriaBlock(
      "checklist",
      JSON.stringify({
        title: "Pre-flight",
        items: [
          { label: "Visa expiry >= 90 days", checked: true },
          { label: "Itinerary booked" },
        ],
      }),
    );
    expect(out?.kind).toBe("checklist");
    const payload = out?.payload as ChecklistPayload;
    expect(payload.title).toBe("Pre-flight");
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0]).toEqual({
      label: "Visa expiry >= 90 days",
      checked: true,
    });
    expect(payload.items[1].checked).toBe(false);
  });

  it("drops items without a label string", () => {
    const out = parseAriaBlock(
      "checklist",
      JSON.stringify({
        items: [
          { label: "Real item" },
          { label: 42 },
          { checked: true },
          { label: "  " },
        ],
      }),
    );
    const payload = out?.payload as ChecklistPayload;
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].label).toBe("Real item");
  });

  it("returns null when items is missing or not an array", () => {
    expect(parseAriaBlock("checklist", "{}")).toBeNull();
    expect(parseAriaBlock("checklist", '{"items":"nope"}')).toBeNull();
  });

  it("returns null on invalid JSON", () => {
    expect(parseAriaBlock("checklist", "{not json")).toBeNull();
  });
});

describe("parseAriaBlock — kpi-tiles", () => {
  it("parses 3 tiles with optional hint", () => {
    const out = parseAriaBlock(
      "kpi-tiles",
      JSON.stringify({
        tiles: [
          { label: "Booked time", value: "11.6h" },
          { label: "Events", value: "16", hint: "This week" },
        ],
      }),
    );
    const payload = out?.payload as KpiTilesPayload;
    expect(payload.tiles).toHaveLength(2);
    expect(payload.tiles[1].hint).toBe("This week");
  });

  it("rejects tiles missing label or value", () => {
    const out = parseAriaBlock(
      "kpi-tiles",
      JSON.stringify({
        tiles: [{ label: "Only label" }, { value: "12" }, {}],
      }),
    );
    expect(out).toBeNull();
  });
});

describe("parseAriaBlock — actions", () => {
  it("parses actions and defaults variant to outline", () => {
    const out = parseAriaBlock(
      "actions",
      JSON.stringify({
        actions: [
          { label: "Fix conflict", prompt: "Resolve overlap" },
          {
            label: "Block focus",
            prompt: "Block deep work",
            variant: "default",
          },
        ],
      }),
    );
    const payload = out?.payload as ActionsPayload;
    expect(payload.actions).toHaveLength(2);
    expect(payload.actions[0].variant).toBe("outline");
    expect(payload.actions[1].variant).toBe("default");
  });

  it("drops actions without both label and prompt", () => {
    const out = parseAriaBlock(
      "actions",
      JSON.stringify({
        actions: [
          { label: "no prompt" },
          { prompt: "no label" },
          { label: "good", prompt: "yes" },
        ],
      }),
    );
    const payload = out?.payload as ActionsPayload;
    expect(payload.actions).toHaveLength(1);
    expect(payload.actions[0].label).toBe("good");
  });

  it("normalises unknown variant to outline", () => {
    const out = parseAriaBlock(
      "actions",
      JSON.stringify({
        actions: [{ label: "x", prompt: "y", variant: "destructive" }],
      }),
    );
    const payload = out?.payload as ActionsPayload;
    expect(payload.actions[0].variant).toBe("outline");
  });
});

describe("extractPartialActions — truncated streaming JSON", () => {
  it("recovers complete chips from a mid-stream payload", () => {
    const raw = `{
  "actions": [
    {
      "label": "List expiring visas requiring renewal",
      "prompt": "Show me all five expiring visa records with holder names."
    },
    {
      "label": "Review pending expense reports",
      "prompt": "List the eight pending expense reports with owner names."
    },
    {
      "label":`;
    const out = extractPartialActions(raw);
    const payload = out?.payload as ActionsPayload;
    expect(payload.actions).toHaveLength(2);
    expect(payload.actions[0].label).toBe(
      "List expiring visas requiring renewal",
    );
    expect(payload.actions[1].label).toBe("Review pending expense reports");
  });

  it("returns null when no complete action object has arrived yet", () => {
    expect(extractPartialActions(`{"actions": [ { "label":`)).toBeNull();
  });

  it("returns null when there is no array opening at all", () => {
    expect(extractPartialActions("not even close to json")).toBeNull();
  });

  it("ignores `{` and `}` inside string literals", () => {
    const raw = `{
  "actions": [
    { "label": "Brace { in label", "prompt": "Close } in prompt" },
    { "label":`;
    const out = extractPartialActions(raw);
    const payload = out?.payload as ActionsPayload;
    expect(payload.actions).toHaveLength(1);
    expect(payload.actions[0].label).toBe("Brace { in label");
    expect(payload.actions[0].prompt).toBe("Close } in prompt");
  });

  it("handles escaped quotes inside string literals", () => {
    const raw = `{ "actions": [ { "label": "say \\"hi\\"", "prompt": "do it" }, { "label":`;
    const out = extractPartialActions(raw);
    const payload = out?.payload as ActionsPayload;
    expect(payload.actions).toHaveLength(1);
    expect(payload.actions[0].label).toBe(`say "hi"`);
  });
});
