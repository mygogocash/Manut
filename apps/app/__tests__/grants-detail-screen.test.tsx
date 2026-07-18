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

import { GrantsDetailScreen } from "@/features/hrms/grants-detail-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
const employeeId = "11111111-1111-4111-8111-111111111111";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ employeeId }),
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
      <GrantsDetailScreen />
    </QueryClientProvider>,
  );
}

describe("GrantsDetailScreen", () => {
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
        employee: {
          id: employeeId,
          name: "Person",
          department: "Operations",
        },
        kpis: {
          grandTotal: 1000,
          vesting: 750,
          vested: 250,
          vestedToDate: 250,
        },
        instruments: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            grantType: "equity",
            scheduled: true,
            shares: 1000,
            vestedToDate: 250,
            vestingMonths: 48,
            cliffMonths: 12,
            lockMonths: 0,
            grantDate: "2026-01-15",
            status: "vesting",
          },
        ],
      },
    });
  });

  it(
    "shows read-only employee grants detail at /hrms/grants/:id",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Person", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Total 1000/)).toBeTruthy();
      expect(screen.getByText("Equity")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        `/hrms/esop-grants/by-employee/${employeeId}`,
        expect.anything(),
      );
    },
    15_000,
  );
});
