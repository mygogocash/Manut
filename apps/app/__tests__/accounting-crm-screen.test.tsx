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

import { AccountingCrmScreen } from "@/features/accounting-crm/accounting-crm-screen";

const mockGet = jest.fn();
let mockPermissions = ["accounting-crm:read"];

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
      <AccountingCrmScreen />
    </QueryClientProvider>,
  );
}

describe("AccountingCrmScreen", () => {
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
    mockPermissions = ["accounting-crm:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Close books",
          slug: "close-books",
          status: "in_progress",
          department: "Finance",
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
    "lists accounting-crm projects read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Close books", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/accounting-crm?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
