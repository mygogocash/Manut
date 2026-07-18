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

import { ExpenseReportDetailScreen } from "@/features/expenses/expense-report-detail-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
const reportId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ reportId }),
}));

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <ExpenseReportDetailScreen />
    </QueryClientProvider>,
  );
}

describe("ExpenseReportDetailScreen", () => {
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
    mockGet.mockResolvedValue({
      data: {
        id: reportId,
        period: "2026-07",
        title: "July travel meals",
        category: "general",
        status: "submitted",
        submittedAt: "2026-07-10T10:00:00.000Z",
        approvedAt: null,
        rejectReason: null,
        reimbursedAt: null,
        totalAmount: 1250.5,
        totalCurrency: "USD",
        converted: true,
        missingRates: [],
        approvedTotal: null,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-10T10:00:00.000Z",
        employee: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Person",
          email: "person@manut.example",
          department: "Operations",
        },
        entity: { id: "entity-1", name: "Manut Ops" },
        _count: { expenses: 3 },
      },
    });
  });

  it(
    "shows read-only expense report detail",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("July travel meals", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Submitted · 2026-07/)).toBeTruthy();
      expect(screen.getByText(/3 lines/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        `/expenses/reports/${reportId}`,
        expect.anything(),
      );
    },
    15_000,
  );
});
