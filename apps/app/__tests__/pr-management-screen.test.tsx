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

import { PrManagementScreen } from "@/features/pr/pr-management-screen";

const mockGet = jest.fn();
let mockPermissions = ["pr:read"];

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
      <PrManagementScreen />
    </QueryClientProvider>,
  );
}

describe("PrManagementScreen", () => {
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
    mockPermissions = ["pr:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "clarticle00000000000000001",
          title: "Product launch coverage",
          link: "https://news.example/launch",
          date: "2026-03-15T00:00:00.000Z",
          img: "https://cdn.example/launch.jpg",
          author: {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Alex Example",
            email: "alex@manut.example",
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists PR articles read-only without image or email",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(
          "Product launch coverage",
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(screen.getByText(/2026-03-15 · Alex Example/)).toBeTruthy();
      expect(screen.getByText("https://news.example/launch")).toBeTruthy();
      expect(screen.queryByText(/cdn\.example/)).toBeNull();
      expect(screen.queryByText(/alex@manut.example/)).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(
        "/articles?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
