import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Phase 9A — every user-facing combobox has an accessible name.
//
// `role="combobox"` is "name from author" only: it NEVER takes its name from
// content. So a trigger reading "All statuses" is an unnamed control. Measured
// with axe across the real primitives: 265 of the 444 triggers in this app had
// no name at all — 176 completely bare, and 87 sitting next to a visual
// `<Label>` that had no `htmlFor` and therefore named nothing.
//
// The fix is in `SelectTrigger`: when a trigger has no `aria-label`, no
// `aria-labelledby` and no `id`, it borrows its `SelectValue`'s `placeholder`.
// That is the developer's own description of the control, and it named 172 of
// the 265 with no consumer change and no visual change.
//
// The `id` condition is the load-bearing part. `FormControl` passes `id` so a
// visible `<FormLabel htmlFor>` resolves, and `aria-label` OUTRANKS `label for`
// in name computation — so without that condition this change would have
// replaced 168 real visible labels with their placeholders.
//
// The invariant asserted here is "has an accessible name", never "has an
// aria-label": an associated visible label is the better answer and must keep
// passing.

function Options() {
  return (
    <SelectContent>
      <SelectItem value="a">Alpha</SelectItem>
    </SelectContent>
  );
}

/** The accessible name testing-library computes, using the same rules axe does. */
function nameOf(): string {
  const el = screen.getByRole("combobox");
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
  }
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return (label.textContent ?? "").trim();
  }
  return ""; // combobox takes NO name from content
}

describe("a combobox always has an accessible name", () => {
  it("a bare filter borrows its placeholder", () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger>
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <Options />
      </Select>,
    );
    expect(nameOf()).toBe("All statuses");
  });

  it("a select next to a visual Label still gets named", () => {
    // The 87-occurrence pattern: a <Label> with no htmlFor names nothing.
    render(
      <div>
        <Label>Filter</Label>
        <Select defaultValue="a">
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <Options />
        </Select>
      </div>,
    );
    expect(nameOf()).toBe("Filter by status");
  });

  it("an explicit aria-label wins over the placeholder", () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger aria-label="Filter grants by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <Options />
      </Select>,
    );
    expect(nameOf()).toBe("Filter grants by status");
  });

  it("an explicit aria-labelledby wins over the placeholder", () => {
    render(
      <div>
        <span id="lb">Currency</span>
        <Select defaultValue="a">
          <SelectTrigger aria-labelledby="lb">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <Options />
        </Select>
      </div>,
    );
    expect(nameOf()).toBe("Currency");
  });

  it("an associated visible label is NOT replaced by the placeholder", () => {
    // The regression this change could have caused: `aria-label` outranks
    // `label for`, so a placeholder default must never reach a trigger that
    // already has an id a label points at.
    render(
      <div>
        <Label htmlFor="entity-select">Entity</Label>
        <Select defaultValue="a">
          <SelectTrigger id="entity-select">
            <SelectValue placeholder="Pick an entity" />
          </SelectTrigger>
          <Options />
        </Select>
      </div>,
    );
    const el = screen.getByRole("combobox");
    expect(el.getAttribute("aria-label")).toBeNull();
    expect(nameOf()).toBe("Entity");
  });

  it("a form select keeps its FormLabel, not its placeholder", () => {
    function Harness() {
      const form = useForm<{ department: string }>({
        defaultValues: { department: "a" },
      });
      return (
        <Form {...form}>
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a department" />
                    </SelectTrigger>
                  </FormControl>
                  <Options />
                </Select>
              </FormItem>
            )}
          />
        </Form>
      );
    }
    render(<Harness />);
    const el = screen.getByRole("combobox");
    expect(el.getAttribute("aria-label")).toBeNull();
    expect(nameOf()).toBe("Department");
  });

  it("a trigger with no placeholder and no label is still unnamed", () => {
    // Not a tautology: this documents the 89 the primitive cannot reach, so the
    // guard below cannot be mistaken for full coverage.
    render(
      <Select defaultValue="a">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <Options />
      </Select>,
    );
    expect(nameOf()).toBe("");
  });
});

/* -------------------------------------------------------------------------- */
/* Source guard: the primitive keeps the fallback and keeps the id condition   */
/* -------------------------------------------------------------------------- */

const SRC = resolve(__dirname, "../../..");

describe("the primitive keeps its naming fallback", () => {
  const source = readFileSync(resolve(SRC, "components/ui/select.tsx"), "utf8");

  it("still derives a name from the placeholder", () => {
    expect(source).toContain("placeholderLabel");
    expect(source).toContain("aria-label={placeholderLabel}");
  });

  it("still skips triggers that carry an id", () => {
    // Removing this re-breaks 168 correctly-labelled form selects.
    expect(source).toMatch(/props\["aria-label"\][\s\S]{0,60}props\.id/);
  });
});

/* -------------------------------------------------------------------------- */
/* Every dashboard route has a page-level heading                             */
/* -------------------------------------------------------------------------- */

const DASHBOARD = resolve(SRC, "app/(dashboard)");

/**
 * Routes that legitimately render no heading of their own, each with a reason.
 * Part H explicitly allows exceptions; it does not allow unexplained ones.
 */
const NO_HEADING_EXPECTED: Record<string, string> = {
  "deals/page.tsx": "a bare redirect() to /sales — renders no markup at all",
};

function routes(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) routes(p, out);
    else if (entry === "page.tsx") out.push(p);
  }
  return out;
}

/**
 * Routes whose page heading is rendered by a named delegate rather than by the
 * route file. Named explicitly, one entry per route, because the obvious
 * implementation — "follow any imported component and look for an h1" — is too
 * permissive to be a guard: the first draft of this test passed `/messages`
 * with its own `<h1>` deleted, having found a heading inside a chat sidebar
 * widget. An allowlist cannot be fooled that way, and it has to be read to be
 * extended.
 */
const HEADING_FROM_DELEGATE: Record<string, string> = {
  "projects/page.tsx": "projects/projects-view.tsx",
  "hr-crm/page.tsx": "projects/projects-view.tsx",
  "accounting-crm/page.tsx": "accounting-crm/accounting-crm-list.tsx",
  "it-crm/page.tsx": "it-crm/it-crm-list.tsx",
  "legal-crm/page.tsx": "legal-crm/legal-crm-list.tsx",
  "product-crm/page.tsx": "product-crm/product-crm-list.tsx",
  "qa-crm/page.tsx": "qa-crm/qa-crm-list.tsx",
  "qa-crm/[projectId]/page.tsx": "qa-crm/qa-crm-issue-table.tsx",
  "voucher-crm/page.tsx": "voucher-crm/voucher-crm-list.tsx",
  "accounting/invoices/[id]/print/page.tsx": "accounting/invoice-print.tsx",
};

/** Does this specific file render a page-level heading of its own? */
function rendersHeading(file: string): boolean {
  const source = readFileSync(file, "utf8");
  // Match the RENDERED element, not the bare word. An earlier draft used
  // /\bPageHeader\b/ and passed `/messages` with its `<h1>` deleted, because a
  // prose comment in that file mentions PageHeader.
  return /<h1[\s>]/.test(source) || /<PageHeader[\s/>]/.test(source);
}

describe("every dashboard route exposes a page heading", () => {
  const all = routes(DASHBOARD);
  const missing: string[] = [];
  const brokenDelegate: string[] = [];

  for (const file of all) {
    const rel = file.slice(DASHBOARD.length + 1).replace(/\\/g, "/");
    if (rel in NO_HEADING_EXPECTED) continue;

    const delegate = HEADING_FROM_DELEGATE[rel];
    if (delegate) {
      const target = resolve(SRC, "components", delegate);
      if (!rendersHeading(target)) brokenDelegate.push(`${rel} -> ${delegate}`);
      continue;
    }
    if (!rendersHeading(file)) missing.push(rel);
  }

  it("finds the routes it is meant to be guarding", () => {
    // Guards the guard. 104 at the time of writing.
    expect(all.length).toBeGreaterThan(90);
  });

  it("has no route without an h1 or a PageHeader", () => {
    expect(
      missing,
      `these routes render no page-level heading, so a screen-reader user ` +
        `cannot tell what page they are on. Use the canonical ` +
        `shared/page-header.tsx (it renders the h1); add an sr-only <h1> where ` +
        `a visible title would break the layout; or, if the heading comes from ` +
        `a component, add the route to HEADING_FROM_DELEGATE naming it:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every named delegate still renders the heading", () => {
    expect(
      brokenDelegate,
      `these routes rely on a component for their page heading and that ` +
        `component no longer renders one:\n  ${brokenDelegate.join("\n  ")}`,
    ).toEqual([]);
  });
});
