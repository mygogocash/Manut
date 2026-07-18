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

import { VoucherCrmScreen } from "@/features/voucher-crm/voucher-crm-screen";

const mockGet = jest.fn();
let mockPermissions = ["voucher-crm:read"];

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
      <VoucherCrmScreen />
    </QueryClientProvider>,
  );
}

describe("VoucherCrmScreen", () => {
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
    mockPermissions = ["voucher-crm:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          partner: "Acme Retail",
          country: "TH",
          redeemed: 10,
          issued: 20,
          refund: 1,
          creator: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
          },
        },
      ],
      totals: { redeemed: 10, issued: 20, refund: 1 },
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists voucher entries read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Acme Retail", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(
        screen.getByText(/TH · issued 20 · redeemed 10 · refund 1/),
      ).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/voucher-crm?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
