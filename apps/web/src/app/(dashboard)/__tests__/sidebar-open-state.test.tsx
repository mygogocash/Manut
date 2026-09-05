import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";

import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";

// Phase 12 — the desktop sidebar started collapsed at every width.
//
// `(dashboard)/layout.tsx` wanted "collapsed on tablet, expanded on desktop"
// and wrote `<SidebarProvider defaultOpen={isWide}>`, with a comment saying the
// sidebar would "settle open on desktop after mount". It cannot settle:
//
//   1. `useIsAtLeast("xl")` is `useState(false)` + an effect, so it is `false`
//      on the first render at EVERY width;
//   2. `SidebarProvider` does `useState(defaultOpen)` — an initial value, read
//      once and never again;
//   3. the provider has no effect that syncs `defaultOpen` afterwards, and the
//      `sidebar_state` cookie it writes is read nowhere in the codebase.
//
// So `open` was pinned `false`, `state` resolved to "collapsed", and with
// `collapsible="icon"` a 1920px desktop rendered the icon rail on every page
// load — the labelled sidebar desktop has always had, gone.
//
// The first two tests pin the React semantics that caused it. The third pins
// the fix: the provider must be CONTROLLED from the layout.

function StateProbe() {
  const { state } = useSidebar();
  return <span data-testid="state">{state}</span>;
}

// `state` is what `<Sidebar collapsible="icon">` reads to decide between the
// full sidebar and the icon rail, so asserting it is asserting what the user
// sees.

describe("defaultOpen is an initial value, not a binding", () => {
  it("ignores a defaultOpen that flips from false to true after mount", () => {
    // Exactly what `defaultOpen={isWide}` does: false on first render, true
    // once the media query resolves.
    function LateWidth() {
      const [isWide, setIsWide] = useState(false);
      useEffect(() => setIsWide(true), []);
      return (
        <SidebarProvider defaultOpen={isWide}>
          <StateProbe />
        </SidebarProvider>
      );
    }

    render(<LateWidth />);

    expect(
      screen.getByTestId("state").textContent,
      "If this reads 'expanded', SidebarProvider has gained a sync effect and " +
        "the layout could go back to `defaultOpen`. Until then it cannot.",
    ).toBe("collapsed");
  });

  it("does track an `open` prop that flips after mount", () => {
    function LateWidthControlled() {
      const [open, setOpen] = useState(false);
      useEffect(() => setOpen(true), []);
      return (
        <SidebarProvider open={open} onOpenChange={setOpen}>
          <StateProbe />
        </SidebarProvider>
      );
    }

    render(<LateWidthControlled />);

    expect(screen.getByTestId("state").textContent).toBe("expanded");
  });
});

describe("the dashboard layout drives the sidebar as a controlled component", () => {
  const source = readFileSync(
    resolve(__dirname, "../layout.tsx"),
    "utf8",
  );

  it("does not hand a media-query result to defaultOpen", () => {
    expect(
      /defaultOpen=\{(?!true\})/.test(source),
      "`defaultOpen` is read once, on the first render, when every media-query " +
        "hook here still reports false. Passing `isWide` to it collapses the " +
        "desktop sidebar permanently. Use `open` + `onOpenChange`.",
    ).toBe(false);
  });

  it("passes open and onOpenChange", () => {
    expect(source).toMatch(/<SidebarProvider[\s\S]{0,200}?\bopen=\{/);
    expect(source).toMatch(/<SidebarProvider[\s\S]{0,200}?\bonOpenChange=\{/);
  });

  it("syncs that state from the breakpoint in an effect", () => {
    // The effect is the part that makes desktop settle open after mount.
    expect(source).toMatch(/useEffect\(\s*\(\)\s*=>\s*setSidebarOpen\(isWide\)/);
  });
});
