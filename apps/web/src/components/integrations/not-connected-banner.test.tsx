import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotConnectedBanner } from "@/components/integrations/not-connected-banner";

describe("NotConnectedBanner", () => {
  it("renders feature name in headline + body", () => {
    render(<NotConnectedBanner feature="Gmail" />);
    expect(
      screen.getByText(/google workspace not connected/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/use gmail/i)).toBeInTheDocument();
  });

  it("renders a link to /settings?tab=integrations", () => {
    render(<NotConnectedBanner feature="Drive" />);
    const link = screen.getByRole("link", { name: /go to settings/i });
    expect(link).toHaveAttribute("href", "/settings?tab=integrations");
  });
});
