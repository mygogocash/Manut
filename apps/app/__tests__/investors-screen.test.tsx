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

import { InvestorsScreen } from "@/features/investors/investors-screen";

const mockGet = jest.fn();
let mockPermissions = ["investors:read"];

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
      <InvestorsScreen />
    </QueryClientProvider>,
  );
}

describe("InvestorsScreen", () => {
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
    mockPermissions = ["investors:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Northwind Capital",
          type: "vc",
          status: "investors",
          contactName: "Jamie Example",
          location: "Bangkok",
          region: "APAC",
          adder: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
          },
          _count: { investments: 3 },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists investors read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Northwind Capital", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/vc · investors · Bangkok · APAC/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/investors?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
