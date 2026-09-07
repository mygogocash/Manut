import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductDemoPanel } from "@/components/landing/product-demo-panel";

describe("ProductDemoPanel", () => {
  it("renders all three accessible module tabs and illustrative badge", () => {
    render(<ProductDemoPanel />);

    expect(
      screen.getByText(/Interactive demonstration · Fictional sample data/i),
    ).toBeInTheDocument();

    const peopleTab = screen.getByRole("tab", { name: /people/i });
    const moneyTab = screen.getByRole("tab", { name: /money/i });
    const workTab = screen.getByRole("tab", { name: /work/i });

    expect(peopleTab).toBeInTheDocument();
    expect(moneyTab).toBeInTheDocument();
    expect(workTab).toBeInTheDocument();

    expect(peopleTab).toHaveAttribute("aria-selected", "true");
    expect(moneyTab).toHaveAttribute("aria-selected", "false");
    expect(workTab).toHaveAttribute("aria-selected", "false");
  });

  it("switches to Money panel and displays sequential approval steps on click", () => {
    render(<ProductDemoPanel />);

    const moneyTab = screen.getByRole("tab", { name: /money/i });
    fireEvent.click(moneyTab);

    expect(moneyTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/Spend Requests/i)).toBeInTheDocument();
    expect(screen.getByText(/Sequential Approval Stages/i)).toBeInTheDocument();
  });

  it("switches to Work panel and displays Kanban board on click", () => {
    render(<ProductDemoPanel />);

    const workTab = screen.getByRole("tab", { name: /work/i });
    fireEvent.click(workTab);

    expect(workTab).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText(/Configurable Project & Operations Board/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Active Sprint/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Review & QA/i)).toBeInTheDocument();
  });

  it("supports keyboard navigation between tabs (ArrowRight, ArrowLeft, Home, End)", () => {
    render(<ProductDemoPanel />);

    const tablist = screen.getByRole("tablist");

    // ArrowRight from People -> Money
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /money/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // ArrowRight from Money -> Work
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /work/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // ArrowLeft from Work -> Money
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /money/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Home jumps to People
    fireEvent.keyDown(tablist, { key: "Home" });
    expect(screen.getByRole("tab", { name: /people/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // End jumps to Work
    fireEvent.keyDown(tablist, { key: "End" });
    expect(screen.getByRole("tab", { name: /work/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("updates detail views when items are selected within a tab", () => {
    render(<ProductDemoPanel />);

    // Select second employee in People tab
    const secondEmp = screen.getByRole("button", { name: /Alisa Vance/i });
    fireEvent.click(secondEmp);

    expect(screen.getByText(/VP of Finance/i)).toBeInTheDocument();
    expect(screen.getByText("Finance & Accounts")).toBeInTheDocument();
  });
});
