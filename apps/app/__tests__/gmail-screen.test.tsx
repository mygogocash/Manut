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

import { GmailScreen } from "@/features/gmail/gmail-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockHasPermission = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost }),
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
      <GmailScreen />
    </QueryClientProvider>,
  );
}

describe("GmailScreen", () => {
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
    mockHasPermission.mockImplementation(
      (code: string) => code === "integrations:use",
    );
  });

  it(
    "shows a not-connected state without inventing Gmail messages",
    async () => {
      mockGet.mockResolvedValue({
        data: { google: { connected: false } },
      });

      await renderScreen();
      expect(
        await screen.findByText("Google not connected", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.queryByLabelText("Gmail inbox")).toBeNull();
      expect(mockPost).not.toHaveBeenCalled();
    },
    15_000,
  );

  it(
    "lists inbox messages when Google is connected",
    async () => {
      mockGet.mockResolvedValue({
        data: {
          google: {
            connected: true,
            accountEmail: "person@manut.example",
          },
        },
      });
      mockPost.mockResolvedValue({
        data: [
          {
            id: "msg-1",
            from: "ops@example.com",
            subject: "Weekly status",
            snippet: "Here is the update",
            labelIds: ["INBOX", "UNREAD"],
            date: "2026-07-01T12:00:00.000Z",
          },
        ],
        nextPageToken: null,
      });

      await renderScreen();
      expect(
        await screen.findByText("Weekly status", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByLabelText("Gmail inbox")).toBeTruthy();
      expect(mockPost).toHaveBeenCalledWith("/integrations/gmail/list", {
        folder: "inbox",
        pageSize: 25,
      });
    },
    15_000,
  );
});
