import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/shared/page-header";

// The canonical page title row, used by ~97 pages.
//
// It had no tests before Phase 5A, which is uncomfortable for a component with
// that reach — so these lock down both the visual identity (so nobody
// "modernises" the serif title and silently restyles the whole product) and the
// responsive layout added in 5A.

describe("content", () => {
  it("renders the title as the page's h1", () => {
    render(<PageHeader title="Leave Management" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Leave Management");
  });

  it("renders a subtitle only when given one", () => {
    const { container, unmount } = render(<PageHeader title="Leave" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    unmount();

    render(<PageHeader title="Leave" subtitle="Requests and balances" />);
    expect(screen.getByText("Requests and balances")).toBeInTheDocument();
  });

  it("renders actions passed as children", () => {
    render(
      <PageHeader title="Leave">
        <button>New request</button>
        <button>Export</button>
      </PageHeader>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("omits the action container entirely when there are no children", () => {
    // An empty flex row still occupies the gap and shifts the title.
    const { container } = render(<PageHeader title="Leave" />);
    expect(container.querySelectorAll("div")).toHaveLength(2); // wrapper + text column
  });
});

describe("visual identity is preserved", () => {
  // Phase 2 briefly defined a second PageHeader with a sans semibold text-lg
  // title. Adopting it would have restyled every page in the product. These
  // assertions exist so that cannot happen by accident.
  it("keeps the serif page title at its established desktop size", () => {
    render(<PageHeader title="Leave" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("font-serif");
    expect(heading.className).toContain("sm:text-3xl");
    expect(heading.className).toContain("font-normal");
  });

  it("keeps the subtitle treatment", () => {
    render(<PageHeader title="Leave" subtitle="Requests" />);
    expect(screen.getByText("Requests").className).toContain(
      "text-muted-foreground",
    );
  });
});

describe("responsive layout", () => {
  it("stacks on mobile and returns to a row from sm up", () => {
    // A long title and its buttons competing for one 320px line was the defect.
    const { container } = render(
      <PageHeader title="Leave">
        <button>New</button>
      </PageHeader>,
    );
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain("flex-col");
    expect(wrapper.className).toContain("sm:flex-row");
    expect(wrapper.className).toContain("sm:justify-between");
  });

  it("lets the text column shrink, which is what allows a long title to wrap", () => {
    // Without min-w-0 a flex child refuses to go narrower than its content and
    // pushes the actions off-screen instead of wrapping.
    const { container } = render(<PageHeader title="Leave" />);
    expect(container.querySelector(".min-w-0")).not.toBeNull();
  });

  it("steps the title down one size on the narrowest screens", () => {
    render(<PageHeader title="Leave" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("text-2xl");
    expect(heading.className).toContain("sm:text-3xl");
  });

  it("wraps actions rather than overflowing", () => {
    const { container } = render(
      <PageHeader title="Leave">
        <button>One</button>
        <button>Two</button>
        <button>Three</button>
        <button>Four</button>
      </PageHeader>,
    );
    const actions = container.querySelector(".flex-wrap");
    expect(actions).not.toBeNull();
    expect(actions?.className).toContain("shrink-0");
  });

  it("balances a long title instead of leaving an orphan word", () => {
    render(
      <PageHeader title="Marketing Analytics and Partner Workspace Overview" />,
    );
    expect(
      screen.getByRole("heading", { level: 1 }).className,
    ).toContain("text-balance");
  });

  it("does not truncate the title", () => {
    // Cutting a page title mid-word tells the user less than two lines does.
    render(<PageHeader title="A very long page title that will wrap on mobile" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).not.toContain("truncate");
    expect(heading).toHaveTextContent(
      "A very long page title that will wrap on mobile",
    );
  });
});

describe("caller overrides", () => {
  it("merges a caller className without dropping the layout classes", () => {
    const { container } = render(
      <PageHeader title="Leave" className="mb-0 border-b" />,
    );
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain("border-b");
    expect(wrapper.className).toContain("sm:flex-row");
  });
});
