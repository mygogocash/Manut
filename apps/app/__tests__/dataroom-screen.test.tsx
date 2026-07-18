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

import { DataroomScreen } from "@/features/dataroom/dataroom-screen";

const mockGet = jest.fn();
let mockPermissions = ["dataroom:read"];

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
      <DataroomScreen />
    </QueryClientProvider>,
  );
}

describe("DataroomScreen", () => {
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
    mockPermissions = ["dataroom:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Series A deck",
          description: "Investor pitch",
          category: "pitch",
          fileSize: 204800,
          mimeType: "application/pdf",
          version: 2,
          uploadedAt: "2026-07-01T00:00:00.000Z",
          uploader: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists dataroom documents read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Series A deck", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/pitch · application\/pdf · v2/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/dataroom?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
