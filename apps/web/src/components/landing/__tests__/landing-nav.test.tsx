import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingNav } from "@/components/landing/landing-nav";

describe("LandingNav", () => {
  it("renders the Manut logo, wordmark, anchor links, and primary CTA", () => {
    render(<LandingNav isHomepage={true} />);

    expect(screen.getAllByText("Manut")[0]).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Manut Home/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Product$/i })).toHaveAttribute(
      "href",
      "#product",
    );
    expect(screen.getByRole("link", { name: /^Modules$/i })).toHaveAttribute(
      "href",
      "#modules",
    );
    expect(screen.getByRole("link", { name: /^Security$/i })).toHaveAttribute(
      "href",
      "#security",
    );

    const openCtas = screen.getAllByRole("link", { name: /Open Manut/i });
    expect(openCtas.length).toBeGreaterThan(0);
    expect(openCtas[0]).toHaveAttribute("href", "/sign-in");
  });

  it("toggles mobile navigation menu with accessible attributes", () => {
    render(<LandingNav isHomepage={true} />);

    const toggleBtn = screen.getByRole("button", { name: /Open menu/i });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // Click to open
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("dialog", { name: /Mobile Navigation/i }),
    ).toBeInTheDocument();

    // Click to close
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("dialog", { name: /Mobile Navigation/i }),
    ).not.toBeInTheDocument();
  });

  it("closes mobile menu when pressing Escape key", () => {
    render(<LandingNav isHomepage={true} />);

    const toggleBtn = screen.getByRole("button", { name: /Open menu/i });
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  });
});
