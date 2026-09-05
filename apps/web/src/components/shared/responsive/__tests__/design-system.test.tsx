import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataCard } from "@/components/shared/responsive/data-card";
import {
  FilterChip,
  FilterGroup,
} from "@/components/shared/responsive/filters";
import { LoadingButton } from "@/components/shared/responsive/loading";
import { RecordCard } from "@/components/shared/responsive/record-card";
import { SearchInput } from "@/components/shared/responsive/search-input";
import { StateView } from "@/components/shared/responsive/state-view";
import {
  normalizeStatus,
  StatusBadge,
  statusTone,
} from "@/components/shared/responsive/status-badge";

// Phase 2 components. The emphasis is on behaviour and accessibility contracts
// rather than markup — a snapshot of these would break on every style tweak
// while proving nothing about whether they work.

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

/* ── Status badges ─────────────────────────────────────────────────── */

describe("status tone mapping", () => {
  it("normalises the separators modules actually use", () => {
    expect(normalizeStatus("pending_approval")).toBe("pending approval");
    expect(normalizeStatus("Pending-Approval")).toBe("pending approval");
    expect(normalizeStatus("  PENDING   APPROVAL ")).toBe("pending approval");
  });

  it("maps outcomes to the right semantic tone", () => {
    expect(statusTone("approved")).toBe("success");
    expect(statusTone("pending_approval")).toBe("warning");
    expect(statusTone("rejected")).toBe("danger");
    expect(statusTone("draft")).toBe("neutral");
    expect(statusTone("pending_development")).toBe("info");
  });

  // A phase label must never read as an outcome — that is the whole reason
  // violet exists in the palette.
  it("gives non-status categories a tone that carries no outcome", () => {
    expect(statusTone("uat")).toBe("violet");
    expect(statusTone("planning")).toBe("violet");
  });

  it("falls back to neutral rather than guessing", () => {
    expect(statusTone("some_module_specific_state")).toBe("neutral");
  });

  it("renders an unmapped status readably instead of raw", () => {
    render(<StatusBadge status="pending_ceo_approval" />);
    expect(screen.getByText("Pending Ceo Approval")).toBeInTheDocument();
  });

  it("lets a module override the tone and the label", () => {
    render(<StatusBadge status="approved" tone="violet" label="Signed off" />);
    expect(screen.getByText("Signed off")).toBeInTheDocument();
  });
});

/* ── Expandable record ─────────────────────────────────────────────── */

describe("RecordCard expansion", () => {
  const props = {
    title: "Wallet integration",
    fields: [{ label: "Owner", value: "Priya" }],
    details: [{ label: "Notes", value: "Blocked on finance" }],
  };

  it("hides details until expanded, in button mode", () => {
    render(<RecordCard {...props} />);
    expect(screen.queryByText("Blocked on finance")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getByText("Blocked on finance")).toBeInTheDocument();
  });

  it("exposes expansion state to assistive tech", () => {
    render(<RecordCard {...props} expandMode="row" />);
    const toggle = screen.getByRole("button", { expanded: false });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });

  // Keyboard support comes from using a real <button>, so this asserts the
  // element type rather than simulating keys the browser would handle.
  it("uses a real button for the row toggle, so Enter and Space work", () => {
    render(<RecordCard {...props} expandMode="row" />);
    expect(screen.getByRole("button", { expanded: false }).tagName).toBe(
      "BUTTON",
    );
  });

  it("keeps the row toggle and a card click from competing", () => {
    const onClick = vi.fn();
    render(<RecordCard {...props} expandMode="row" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    // The row expanded; it did not also fire the card's navigation.
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText("Blocked on finance")).toBeInTheDocument();
  });

  it("does not offer expansion with nothing to expand", () => {
    render(<RecordCard title="Solo" />);
    expect(
      screen.queryByRole("button", { name: /show more/i }),
    ).not.toBeInTheDocument();
  });

  it("shows an error in place of details rather than failing silently", () => {
    render(<RecordCard {...props} error="Could not load details" />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load details",
    );
  });

  it("blocks interaction when disabled", () => {
    render(<RecordCard {...props} expandMode="row" disabled />);
    expect(screen.getByRole("button", { expanded: false })).toBeDisabled();
  });

  // ── Row mode must not hide the action ──────────────────────────────
  //
  // Phase 7B-0 found this while migrating action columns: `row` mode gated the
  // action bar on `expanded`, so a card's PRIMARY action — Approve, on a record
  // waiting for a decision — was behind a tap. That is the same defect the
  // action role existed to fix, reintroduced by the other expand mode. It is
  // latent (no production consumer passes expandMode) which is exactly why it
  // is worth pinning: the next adopter would inherit it silently.

  it("shows the action while collapsed, in row mode", () => {
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={<button type="button">Approve</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("marks itself busy while loading", () => {
    const { container } = render(<RecordCard {...props} loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("Priya")).not.toBeInTheDocument();
  });
});

/* ── Cards ─────────────────────────────────────────────────────────── */

describe("DataCard", () => {
  it("renders the header parts it is given", () => {
    render(
      <DataCard title="Pipeline" subtitle="This quarter" meta="Sales">
        body
      </DataCard>,
    );
    expect(
      screen.getByRole("heading", { name: "Pipeline" }),
    ).toBeInTheDocument();
    expect(screen.getByText("This quarter")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
  });

  it("collapses without losing its header", () => {
    render(
      <DataCard title="Pipeline" collapsible defaultExpanded>
        body content
      </DataCard>,
    );
    fireEvent.click(screen.getByRole("button", { name: /collapse section/i }));
    expect(screen.queryByText("body content")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pipeline" }),
    ).toBeInTheDocument();
  });

  it("replaces the body while loading and keeps the card", () => {
    render(
      <DataCard title="Pipeline" loading>
        body content
      </DataCard>,
    );
    expect(screen.queryByText("body content")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pipeline" }),
    ).toBeInTheDocument();
  });
});

/* ── Search ────────────────────────────────────────────────────────── */

describe("SearchInput", () => {
  it("reports immediately with no debounce configured", () => {
    const onValueChange = vi.fn();
    render(<SearchInput value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "wa" },
    });
    expect(onValueChange).toHaveBeenCalledWith("wa");
  });

  it("offers a clear button only when there is something to clear", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <SearchInput value="" onValueChange={onValueChange} />,
    );
    expect(
      screen.queryByRole("button", { name: /clear search/i }),
    ).not.toBeInTheDocument();

    rerender(<SearchInput value="wallet" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("clears on Escape rather than blurring", () => {
    const onValueChange = vi.fn();
    render(<SearchInput value="wallet" onValueChange={onValueChange} />);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("has an accessible name even with only a placeholder", () => {
    render(
      <SearchInput
        value=""
        onValueChange={() => {}}
        placeholder="Find people"
      />,
    );
    expect(screen.getByLabelText("Find people")).toBeInTheDocument();
  });
});

/* ── Filters ───────────────────────────────────────────────────────── */

describe("FilterGroup", () => {
  const options = [
    { value: "active", label: "Active" },
    { value: "pending", label: "Pending" },
  ];

  it("uses radio semantics for single select", () => {
    render(
      <FilterGroup
        title="Status"
        options={options}
        selected="active"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Active" })).toBeChecked();
  });

  it("uses checkbox semantics for multi select and accumulates", () => {
    const onChange = vi.fn();
    render(
      <FilterGroup
        title="Status"
        options={options}
        selected={["active"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Pending" }));
    expect(onChange).toHaveBeenCalledWith(["active", "pending"]);
  });

  it("removes a value on a second toggle rather than re-adding it", () => {
    const onChange = vi.fn();
    render(
      <FilterGroup
        title="Status"
        options={options}
        selected={["active", "pending"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    expect(onChange).toHaveBeenCalledWith(["pending"]);
  });

  it("offers an All entry that clears the group", () => {
    const onChange = vi.fn();
    render(
      <FilterGroup
        title="Status"
        options={options}
        selected="active"
        onChange={onChange}
        includeAll
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("FilterChip", () => {
  it("reports pressed state and clears independently", () => {
    const onClear = vi.fn();
    render(
      <FilterChip label="Status" value="Active" active onClear={onClear} />,
    );
    expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /clear status filter/i }),
    );
    expect(onClear).toHaveBeenCalled();
  });

  it("hides the clear control when inactive, so it cannot be pressed blind", () => {
    render(<FilterChip label="Status" onClear={() => {}} />);
    expect(
      screen.queryByRole("button", { name: /clear/i }),
    ).not.toBeInTheDocument();
  });
});

/* ── Buttons and states ────────────────────────────────────────────── */

describe("LoadingButton", () => {
  it("disables itself while loading, so a submit cannot double-fire", () => {
    render(<LoadingButton loading>Save</LoadingButton>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("keeps the label so the button does not resize", () => {
    render(<LoadingButton loading>Save</LoadingButton>);
    expect(screen.getByRole("button")).toHaveTextContent("Save");
  });

  it("is a normal button when not loading", () => {
    const onClick = vi.fn();
    render(<LoadingButton onClick={onClick}>Save</LoadingButton>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("StateView", () => {
  it("announces loading politely", () => {
    render(<StateView kind="loading" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("announces an error as an alert and offers retry", () => {
    const onRetry = vi.fn();
    render(
      <StateView kind="error" message="Could not load" onRetry={onRetry} />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("supports a primary and a secondary action", () => {
    render(
      <StateView
        kind="empty"
        action={<button>Clear filters</button>}
        secondaryAction={<button>Learn more</button>}
      />,
    );
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
    expect(screen.getByText("Learn more")).toBeInTheDocument();
  });

  it("renders a permission-denied state without leaking why", () => {
    render(<StateView kind="permission-denied" />);
    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});

/* ── Row mode, with actions ────────────────────────────────────────── */
//
// `row` mode's whole point is that a collapsed card is two lines: the fields are
// the record's detail and stay behind the toggle. Actions are the exception,
// because an action bar is not detail — it is what the card is FOR. These pin
// the boundary between those two so a future tidy-up cannot re-merge them.

describe("RecordCard row mode keeps actions reachable", () => {
  const props = {
    title: "Wallet integration",
    fields: [{ label: "Owner", value: "Priya" }],
    details: [{ label: "Notes", value: "Blocked on finance" }],
  };
  const toggle = () => screen.getByRole("button", { name: /wallet/i });

  it("offers the action without expanding first", () => {
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={<button type="button">Approve</button>}
      />,
    );
    const act = screen.getByRole("button", { name: "Approve" });
    expect(act).toBeInTheDocument();
    expect(act).toBeEnabled();
    // Reachable by keyboard without opening the record.
    act.focus();
    expect(act).toHaveFocus();
  });

  it("still hides the non-action detail while collapsed", () => {
    // The fix promotes ACTIONS only. Promoting the fields too would undo row
    // mode entirely and make every collapsed card as tall as an expanded one.
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={<button type="button">Approve</button>}
      />,
    );
    expect(screen.queryByText("Priya")).not.toBeInTheDocument();
    expect(screen.queryByText("Blocked on finance")).not.toBeInTheDocument();
  });

  it("keeps the action visible after expanding, and renders it once", () => {
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={<button type="button">Approve</button>}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1);
    fireEvent.click(toggle());
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1);
  });

  it("still expands and collapses", () => {
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={<button type="button">Approve</button>}
      />,
    );
    fireEvent.click(toggle());
    expect(screen.getByText("Blocked on finance")).toBeInTheDocument();
    expect(screen.getByText("Priya")).toBeInTheDocument();
    fireEvent.click(toggle());
    expect(screen.queryByText("Blocked on finance")).not.toBeInTheDocument();
  });

  it("acting does not expand the record", () => {
    const onAct = vi.fn();
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={
          <button type="button" onClick={onAct}>
            Approve
          </button>
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onAct).toHaveBeenCalledTimes(1);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Blocked on finance")).not.toBeInTheDocument();
  });

  it("expanding does not fire the action", () => {
    const onAct = vi.fn();
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={
          <button type="button" onClick={onAct}>
            Approve
          </button>
        }
      />,
    );
    fireEvent.click(toggle());
    expect(onAct).not.toHaveBeenCalled();
  });

  it("carries several actions, in order, acting independently", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={
          <>
            <button type="button" onClick={onEdit}>
              Edit
            </button>
            <button type="button" onClick={onDelete}>
              Delete
            </button>
          </>
        }
      />,
    );
    const named = screen
      .getAllByRole("button")
      .map((b) => b.textContent?.trim())
      .filter((t) => t === "Edit" || t === "Delete");
    expect(named).toEqual(["Edit", "Delete"]);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("does not nest the action inside the row toggle", () => {
    // The row toggle is a real <button>. An action rendered inside it would be
    // invalid interactive nesting and would steal the toggle's activation.
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={<button type="button">Approve</button>}
      />,
    );
    const act = screen.getByRole("button", { name: "Approve" });
    expect(act.closest("button")).toBe(act);
    expect(toggle()).toHaveAttribute("aria-expanded");
  });

  it("keeps a link a link", () => {
    // Actions are caller-supplied nodes; the card must not coerce their element
    // type. An attachment download is the case where a plain anchor is right —
    // it is the shape the request detail page already uses.
    render(
      <RecordCard
        {...props}
        expandMode="row"
        actions={
          /*
           * An API download endpoint, not a page. The Next rule cannot tell the
           * difference, and swapping in <Link /> would defeat the assertion
           * below — the point is that RecordCard does not coerce a caller's
           * anchor into something else.
           */
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="/api/projects/1/attachment">Download</a>
        }
      />,
    );
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "/api/projects/1/attachment",
    );
  });

  it("shows an action on a card that has nothing to expand", () => {
    // No details, so no toggle at all. The action must not vanish with it.
    render(
      <RecordCard
        title="Solo"
        expandMode="row"
        actions={<button type="button">Approve</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("behaves the same in button mode, which is what production uses", () => {
    // Neither production consumer passes expandMode, so button mode is the
    // path that actually ships. It was already correct; this stops the fix
    // from having quietly changed it.
    render(
      <RecordCard {...props} actions={<button type="button">Approve</button>} />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.queryByText("Blocked on finance")).not.toBeInTheDocument();
    expect(screen.getByText("Priya")).toBeInTheDocument();
  });
});

describe("RecordCard other modes, with actions", () => {
  const props = {
    title: "Wallet integration",
    fields: [{ label: "Owner", value: "Priya" }],
    details: [{ label: "Notes", value: "Blocked on finance" }],
  };

  it("renders actions during loading in BOTH modes, consistently", () => {
    // Not a change this phase made: button mode already did this, because its
    // gate was `expandMode === "button"`, which loading never affected. Pinned
    // because the two modes now agree, and because whether a skeleton should
    // carry live controls is a real question — recorded, not silently altered.
    const { unmount } = render(
      <RecordCard
        {...props}
        loading
        actions={<button type="button">Approve</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    unmount();

    render(
      <RecordCard
        {...props}
        loading
        expandMode="row"
        actions={<button type="button">Approve</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("does not disable a caller's action just because the card is disabled", () => {
    // `disabled` dims the card and disables the card's OWN controls. The
    // actions are the caller's nodes and the caller owns their state — the
    // permission check that produced them lives there too.
    render(
      <RecordCard
        {...props}
        disabled
        expandMode="row"
        actions={<button type="button">Approve</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /wallet/i })).toBeDisabled();
  });

  it("keeps actions alongside an error rather than replacing them", () => {
    render(
      <RecordCard
        {...props}
        expandMode="row"
        error="Could not load details"
        actions={<button type="button">Retry</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /wallet/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load details",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
