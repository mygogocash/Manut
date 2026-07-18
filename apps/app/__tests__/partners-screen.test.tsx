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

import { PartnersScreen } from "@/features/partners/partners-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["partners:read"];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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
      <PartnersScreen />
    </QueryClientProvider>,
  );
}

describe("PartnersScreen", () => {
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
    mockPush.mockReset();
    mockPermissions = ["partners:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          slug: "acme-corp",
          company: "Acme Corp",
          type: "reseller",
          status: "prospect",
          region: "APAC",
          country: "TH",
          owner: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
          },
          _count: { projects: 2 },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists partners read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Acme Corp", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/reseller · prospect · APAC · TH/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/partners?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
