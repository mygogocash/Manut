import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import {
  formatCurrency,
  formatMonthLabel,
  timeAgo,
} from "@/components/dashboard/dashboard-utils";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Dashboard conversion, Phase 5.
//
// The dashboard page itself is a 1,055-line client component that fetches on
// mount; rendering it here would mostly test mocks. So these cover the parts
// that carry the responsive contract and the value formatting, which is where
// the real defect was.
//
// What is NOT covered: that the page renders after login with real data. That
// needs a session and is on the human checklist in
// docs/pwa/PHASE_5_DASHBOARD.md.

describe("KPI value formatting", () => {
  // The bug this phase fixed. The scale stopped at millions, so a trillion kept
  // counting in millions and produced a twelve-character string that broke the
  // card on a phone — Step 21's own example.
  it("keeps very large figures short", () => {
    expect(formatCurrency(18_000_000_000_000)).toBe("$18.0T");
    expect(formatCurrency(18_000_000_000)).toBe("$18.0B");
    expect(formatCurrency(4_200_000)).toBe("$4.2M");
    expect(formatCurrency(12_500)).toBe("$12.5K");
    expect(formatCurrency(850)).toBe("$850");
  });

  it("never exceeds the width a KPI card can hold", () => {
    // Six characters plus a sign is what the narrowest card fits at 320px.
    for (const v of [0, 999, 1_000, 999_999, 1e6, 1e9, 1e12, 9.99e14]) {
      expect(formatCurrency(v).length).toBeLessThanOrEqual(7);
    }
  });

  it("formats negatives by magnitude instead of printing $-4200000", () => {
    expect(formatCurrency(-4_200_000)).toBe("-$4.2M");
    expect(formatCurrency(-850)).toBe("-$850");
  });

  it("promotes a value that rounds out of its tier", () => {
    // 999,999 is below a million, so it lands in the K tier and rounds to
    // 1000.0 — which used to print "$1000.0K". It should read as a million.
    expect(formatCurrency(999_999)).toBe("$1.0M");
    expect(formatCurrency(999_999_999)).toBe("$1.0B");
    expect(formatCurrency(1_000_000)).toBe("$1.0M");
    expect(formatCurrency(0)).toBe("$0");
    expect(formatCurrency(999)).toBe("$999");
  });

  it("still abbreviates months and relative times as before", () => {
    expect(formatMonthLabel("2026-03")).toBe("Mar");
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe(
      "5m ago",
    );
  });
});

describe("StatCard", () => {
  const base = {
    label: "Pending expenses",
    value: "$18.0T",
    change: "+12% vs last month",
    changeType: "up" as const,
    icon: Wallet,
  };

  it("shows the label, the value and the context line", () => {
    render(<StatCard {...base} />);
    expect(screen.getByText("Pending expenses")).toBeInTheDocument();
    expect(screen.getByText("$18.0T")).toBeInTheDocument();
    expect(screen.getByText("+12% vs last month")).toBeInTheDocument();
  });

  // Step 20: a card that does nothing must not look like it does.
  it("is a link only when given a destination", () => {
    const { container, unmount } = render(<StatCard {...base} />);
    expect(container.querySelector("a")).toBeNull();
    unmount();

    render(<StatCard {...base} href="/expenses" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/expenses");
  });

  it("lets a long value wrap rather than clipping it", () => {
    // `break-anywhere` plus `leading-tight`: the figure has to go somewhere, and
    // silently cutting a number in half is worse than two lines.
    render(<StatCard {...base} value="18,000,000,000,000" />);
    const value = screen.getByText("18,000,000,000,000");
    expect(value.className).toContain("break-anywhere");
    expect(value.className).not.toContain("truncate");
  });

  it("scales the value and the icon down on small screens", () => {
    // The card is ~138px wide in a two-up grid at 320px; a 44px icon and 20px
    // of side padding left the number about 42px, which nothing fits into.
    const { container } = render(<StatCard {...base} />);
    const value = screen.getByText("$18.0T");
    expect(value.className).toMatch(/text-\[22px\]/);
    expect(value.className).toMatch(/sm:text-\[28px\]/);

    const icon = container.querySelector('[class*="size-8"]');
    expect(icon, "icon block should start at size-8").not.toBeNull();
    expect(icon?.className).toMatch(/sm:size-11/);
  });

  it("keeps the value column shrinkable, so truncation can work at all", () => {
    // Without min-w-0 a flex child refuses to shrink below its content and
    // pushes the card wider than its grid cell.
    const { container } = render(<StatCard {...base} />);
    expect(container.querySelector(".min-w-0")).not.toBeNull();
  });

  it("marks the trend arrow decorative, not as content", () => {
    const { container } = render(<StatCard {...base} />);
    // The direction is already stated in the change text; announcing an arrow
    // as well is noise.
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("SectionCard", () => {
  it("renders its title as a heading and hosts an action slot", () => {
    render(
      <SectionCard
        title="Leave queue"
        icon={<Wallet className="size-4" />}
        action={<button>View all</button>}
      >
        <p>rows</p>
      </SectionCard>,
    );
    expect(screen.getByText("Leave queue")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View all" }),
    ).toBeInTheDocument();
    expect(screen.getByText("rows")).toBeInTheDocument();
  });
});
