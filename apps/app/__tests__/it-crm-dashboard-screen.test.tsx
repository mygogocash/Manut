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

import { ItCrmDashboardScreen } from "@/features/it-crm/it-crm-dashboard-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["it-crm:read"];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <ItCrmDashboardScreen />
    </QueryClientProvider>,
  );
}

describe("ItCrmDashboardScreen", () => {
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
    mockPush.mockReset();
    mockPermissions = ["it-crm:read"];
    mockGet.mockResolvedValue({
      data: {
        total: 4,
        productionLive: 1,
        atRisk: 1,
        inProgress: 2,
        byStatus: [{ status: "in_progress", count: 2 }],
        byDepartment: [],
        upcomingGoLives: [],
        recentUpdates: [],
      },
    });
  });

  it(
    "shows IT CRM dashboard KPIs",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Total: 4", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("In progress: 2")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/it-crm/dashboard",
        expect.anything(),
      );
    },
    15_000,
  );
});
