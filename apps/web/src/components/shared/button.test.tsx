import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/shared/button";

describe("Button", () => {
  it("renders children correctly", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click Me");
  });

  it("applies primary variant by default", () => {
    const { container } = render(<Button>Primary</Button>);
    const button = container.querySelector("button");
    expect(button).toHaveClass("bg-primary");
    expect(button).toHaveClass("text-primary-foreground");
  });

  it("applies secondary variant styles", () => {
    const { container } = render(
      <Button variant="secondary">Secondary</Button>,
    );
    const button = container.querySelector("button");
    expect(button).toHaveClass("bg-surface");
    expect(button).toHaveClass("border-border");
  });

  it("applies danger variant styles", () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    const button = container.querySelector("button");
    expect(button).toHaveClass("text-destructive");
  });

  it("applies ghost variant styles", () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const button = container.querySelector("button");
    expect(button).toHaveClass("bg-transparent");
  });

  it("applies different sizes correctly", () => {
    const { rerender, container } = render(<Button size="sm">Small</Button>);
    expect(container.querySelector("button")).toHaveClass("h-8");

    rerender(<Button size="default">Default</Button>);
    expect(container.querySelector("button")).toHaveClass("h-9");

    rerender(<Button size="lg">Large</Button>);
    expect(container.querySelector("button")).toHaveClass("h-10");

    rerender(<Button size="icon">Icon</Button>);
    expect(container.querySelector("button")).toHaveClass("h-9");
    expect(container.querySelector("button")).toHaveClass("w-9");
  });

  it("handles click events", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("accepts custom className", () => {
    const { container } = render(
      <Button className="custom-class">Custom</Button>,
    );
    expect(container.querySelector("button")).toHaveClass("custom-class");
  });

  it("forwards ref correctly", () => {
    const ref = vi.fn();
    render(<Button ref={ref}>With Ref</Button>);
    expect(ref).toHaveBeenCalled();
  });

  it("applies custom style prop", () => {
    const { container } = render(
      <Button style={{ margin: "10px" }}>Styled</Button>,
    );
    expect(container.querySelector("button")).toHaveStyle({ margin: "10px" });
  });

  it("renders as button type by default", () => {
    render(<Button>Default Type</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("accepts type prop", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
