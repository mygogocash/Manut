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

import { RevenueScreen } from "@/features/revenue/revenue-screen";

const mockGet = jest.fn();
let mockPermissions = ["revenue:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const dashboard = {
  investments: {
    totalInvestments: 1_250_000,
    investorCount: 4,
    avgInvestment: 312_500,
  },
  expenses: [
    { month: "2026-01", total: 10_000 },
    { month: "2026-02", total: 12_500 },
  ],
  invoices: {
    byStatus: {
      paid: { count: 3, total: 80_000 },
      sent: { count: 2, total: 40_000 },
    },
    grandTotal: 120_000,
  },
  revenueByEntity: [],
  pipeline: [
    { stage: "qualified", count: 2, totalValue: 50_000 },
    { stage: "proposal", count: 1, totalValue: 25_000 },
  ],
  monthly: [
    {
      month: "2026-02",
      revenue: 50_000,
      previousRevenue: 40_000,
      growth: 25,
    },
  ],
};

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <RevenueScreen />
    </QueryClientProvider>,
  );
}

describe("RevenueScreen", () => {
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
    mockPermissions = ["revenue:read"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/revenue/dashboard?")) {
        return Promise.resolve({ data: dashboard });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "shows projected revenue KPIs from the dashboard API",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(/Total investments/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/1,250,000 · 4 investors/)).toBeTruthy();
      expect(screen.getByText(/120,000 · 5 invoices/)).toBeTruthy();
      expect(screen.getByText(/75,000/)).toBeTruthy();
      expect(screen.getByText(/\+25\.0%/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/revenue/dashboard?period=12m",
        expect.anything(),
      );
    },
    15_000,
  );

  it("blocks the screen when revenue:read is missing", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(
        /You do not have permission to view revenue analytics/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
