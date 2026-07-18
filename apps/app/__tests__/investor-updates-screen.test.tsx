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

import { InvestorUpdatesScreen } from "@/features/investor-updates/investor-updates-screen";

const mockGet = jest.fn();
let mockPermissions = ["investor-updates:read"];

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
      <InvestorUpdatesScreen />
    </QueryClientProvider>,
  );
}

describe("InvestorUpdatesScreen", () => {
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
    mockPermissions = ["investor-updates:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Q2 portfolio update",
          period: "2026-Q2",
          status: "draft",
          sentAt: null,
          createdAt: "2026-07-01T00:00:00.000Z",
          sender: null,
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists investor updates read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Q2 portfolio update", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/2026-Q2 · draft/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/investor-updates?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
