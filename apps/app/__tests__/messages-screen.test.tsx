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
const mockPost = jest.fn();
const mockHasPermission = jest.fn();
const mockJoinMessagesLiveChannel = jest.fn();
let liveEventHandler:
  | ((event: {
      type: "message.created" | "message.deleted";
      channelId: string;
      payload: {
        id: string;
        channelId: string;
        content: string;
        isDeleted: boolean;
        createdAt: string;
        authorName: string;
        authorId: string | null;
      };
    }) => void)
  | null = null;

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockHasPermission(code),
  }),
}));

jest.mock("@/platform/messages-live", () => ({
  joinMessagesLiveChannel: (options: {
    channelId: string;
    onEvent: typeof liveEventHandler;
    onStatus?: (status: string) => void;
    onTransport?: (transport: "durable-object" | "socket.io") => void;
  }) => {
    liveEventHandler = options.onEvent;
    mockJoinMessagesLiveChannel(options);
    options.onTransport?.("socket.io");
    options.onStatus?.("connected");
    return { status: "connected", close: jest.fn() };
  },
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
    mockPost.mockReset();
    mockHasPermission.mockReset();
    mockJoinMessagesLiveChannel.mockReset();
    liveEventHandler = null;
    mockHasPermission.mockImplementation(
      (code: string) =>
        code === "messages:read" || code === "messages:create",
    );
  });

  it(
    "lists channels, loads REST history, sends, and live-appends socket events",
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
      mockPost.mockResolvedValue({
        data: {
          id: "msg-2",
          channelId: "ch-1",
          content: "From Expo",
          isDeleted: false,
          createdAt: "2026-07-02T12:02:00.000Z",
          author: { id: "u-1", name: "Ada" },
        },
      });

      await renderScreen();
      expect(
        await screen.findByText("General", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Live send and receive/i)).toBeTruthy();

      await act(async () => {
        await fireEvent.press(screen.getByLabelText("Open General"));
      });

      expect(
        await screen.findByText("Hello team", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(mockJoinMessagesLiveChannel).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: "ch-1" }),
      );

      await act(async () => {
        fireEvent.changeText(
          screen.getByLabelText("Message composer"),
          "From Expo",
        );
      });
      await act(async () => {
        await fireEvent.press(screen.getByLabelText("Send message"));
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/messages/channels/ch-1/messages",
        { content: "From Expo" },
      );
      expect(
        await screen.findByText("From Expo", {}, { timeout: 10_000 }),
      ).toBeTruthy();

      await act(async () => {
        liveEventHandler?.({
          type: "message.created",
          channelId: "ch-1",
          payload: {
            id: "msg-3",
            channelId: "ch-1",
            content: "Live peer",
            isDeleted: false,
            createdAt: "2026-07-02T12:03:00.000Z",
            authorName: "Grace",
            authorId: "u-2",
          },
        });
      });

      expect(
        await screen.findByText("Live peer", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Grace/)).toBeTruthy();
      expect(screen.getByText(/channel:\{channelId\}/i)).toBeTruthy();
    },
    15_000,
  );
});
