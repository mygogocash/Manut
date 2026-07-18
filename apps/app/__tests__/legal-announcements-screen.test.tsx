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

import { LegalAnnouncementsScreen } from "@/features/legal-announcements/legal-announcements-screen";

const mockGet = jest.fn();
let mockPermissions = ["legal:announcement-read"];

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
      <LegalAnnouncementsScreen />
    </QueryClientProvider>,
  );
}

describe("LegalAnnouncementsScreen", () => {
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
    mockPermissions = ["legal:announcement-read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "clann000000000000000000001",
          title: "Handbook update",
          body: "<p>full body</p>",
          kind: "handbook",
          status: "published",
          pinned: true,
          requiresAck: true,
          attachments: [{ id: "a1", fileName: "handbook.pdf" }],
          ackCount: 3,
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists announcements without body or attachments",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(
          /Handbook update · Pinned/,
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(/Handbook · published · Ack required/),
      ).toBeTruthy();
      expect(screen.queryByText(/full body/)).toBeNull();
      expect(screen.queryByText(/handbook\.pdf/)).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(
        "/legal-announcements?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
