import {
  act,
  render,
  screen,
} from "@testing-library/react-native";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { SettingsSystemPanel } from "@/features/settings/settings-system-panel";

const mockGet = jest.fn();
let mockPermissions = ["admin:manage"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

async function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <SettingsSystemPanel />
    </QueryClientProvider>,
  );
}

describe("SettingsSystemPanel", () => {
  beforeAll(() => {
    notifyManager.setNotifyFunction(async (callback) => {
      await act(async () => {
        callback();
      });
    });
  });

  afterAll(() => {
    notifyManager.setNotifyFunction((callback) => callback());
  });

  beforeEach(() => {
    mockGet.mockReset();
    mockPermissions = ["admin:manage"];
    mockGet.mockResolvedValue({
      data: {
        companyName: "Manut",
        maxUploadMb: 25,
      },
    });
  });

  it(
    "lists system settings for admins",
    async () => {
      await renderPanel();
      expect(
        await screen.findByText("System settings", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(await screen.findByText("companyName")).toBeTruthy();
      expect(screen.getByText("Manut")).toBeTruthy();
      expect(screen.getByText("maxUploadMb")).toBeTruthy();
      expect(screen.getByText("25")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/admin/settings",
        expect.anything(),
      );
    },
    15_000,
  );

  it("hides the panel without admin:manage", async () => {
    mockPermissions = [];
    await renderPanel();
    expect(screen.queryByText("System settings")).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
