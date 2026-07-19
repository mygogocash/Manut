import { render, screen } from "@testing-library/react-native";

import { EsopCompatibilityRedirect } from "@/features/hrms/esop-compatibility-redirect";

const employeeId = "11111111-1111-4111-8111-111111111111";
let mockEmployeeId: string | string[] | undefined = employeeId;

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  const React = require("react") as typeof import("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  const { Text } = require("react-native") as typeof import("react-native");
  return {
    useLocalSearchParams: () => ({ employeeId: mockEmployeeId }),
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: "redirect-href" }, href),
  };
});

describe("EsopCompatibilityRedirect", () => {
  beforeEach(() => {
    mockEmployeeId = employeeId;
  });

  it("redirects /hrms/esop/:id to /hrms/grants/:id", async () => {
    await render(<EsopCompatibilityRedirect />);

    expect(screen.getByTestId("redirect-href")).toHaveTextContent(
      `/hrms/grants/${employeeId}`,
    );
  });

  it("falls back to /hrms when employeeId is missing", async () => {
    mockEmployeeId = undefined;
    await render(<EsopCompatibilityRedirect />);

    expect(screen.getByTestId("redirect-href")).toHaveTextContent("/hrms");
  });
});
