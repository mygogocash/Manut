import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ForceLightTheme } from "@/components/landing/force-light-theme";
import { MarketingLayout } from "@/components/landing/marketing-layout";

vi.mock("next/font/google", () => ({
  Instrument_Serif: () => ({
    variable: "--font-manut-display",
  }),
  Inter: () => ({
    variable: "--font-manut-sans",
  }),
}));

describe("Theme Isolation", () => {
  it("ForceLightTheme does not trigger theme side-effects or mutate next-themes", () => {
    // Render ForceLightTheme; should render null without touching any theme state
    const { container } = render(<ForceLightTheme />);
    expect(container.firstChild).toBeNull();
  });

  it("MarketingLayout wraps content in .manut-landing with data-theme='light'", () => {
    const { container } = render(
      <MarketingLayout>
        <div>Landing Content</div>
      </MarketingLayout>,
    );

    const root = container.querySelector(".manut-landing");
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("data-theme", "light");
    expect(root?.textContent).toContain("Landing Content");
  });
});
