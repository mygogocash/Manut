import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/shared/badge";

describe("Badge", () => {
  it("renders children correctly", () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  it("applies default grey variant when no variant or status provided", () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("text-muted-foreground");
  });

  it("applies green variant for approved status", () => {
    const { container } = render(<Badge status="approved">Approved</Badge>);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("text-success");
  });

  it("applies amber variant for pending status", () => {
    const { container } = render(<Badge status="pending">Pending</Badge>);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("text-warning");
  });

  it("applies red variant for rejected status", () => {
    const { container } = render(<Badge status="rejected">Rejected</Badge>);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("text-destructive");
  });

  it("uses explicit variant over status", () => {
    const { container } = render(
      <Badge variant="gold" status="rejected">
        Gold Badge
      </Badge>,
    );
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("text-primary");
  });

  it("accepts custom className", () => {
    const { container } = render(
      <Badge className="custom-class">Custom</Badge>,
    );
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("custom-class");
  });

  it("handles case-insensitive status", () => {
    const { container } = render(<Badge status="APPROVED">Approved</Badge>);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("text-success");
  });

  it("maps various statuses correctly", () => {
    const statusTests = [
      { status: "active", expectedClass: "text-success" },
      { status: "completed", expectedClass: "text-success" },
      { status: "paid", expectedClass: "text-success" },
      { status: "draft", expectedClass: "text-warning" },
      { status: "processing", expectedClass: "text-warning" },
      { status: "cancelled", expectedClass: "text-destructive" },
      { status: "expired", expectedClass: "text-destructive" },
      { status: "inactive", expectedClass: "text-muted-foreground" },
      { status: "prospect", expectedClass: "text-info" },
    ];

    statusTests.forEach(({ status, expectedClass }) => {
      const { container } = render(<Badge status={status}>{status}</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toHaveClass(expectedClass);
    });
  });
});
