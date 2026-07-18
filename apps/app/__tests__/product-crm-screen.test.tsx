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

import { ProductCrmScreen } from "@/features/product-crm/product-crm-screen";

const mockGet = jest.fn();
let mockPermissions = ["product-crm:read"];

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
      <ProductCrmScreen />
    </QueryClientProvider>,
  );
}

describe("ProductCrmScreen", () => {
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
    mockPermissions = ["product-crm:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Mobile release",
          slug: "mobile-release",
          status: "not_yet_started",
          department: "Product",
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
    "lists product-crm projects read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Mobile release", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/product-crm?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
