import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Linking } from "react-native";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { ExpenseReportDetailScreen } from "@/features/expenses/expense-report-detail-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
const mockGetExpenseLineReceiptUrl = jest.fn();
const reportId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ reportId }),
}));

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@manut/app-core", () => {
  const actual = jest.requireActual("@manut/app-core") as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    getExpenseLineReceiptUrl: (
      ...args: Parameters<typeof mockGetExpenseLineReceiptUrl>
    ) => mockGetExpenseLineReceiptUrl(...args),
  };
});

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
    mockGetExpenseLineReceiptUrl.mockReset();
    mockGetExpenseLineReceiptUrl.mockResolvedValue({
      url: "https://signed.example/receipt.pdf",
    });
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    mockGet.mockImplementation((path: string) => {
      if (path === `/expenses/reports/${reportId}`) {
        return Promise.resolve({
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
            _count: { expenses: 2 },
            expenses: [
              {
                id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                description: "Taxi",
                amount: "40",
                currency: "USD",
                date: "2026-07-05",
                status: "pending",
                receiptUrl: "https://private.example/receipt.pdf",
              },
              {
                id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
                description: "Lunch",
                amount: "25",
                currency: "USD",
                date: "2026-07-06",
                status: "pending",
              },
            ],
          },
        });
      }
      if (
        path ===
        `/expenses/reports/${reportId}/expenses/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/receipt`
      ) {
        return Promise.resolve({
          data: { url: "https://signed.example/receipt.pdf" },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it(
    "shows read-only expense report detail",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("July travel meals", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Submitted · 2026-07/)).toBeTruthy();
      expect(screen.getByText(/2 lines/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        `/expenses/reports/${reportId}`,
        expect.anything(),
      );
    },
    15_000,
  );

  it(
    "shows employee name without department from the least-data projection",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Person", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.queryByText(/Operations/)).toBeNull();
      expect(screen.queryByText(/person@manut\.example/)).toBeNull();
    },
    15_000,
  );

  it(
    "renders line items and opens a signed receipt URL",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Taxi", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("Lunch")).toBeTruthy();
      expect(screen.getByText(/40\.00 USD · 2026-07-05/)).toBeTruthy();
      expect(
        screen.getByLabelText("View receipt for Taxi"),
      ).toBeTruthy();
      expect(
        screen.queryByLabelText("View receipt for Lunch"),
      ).toBeNull();

      await fireEvent.press(screen.getByLabelText("View receipt for Taxi"));
      await waitFor(() => {
        expect(mockGetExpenseLineReceiptUrl).toHaveBeenCalledWith(
          expect.objectContaining({ get: mockGet }),
          reportId,
          "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        );
        expect(Linking.openURL).toHaveBeenCalledWith(
          "https://signed.example/receipt.pdf",
        );
      });
    },
    15_000,
  );
});
