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

import { AdminScreen } from "@/features/admin/admin-screen";

const mockGet = jest.fn();
let mockPermissions = ["admin:read", "user:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <AdminScreen />
    </QueryClientProvider>,
  );
}

describe("AdminScreen", () => {
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
    mockPermissions = ["admin:read", "user:read"];
    mockGet.mockResolvedValue({
      data: {
        total: 40,
        active: 35,
        inactive: 5,
        newThisMonth: 2,
        byEmploymentType: [],
      },
    });
  });

  it("shows user counts without employment breakdown", async () => {
    await renderScreen();
    expect(
      await screen.findByText(/Total users: 40/, {}, { timeout: 10_000 }),
    ).toBeTruthy();
    expect(screen.getByText(/Active: 35 · Inactive: 5/)).toBeTruthy();
    expect(screen.queryByText(/byEmploymentType/)).toBeNull();
    expect(mockGet).toHaveBeenCalledWith(
      "/admin/users/stats",
      expect.anything(),
    );
  }, 15_000);
});
