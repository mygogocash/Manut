import {
  act,
  fireEvent,
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

jest.mock("@/platform/realtime-origin", () => ({
  getRealtimeOrigin: () => null,
}));

jest.mock("@/platform/realtime-room", () => ({
  joinRealtimeRoom: () => ({
    status: "error",
    lastError: "no origin",
    lastMessage: null,
    close: jest.fn(),
    ping: jest.fn(),
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
    "lists channels and loads REST message history for a selected channel",
    async () => {
      mockGet.mockImplementation(async (path: string) => {
        if (path === "/messages/channels") {
          return {
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
          };
        }
        if (path.startsWith("/messages/channels/ch-1/messages")) {
          return {
            data: [
              {
                id: "msg-1",
                channelId: "ch-1",
                content: "Hello team",
                isDeleted: false,
                createdAt: "2026-07-02T12:00:00.000Z",
                author: { id: "u-1", name: "Ada" },
              },
            ],
            meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
          };
        }
        throw new Error(`Unexpected path ${path}`);
      });

      await renderScreen();
      expect(
        await screen.findByText("General", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/principal-scoped/i)).toBeTruthy();

      await act(async () => {
        await fireEvent.press(screen.getByLabelText("Open General"));
      });

      expect(
        await screen.findByText("Hello team", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Ada/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/messages/channels",
        expect.anything(),
      );
      expect(mockGet).toHaveBeenCalledWith(
        "/messages/channels/ch-1/messages?page=1&limit=50",
        expect.anything(),
      );
    },
    15_000,
  );
});
