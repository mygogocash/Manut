import { expect, test } from "@playwright/test";

// Phase 7E — verification on the real iOS engine.
//
// Everything the responsive programme has claimed about mobile behaviour was
// measured in a desktop Chromium at an emulated width. Two claims in particular
// could not be checked that way and are the reason this file exists:
//
//   1. Phase 8 raised task-detail fields to 16px so iOS Safari does not zoom on
//      focus. That is a WebKit behaviour.
//   2. Phase 7D moved `touch-action: none` onto a drag handle so a card can be
//      dragged by touch. That half was verified during Phase 7E against a
//      temporary harness and is recorded there; it is not kept here because it
//      needed a route that must not ship. Re-creating it needs an authenticated
//      fixture — see PHASE_7E "recommended next phase".
//
// This is WEBKIT DEVICE EMULATION, not a physical iPhone. It runs the same
// engine Safari runs and dispatches real touch events; it does not reproduce
// iOS itself. Claims below are worded accordingly.

test.describe("iOS input zoom threshold", () => {
  test("every focusable text field on sign-in is at least 16px", async ({
    page,
  }) => {
    // A real, unauthenticated page. iOS Safari zooms the viewport when a
    // focused input is under 16px and does not zoom back out, so this is the
    // one place the whole responsive programme's input rule can be checked on
    // the actual engine without a session.
    await page.goto("/sign-in");
    const sizes = await page.$$eval("input, textarea", (els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => ({
          type: (e as HTMLInputElement).type,
          px: parseFloat(getComputedStyle(e).fontSize),
        })),
    );
    expect(sizes.length).toBeGreaterThan(0);

    // Phase 7F changed the rule from `md:text-sm` to `md:pointer-fine:text-sm`,
    // so the 16px floor now holds on ANY touch device at ANY width — including
    // the iPad Mini profile at 768px, which is what made this a skip until
    // then. Asserted unconditionally on a coarse pointer; a mouse-driven
    // context keeps the smaller desktop size and is exempt.
    const coarse = await page.evaluate(
      () => matchMedia("(pointer: coarse)").matches,
    );
    expect(coarse, "these profiles are touch devices").toBe(true);
    for (const f of sizes) {
      expect(f.px, `${f.type} is ${f.px}px`).toBeGreaterThanOrEqual(16);
    }
  });
});
