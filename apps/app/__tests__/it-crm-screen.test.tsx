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

import { ItCrmScreen } from "@/features/it-crm/it-crm-screen";

const mockGet = jest.fn();
let mockPermissions = ["it-crm:read"];

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
      <ItCrmScreen />
    </QueryClientProvider>,
  );
}

describe("ItCrmScreen", () => {
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
    mockPermissions = ["it-crm:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Edge gateway",
          slug: "edge-gateway",
          status: "in_progress",
          department: "Engineering",
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
    "lists it-crm projects read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Edge gateway", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/in_progress · Engineering/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/it-crm?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
