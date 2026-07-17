import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shared/empty-state";

describe("EmptyState", () => {
  it("renders default title when none provided", () => {
    render(<EmptyState />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders custom title", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <EmptyState title="Empty" description="There are no items to display." />,
    );
    expect(
      screen.getByText("There are no items to display."),
    ).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    const descriptionElement = container.querySelector(
      "[data-slot='empty-description']",
    );
    expect(descriptionElement).toBeNull();
  });

  it("renders custom icon", () => {
    const CustomIcon = () => <span data-testid="custom-icon">Custom Icon</span>;
    render(<EmptyState icon={<CustomIcon />} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders default InboxIcon when no icon provided", () => {
    const { container } = render(<EmptyState />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(
      <EmptyState>
        <button>Add Item</button>
      </EmptyState>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Add Item");
  });

  it("applies custom className", () => {
    const { container } = render(<EmptyState className="custom-empty-class" />);
    expect(container.firstChild).toHaveClass("custom-empty-class");
  });

  it("has correct base styling", () => {
    const { container } = render(<EmptyState />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("py-16");
    expect(wrapper).toHaveClass("border-0");
  });

  it("renders with all props", () => {
    const CustomIcon = () => <span data-testid="icon">Icon</span>;
    render(
      <EmptyState
        title="Custom Title"
        description="Custom description"
        icon={<CustomIcon />}
        className="full-example"
      >
        <button>Action</button>
      </EmptyState>,
    );

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Custom description")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveTextContent("Action");
  });
});
