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

import { HelpdeskScreen } from "@/features/helpdesk/helpdesk-screen";

const mockGet = jest.fn();
let mockPermissions = ["it:read"];

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
      <HelpdeskScreen />
    </QueryClientProvider>,
  );
}

describe("HelpdeskScreen", () => {
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
    mockPermissions = ["it:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          ticketNumber: 42,
          title: "VPN access",
          category: "network",
          priority: "high",
          status: "open",
          createdAt: "2026-07-18T10:00:00.000Z",
          createdBy: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
          },
          assignee: null,
        },
      ],
      meta: { page: 1, limit: 20, total: 1, pages: 1 },
    });
  });

  it(
    "lists helpdesk tickets read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("#42 · VPN access", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Open · high · network/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/helpdesk?page=1&limit=20&scope=mine",
        expect.anything(),
      );
    },
    15_000,
  );
});
