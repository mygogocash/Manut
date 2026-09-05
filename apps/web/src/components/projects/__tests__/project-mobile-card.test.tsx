import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectMobileCard } from "@/components/projects/project-mobile-card";
import type { ProjectColKey } from "@/components/projects/projects-view-cells";

// The Project CRM list, as cards.
//
// The property that matters most is NOT how the card looks — it is that the
// card and the table show the same record. Nine columns become a title, a
// badge, two visible fields and an expansion; if a column silently fell out of
// that mapping, a mobile user would be making decisions on partial data without
// knowing it. Several of these tests exist purely to make that impossible.

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const ALL_COLS: ProjectColKey[] = [
  "project",
  "status",
  "productionLive",
  "goLive",
  "revGoLive",
  "agreement",
  "dependency",
  "comment",
  "owner",
];

/* eslint-disable @typescript-eslint/no-explicit-any */
const project = {
  id: "p1",
  slug: "wallet-integration",
  name: "Wallet integration",
  description: "Finance reconciliation pipeline",
  status: "in_progress",
  productionLiveDate: "2026-09-01T00:00:00.000Z",
  goLiveDate: "2026-09-30T00:00:00.000Z",
  revisedGoLiveDate: null,
  agreement: "signed",
  dependency: "Awaiting the partner sandbox",
  comment: "<p>Blocked on finance sign-off</p>",
  owner: { name: "Priya Sharma" },
} as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const noop = () => {};
const base = {
  project,
  index: 3,
  visibleCols: ALL_COLS,
  team: "general" as const,
  canManageRow: true,
  isArchivedView: false,
  onView: noop,
  onEdit: noop,
  onArchive: noop,
  onUnarchive: noop,
  onDelete: noop,
};

describe("what the collapsed card shows", () => {
  it("leads with the project name and its row number", () => {
    render(<ProjectMobileCard {...base} />);
    expect(screen.getByText("Wallet integration")).toBeInTheDocument();
    // The `#` column exists on desktop; losing it would make the two views
    // disagree about which row is which across pages.
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the status badge, using the module's own status vocabulary", () => {
    render(<ProjectMobileCard {...base} />);
    // "in_progress" is a real Project CRM status; the label comes from the
    // module's own `projectStatusLabel`, not from an invented mapping.
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("puts owner and go-live on the face of the card", () => {
    render(<ProjectMobileCard {...base} />);
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("GoLive Date")).toBeInTheDocument();
  });

  it("keeps secondary columns out of the collapsed view", () => {
    render(<ProjectMobileCard {...base} />);
    expect(screen.queryByText("Dependency")).not.toBeInTheDocument();
    expect(screen.queryByText("Comment")).not.toBeInTheDocument();
  });
});

describe("nothing is dropped", () => {
  // The important one. Every column the table would render must be reachable.
  it("accounts for every visible column somewhere on the card", () => {
    render(<ProjectMobileCard {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    // `project` is the title and `status` is the badge; every other column
    // appears as a labelled field, on the face or in the expansion.
    const expected = [
      "Production Live",
      "GoLive Date",
      "Rev. GoLive",
      "Agreement",
      "Dependency",
      "Comment",
      "Owner",
    ];
    for (const label of expected) {
      expect(screen.getByText(label), `${label} is missing`).toBeInTheDocument();
    }
  });

  it("renders comment content as text, not raw HTML", () => {
    render(<ProjectMobileCard {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    // The table strips HTML for the same field; the card must not render a
    // stored `<p>` as markup.
    expect(screen.getByText("Blocked on finance sign-off")).toBeInTheDocument();
    expect(screen.queryByText("<p>")).not.toBeInTheDocument();
  });

  it("respects the layout's visible-column list rather than assuming nine", () => {
    // HR and Legal layouts show different columns. The card takes the same
    // list the table does, so a hidden column stays hidden.
    render(
      <ProjectMobileCard
        {...base}
        visibleCols={["project", "status", "owner"]}
      />,
    );
    expect(screen.queryByText("Agreement")).not.toBeInTheDocument();
    expect(screen.queryByText("Dependency")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /show more/i }),
    ).not.toBeInTheDocument();
  });
});

describe("actions mirror the table row", () => {
  it("opens the project from the card body", () => {
    const onView = vi.fn();
    render(<ProjectMobileCard {...base} onView={onView} />);
    fireEvent.click(screen.getByText("Wallet integration"));
    expect(onView).toHaveBeenCalled();
  });

  it("offers View, and demotes the rest into the overflow", () => {
    render(<ProjectMobileCard {...base} />);
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    // Demoted, not removed.
    expect(
      screen.getByRole("button", { name: /more actions/i }),
    ).toBeInTheDocument();
  });

  it("hides management actions from a user who may not manage the row", () => {
    // Presentation follows the same check the table row uses. The API remains
    // the boundary; this only stops offering something that would be refused.
    render(<ProjectMobileCard {...base} canManageRow={false} />);
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /more actions/i }),
    ).not.toBeInTheDocument();
  });

  it("offers Unarchive rather than Archive in the archived view", () => {
    const onUnarchive = vi.fn();
    render(
      <ProjectMobileCard
        {...base}
        isArchivedView
        onUnarchive={onUnarchive}
        visibleCols={["project", "status"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    expect(screen.getByText("Unarchive")).toBeInTheDocument();
    expect(screen.queryByText("Archive")).not.toBeInTheDocument();
  });

  it("omits Move when the user cannot move between workspaces", () => {
    render(<ProjectMobileCard {...base} visibleCols={["project", "status"]} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    expect(screen.queryByText("Move")).not.toBeInTheDocument();
  });
});
