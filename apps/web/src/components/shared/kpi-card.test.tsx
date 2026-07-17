import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiCard } from "@/components/shared/kpi-card";

describe("KpiCard", () => {
  it("renders label correctly", () => {
    render(<KpiCard label="Total Revenue" value="$100,000" />);
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
  });

  it("renders string value correctly", () => {
    render(<KpiCard label="Revenue" value="$50,000" />);
    expect(screen.getByText("$50,000")).toBeInTheDocument();
  });

  it("renders number value correctly", () => {
    render(<KpiCard label="Users" value={1234} />);
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("renders change text when provided", () => {
    render(
      <KpiCard label="Sales" value="$10,000" change="+12% from last month" />,
    );
    expect(screen.getByText("+12% from last month")).toBeInTheDocument();
  });

  it("does not render change element when not provided", () => {
    const { container } = render(<KpiCard label="Visitors" value="5,000" />);
    const changeElements = container.querySelectorAll(
      ".text-\\[10\\.5px\\].text-muted-foreground",
    );
    expect(changeElements).toHaveLength(0);
  });

  it("applies custom className", () => {
    const { container } = render(
      <KpiCard label="Test" value="100" className="custom-kpi-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-kpi-class");
  });

  it("has correct base styling classes", () => {
    const { container } = render(<KpiCard label="Test" value="100" />);
    const card = container.firstChild;

    expect(card).toHaveClass("rounded-lg");
    expect(card).toHaveClass("border-border");
    expect(card).toHaveClass("bg-surface");
  });

  it("renders label with correct styling", () => {
    const { container } = render(<KpiCard label="Test Label" value="100" />);
    const label = container.querySelector(".font-bold.uppercase");

    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent("Test Label");
  });

  it("renders value with serif font", () => {
    const { container } = render(<KpiCard label="Test" value="$999" />);
    const value = container.querySelector(".font-sans");

    expect(value).toBeInTheDocument();
    expect(value).toHaveTextContent("$999");
  });

  it("renders zero value correctly", () => {
    render(<KpiCard label="Zero" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles empty change string", () => {
    const { container } = render(
      <KpiCard label="Test" value="100" change="" />,
    );
    const changeElement = container.querySelector(
      ".mt-1.text-muted-foreground",
    );
    expect(changeElement).toBeNull();
  });

  it("renders negative change text", () => {
    render(
      <KpiCard label="Sales" value="$5,000" change="-8% from last week" />,
    );
    expect(screen.getByText("-8% from last week")).toBeInTheDocument();
  });
});
