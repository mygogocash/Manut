import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { PayrollScreen } from "@/features/payroll/payroll-screen";

const mockGet = jest.fn();
const mockPut = jest.fn();
let mockPermissions = ["payroll:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, put: mockPut }),
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
    mockPut.mockReset();
    mockPermissions = ["payroll:read"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/payroll/runs?")) {
        return Promise.resolve({
          data: [run],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      if (path === "/payroll/my-payslips") {
        return Promise.resolve({
          data: [
            {
              id: "clpayslip00000000000000001",
              baseSalary: "50000",
              grossPay: "52000",
              netPay: "48000",
              currency: "THB",
              documentUrl: "https://storage.example/secret.pdf",
              payrollRun: {
                id: run.id,
                period: "2026-06",
                status: "approved",
                entity: { id: run.entity.id, name: "Manut Ops" },
              },
            },
          ],
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists payroll runs and my payslips from the API",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(/2026-06 · Draft/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      // Entity name appears on both the HR run row and the employee payslip row.
      expect(screen.getAllByText(/Manut Ops/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Runner Runner/)).toBeTruthy();
      expect(screen.queryByText(/secret/)).toBeNull();
      expect(
        await screen.findByText(/Document on file/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/payroll/runs?"),
        expect.anything(),
      );
      expect(mockGet).toHaveBeenCalledWith(
        "/payroll/my-payslips",
        expect.anything(),
      );
      expect(screen.queryByLabelText(/Approve payroll run/)).toBeNull();
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

  it(
    "approves a draft run when payroll:approve is granted",
    async () => {
      mockPermissions = ["payroll:read", "payroll:approve"];
      mockPut.mockResolvedValue({
        data: {
          ...run,
          status: "approved",
          notes: "still secret",
          approver: {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Approver",
            email: "approver@manut.example",
          },
        },
      });

      await renderScreen();
      const approveButton = await screen.findByLabelText(
        /Approve payroll run 2026-06/,
        {},
        { timeout: 10_000 },
      );
      await act(async () => {
        fireEvent.press(approveButton);
      });

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith(
          `/payroll/runs/${run.id}/approve`,
          {},
        );
      });
      expect(
        await screen.findByText(
          /Payroll run approved/,
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
    },
    15_000,
  );
});
