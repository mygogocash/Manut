import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectRequestsPage from "@/app/(dashboard)/projects/requests/page";
import type {
  getWorkflowQueue as GetWorkflowQueue,
  WorkflowQueueRow,
} from "@/services/workflow.service";

// The Project Requests queue, at both widths.
//
// The property this file protects is the one an approver depends on: the same
// request, with the same decision available, whichever device they open it on.
// A card that drops a column is a person deciding on partial information; a
// card that buries Approve behind an expander is a decision they will not make
// from their phone at all.

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    hasAnyPermission: () => true,
    isSystemAdmin: false,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

const getWorkflowQueue = vi.fn();
// Only the fetch is replaced. The status tones, labels and types the page
// renders with stay real, so a card is checked against the module's own
// vocabulary rather than against a copy of it made here.
vi.mock("@/services/workflow.service", async () => {
  const actual = await vi.importActual<{
    getWorkflowQueue: typeof GetWorkflowQueue;
  }>("@/services/workflow.service");
  return {
    ...actual,
    getWorkflowQueue: (view: string) => getWorkflowQueue(view),
  };
});

const ROWS: WorkflowQueueRow[] = [
  {
    id: "p-1",
    name: "Wallet integration",
    department: "Product",
    status: "pending_pm_approval",
    label: "Pending Approval",
    owner: "Priya Sharma",
    goLiveDate: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    availableActions: ["approve", "reject"],
  },
  {
    id: "p-2",
    name: "Payroll import",
    department: null,
    status: "approved",
    label: "Approved",
    owner: "Kunanon T.",
    // A request with no go-live date. This row exists to prove the empty
    // placeholder renders as a dash rather than a stray comma.
    goLiveDate: null,
    updatedAt: "2026-08-21T00:00:00.000Z",
    availableActions: [],
  },
];

/** Points `matchMedia` at a viewport width so the layout hooks resolve. */
function setViewport(width: number) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      const min = /min-width:\s*(\d+)px/.exec(query);
      return {
        matches: max
          ? width <= Number(max[1])
          : min
            ? width >= Number(min[1])
            : false,
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

beforeEach(() => {
  vi.clearAllMocks();
  getWorkflowQueue.mockResolvedValue({
    data: {
      counts: { list: 2, mine: 1, pending: 1, completed: 0, rejected: 0 },
      rows: ROWS,
    },
  });
});

/* ── Desktop ────────────────────────────────────────────────────────── */

describe("the queue on a desktop", () => {
  beforeEach(() => setViewport(1440));

  it("still renders a table", async () => {
    render(<ProjectRequestsPage />);
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("keeps every column heading", async () => {
    render(<ProjectRequestsPage />);
    await screen.findByRole("table");
    for (const header of [
      "Request",
      "Owner",
      "Status",
      "Go Live",
      "Updated",
      "Actions",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }
  });
});

/* ── Mobile ─────────────────────────────────────────────────────────── */

describe("the queue on a phone", () => {
  beforeEach(() => setViewport(375));

  it("renders cards rather than a table", async () => {
    render(<ProjectRequestsPage />);
    await screen.findByText("Wallet integration");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps the decision one tap away, not behind the expander", async () => {
    // The whole point of the conversion. Row p-1 offers approve/reject, so its
    // action trigger must be on the face of the card.
    render(<ProjectRequestsPage />);
    await screen.findByText("Wallet integration");
    expect(
      screen.getByRole("button", { name: /request actions/i }),
    ).toBeInTheDocument();
  });

  it("accounts for every column the table would have shown", async () => {
    render(<ProjectRequestsPage />);
    await screen.findByText("Wallet integration");
    // Title and badge carry Request and Status; the rest are labelled fields.
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
    expect(screen.getAllByText("Owner").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Go Live").length).toBeGreaterThan(0);

    // "Updated" is the one deliberately behind the expander.
    expect(screen.queryByText("Updated")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /show more/i })[0]!);
    expect(screen.getAllByText("Updated").length).toBeGreaterThan(0);
  });

  it("renders a missing date as a dash, not a stray comma", async () => {
    // Regression on commit 900c6c9a, which replaced the em dash used as an
    // empty-value placeholder while removing em dashes from prose.
    render(<ProjectRequestsPage />);
    await screen.findByText("Payroll import");
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText(", ")).not.toBeInTheDocument();
  });

  it("offers no action control on a row with no available action", async () => {
    // Row p-2 is approved with nothing available; the card must not imply
    // otherwise. Presentation follows the API, which is the boundary.
    render(<ProjectRequestsPage />);
    await screen.findByText("Payroll import");
    expect(
      screen.getAllByRole("button", { name: /request actions/i }),
    ).toHaveLength(1);
  });
});

/* ── Tablet ─────────────────────────────────────────────────────────── */

describe("the queue on a tablet", () => {
  // Six columns need roughly 1,070px once requests have real names. Phase 7A
  // measured that and recorded it as a limitation: 768-1023px was a table
  // scrolling sideways, with the decision control scrolling off to the right.
  // This queue opts into `cardBreakpoint="lg"`; no other table moved.

  it("renders cards at 834px rather than a sideways-scrolling table", async () => {
    setViewport(834);
    render(<ProjectRequestsPage />);
    await screen.findByText("Wallet integration");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /request actions/i }),
    ).toBeInTheDocument();
  });

  it("is still a table at 1024px", async () => {
    setViewport(1024);
    render(<ProjectRequestsPage />);
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});

/* ── Search and views ───────────────────────────────────────────────── */

describe("search and views", () => {
  beforeEach(() => setViewport(375));

  it("filters on request name and owner, as it does on desktop", async () => {
    render(<ProjectRequestsPage />);
    await screen.findByText("Wallet integration");
    fireEvent.change(screen.getByPlaceholderText(/search request or owner/i), {
      target: { value: "kunanon" },
    });
    expect(screen.queryByText("Wallet integration")).not.toBeInTheDocument();
    expect(screen.getByText("Payroll import")).toBeInTheDocument();
  });

  it("does not shrink the search box below the iOS zoom threshold", () => {
    // An input under 16px makes Safari zoom the page in on focus, and it does
    // not zoom back out. Only the UNPREFIXED size matters: `md:text-sm` applies
    // from 768px up, which is not a phone, so the pattern must not match it.
    render(<ProjectRequestsPage />);
    const classes = screen
      .getByPlaceholderText(/search request or owner/i)
      .className.split(/\s+/);
    expect(classes).toContain("text-base");
    expect(classes).not.toContain("text-sm");
    expect(classes).not.toContain("text-xs");
  });

  it("exposes the five views as a tablist", async () => {
    render(<ProjectRequestsPage />);
    await screen.findByText("Wallet integration");
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });

  it("refetches when the view changes", async () => {
    render(<ProjectRequestsPage />);
    await screen.findByText("Wallet integration");
    getWorkflowQueue.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: /completed/i }));
    await waitFor(() =>
      expect(getWorkflowQueue).toHaveBeenCalledWith("completed"),
    );
  });
});
