import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AuthEmailScreen } from "@/features/auth/auth-email-screen";

const mockRequestPasswordReset = jest.fn();
const mockRequestMagicLink = jest.fn();

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    requestPasswordReset: mockRequestPasswordReset,
    requestMagicLink: mockRequestMagicLink,
  }),
}));

describe("AuthEmailScreen", () => {
  beforeEach(() => {
    mockRequestPasswordReset.mockReset();
    mockRequestMagicLink.mockReset();
  });

  it("validates and submits a password reset request", async () => {
    mockRequestPasswordReset.mockResolvedValue({
      success: true,
      message: "If the account is eligible, a reset link will arrive shortly.",
    });
    await render(<AuthEmailScreen mode="forgot-password" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), " person@example.invalid ");
    await user.press(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(mockRequestPasswordReset).toHaveBeenCalledWith(
        "person@example.invalid",
      ),
    );
    screen.getByText(
      "If the account is eligible, a reset link will arrive shortly.",
    );
  });

  it("does not call the API for an invalid email", async () => {
    await render(<AuthEmailScreen mode="magic-link" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "invalid");
    await user.press(screen.getByRole("button", { name: "Send sign-in link" }));

    screen.getByText("Enter a valid email address.");
    expect(mockRequestMagicLink).not.toHaveBeenCalled();
  });
});
