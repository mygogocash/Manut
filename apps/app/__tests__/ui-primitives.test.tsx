import { Button, StatusMessage, SwitchField, TextField } from "@manut/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

describe("universal ui primitives", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Button > given an enabled press > then invokes onPress", async () => {
    const onPress = jest.fn();
    await render(
      <Button label="Continue" pendingLabel="Working…" onPress={onPress} />,
    );

    fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("Button > given pending state > then blocks presses and exposes busy state", async () => {
    const onPress = jest.fn();
    await render(
      <Button
        label="Continue"
        pendingLabel="Working…"
        pending
        onPress={onPress}
      />,
    );

    const button = screen.getByRole("button", { name: "Working…" });
    expect(button.props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("TextField > given a label > then exposes it as the accessibility name", async () => {
    await render(
      <TextField
        label="Email"
        value="person@example.invalid"
        onChangeText={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
  });

  it("StatusMessage > given error tone > then renders the message", async () => {
    await render(
      <StatusMessage tone="error">Unable to verify the session.</StatusMessage>,
    );

    expect(screen.getByText("Unable to verify the session.")).toBeTruthy();
  });

  it("StatusMessage > given success tone > then renders the message", async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
    await render(
      <StatusMessage tone="success">Reset link sent.</StatusMessage>,
    );

    expect(screen.getByText("Reset link sent.")).toBeTruthy();
    expect(announce).toHaveBeenCalledWith("Reset link sent.");
  });

  it("SwitchField > given a privacy change > then exposes and updates state", async () => {
    const onValueChange = jest.fn();
    await render(
      <SwitchField
        label="Show my phone number in the directory"
        description="Colleagues can see your phone number."
        value={false}
        onValueChange={onValueChange}
      />,
    );

    const privacySwitch = screen.getByRole("switch", {
      name: "Show my phone number in the directory",
    });
    expect(privacySwitch.props.accessibilityState).toMatchObject({
      checked: false,
    });
    fireEvent(privacySwitch, "valueChange", true);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});
