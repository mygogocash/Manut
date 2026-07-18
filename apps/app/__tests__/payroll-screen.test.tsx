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

import { PayrollScreen } from "@/features/payroll/payroll-screen";

const mockGet = jest.fn();
let mockPermissions = ["payroll:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const run = {
  id: "clpayrollrun00000000000001",
  period: "2026-06",
  status: "draft",
  totalGross: "10000.00",
  totalNet: "8500.00",
  totalTax: "1500.00",
  notes: "secret",
  currencyTotals: { THB: { gross: 10000, tax: 1500, net: 8500, count: 1 } },
  createdAt: "2026-06-01T00:00:00.000Z",
  entity: { id: "clentity00000000000000001", name: "Manut Ops", currency: "THB" },
  runner: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Runner",
    email: "runner@manut.example",
  },
  approver: null,
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
      <PayrollScreen />
    </QueryClientProvider>,
  );
}

describe("PayrollScreen", () => {
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
    mockPermissions = ["payroll:read"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/payroll/runs?")) {
        return Promise.resolve({
          data: [run],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists payroll runs from the runs API",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(/2026-06 · Draft/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Manut Ops/)).toBeTruthy();
      expect(screen.getByText(/Runner Runner/)).toBeTruthy();
      expect(screen.queryByText(/secret/)).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/payroll/runs?"),
        expect.anything(),
      );
    },
    15_000,
  );

  it("blocks the screen when payroll permissions are missing", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(
        /You do not have permission to view payroll runs/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
