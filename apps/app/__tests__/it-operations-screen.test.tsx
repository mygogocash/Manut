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

import { ItOperationsScreen } from "@/features/it-operations/it-operations-screen";

const mockGet = jest.fn();
let mockPermissions = ["it:dashboard:view"];

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
      <ItOperationsScreen />
    </QueryClientProvider>,
  );
}

describe("ItOperationsScreen", () => {
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
    mockPermissions = ["it:dashboard:view"];
    mockGet.mockResolvedValue({
      data: {
        cards: {
          monthlySpendByCurrency: { USD: 1200 },
          primaryCurrency: "USD",
          upcomingRenewals7: 2,
          activeSubscriptions: 8,
          pendingAccessRequests: 3,
          totalLicenses: 100,
          assignedLicenses: 70,
          unusedLicenses: 30,
        },
        recentGrantedAccess: [
          {
            id: "g1",
            employee: { id: "u1", name: "Alex" },
            system: { id: "s1", name: "Git" },
          },
        ],
      },
    });
  });

  it("shows KPI panel without recent access identity", async () => {
    await renderScreen();
    expect(
      await screen.findByText(
        /Active subscriptions: 8/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Pending access requests: 3/)).toBeTruthy();
    expect(screen.queryByText(/^Alex$/)).toBeNull();
    expect(mockGet).toHaveBeenCalledWith(
      "/it-operations/dashboard",
      expect.anything(),
    );
  }, 15_000);
});
