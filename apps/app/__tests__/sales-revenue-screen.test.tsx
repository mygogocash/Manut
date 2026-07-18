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

import { SalesRevenueScreen } from "@/features/sales-revenue/sales-revenue-screen";

const mockGet = jest.fn();
let mockPermissions = ["sales-revenue:read"];

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
      <SalesRevenueScreen />
    </QueryClientProvider>,
  );
}

describe("SalesRevenueScreen", () => {
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
    mockPermissions = ["sales-revenue:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          company: "Acme",
          firstName: "Jane",
          lastName: "Doe",
          source: "web",
          status: "new",
          createdAt: "2026-07-01T00:00:00.000Z",
          owner: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists sales-revenue leads read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Acme", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Jane Doe · new · web/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/sales-revenue/leads?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
