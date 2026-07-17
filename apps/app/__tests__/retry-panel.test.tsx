import { fireEvent, render, screen } from "@testing-library/react-native";

import { RetryPanel } from "@/components/retry-panel";

describe("RetryPanel", () => {
  it("shows the failure and invokes the explicit retry action", async () => {
    const onRetry = jest.fn();
    await render(
      <RetryPanel message="Temporary network problem" onRetry={onRetry} />,
    );

    screen.getByText("Temporary network problem");
    fireEvent.press(
      screen.getByRole("button", { name: "Retry session verification" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
