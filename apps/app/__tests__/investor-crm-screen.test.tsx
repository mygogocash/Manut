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

import { InvestorCrmScreen } from "@/features/investor-crm/investor-crm-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["investor-dashboard:read", "investors:read"];

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
      <InvestorCrmScreen />
    </QueryClientProvider>,
  );
}

describe("InvestorCrmScreen", () => {
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
    mockPermissions = ["investor-dashboard:read", "investors:read"];
    mockGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/investors/dashboard")) {
        return {
          data: {
            totalInvestors: 3,
            totalInvestments: 1,
            totalCommitted: 100,
            totalReceived: 50,
            totalEstInvestment: 200,
            totalActInvestment: 80,
            statusBreakdown: { lead: 2 },
          },
        };
      }
      return {
        data: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            name: "Northwind Capital",
            type: "vc",
            status: "lead",
            region: "APAC",
            owner: null,
            _count: { investments: 0 },
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
    });
  });

  it(
    "shows investor CRM KPIs and recent list",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Investors: 3", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("Northwind Capital")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/investors/dashboard",
        expect.anything(),
      );
      expect(mockGet).toHaveBeenCalledWith(
        "/investors?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
