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

import { MessagesScreen } from "@/features/messages/messages-screen";

const mockGet = jest.fn();
const mockHasPermission = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockHasPermission(code),
  }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <MessagesScreen />
    </QueryClientProvider>,
  );
}

describe("MessagesScreen", () => {
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
    mockHasPermission.mockReset();
    mockHasPermission.mockImplementation(
      (code: string) => code === "messages:read",
    );
  });

  it(
    "lists REST message channels read-only",
    async () => {
      mockGet.mockResolvedValue({
        data: [
          {
            id: "ch-1",
            name: "General",
            description: "Company updates",
            isPrivate: false,
            type: "channel",
            unreadCount: 2,
            _count: { messages: 12 },
            updatedAt: "2026-07-02T00:00:00.000Z",
          },
        ],
      });

      await renderScreen();
      expect(
        await screen.findByText("General", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Channel · 12 messages · 2 unread/)).toBeTruthy();
      expect(
        screen.getByText(/Live websocket chat is not wired in Expo yet/),
      ).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/messages/channels",
        expect.anything(),
      );
    },
    15_000,
  );
});
