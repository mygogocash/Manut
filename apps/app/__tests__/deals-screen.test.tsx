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

import { DealsScreen } from "@/features/deals/deals-screen";

const mockGet = jest.fn();
let mockPermissions = ["deals:read"];

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
      <DealsScreen />
    </QueryClientProvider>,
  );
}

describe("DealsScreen", () => {
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
    mockPermissions = ["deals:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          company: "Acme",
          contact: "Jane Doe",
          value: 15000,
          stage: "proposal",
          probability: 40,
          type: "new",
          country: "TH",
          closeDate: null,
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
    "lists deals read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Acme", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/proposal · 15000 · Jane Doe/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/deals?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
