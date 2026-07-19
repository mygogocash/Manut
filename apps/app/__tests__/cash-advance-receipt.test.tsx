import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Linking } from "react-native";

import { CashAdvanceScreen } from "@/features/cash-advance/cash-advance-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
let mockPermissions = ["cash-advance:read", "cash-advance:approve"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({
    get: mockGet,
    post: mockPost,
    delete: mockDelete,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const submitted = {
  id: requestId,
  requestNumber: 42,
  requestDate: "2026-07-18",
  payoutMode: "cash",
  currency: "THB",
  status: "submitted",
  requestedTotal: 1500,
  approvedTotal: 0,
  rejectReason: null,
  employee: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Alex",
    email: "alex@manut.example",
  },
  entity: { id: "entity-1", name: "Manut" },
  items: [
    {
      id: itemId,
      description: "Field travel float",
      requestedAmount: 1500,
      approvedAmount: 0,
      receiptUrl: "https://files.example/receipts/r1.pdf",
    },
  ],
  notes: "internal",
  bankAccountNo: "secret",
};

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <CashAdvanceScreen />
    </QueryClientProvider>,
  );
}

describe("CashAdvanceScreen receipt open", () => {
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
    mockDelete.mockReset();
    mockPermissions = ["cash-advance:read", "cash-advance:approve"];
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    mockGet.mockImplementation((path: string) => {
      if (path.includes("status=submitted") && path.includes("scope=all")) {
        return Promise.resolve({
          data: [submitted],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      if (path.includes("status=approved") && path.includes("scope=all")) {
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      }
      if (path.includes("status=disbursed") && path.includes("scope=all")) {
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      }
      if (
        path ===
        `/cash-advance/${requestId}/items/${itemId}/receipt`
      ) {
        return Promise.resolve({
          data: { url: "https://signed.example/receipt.pdf" },
        });
      }
      if (path.startsWith("/cash-advance?")) {
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "opens a signed receipt from the pending approval inbox",
    async () => {
      await renderScreen();
      expect(await screen.findByText(/Alex · CA-42/)).toBeTruthy();
      await fireEvent.press(
        screen.getByLabelText(
          "View receipt for Field travel float on CA-42",
        ),
      );
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          `/cash-advance/${requestId}/items/${itemId}/receipt`,
          undefined,
        );
        expect(Linking.openURL).toHaveBeenCalledWith(
          "https://signed.example/receipt.pdf",
        );
      });
    },
    15_000,
  );

  it(
    "opens a signed receipt from my cash-advance list",
    async () => {
      mockPermissions = ["cash-advance:read", "cash-advance:create"];
      const mine = { ...submitted, status: "draft" };
      mockGet.mockImplementation((path: string) => {
        if (path.startsWith("/cash-advance?") && path.includes("scope=mine")) {
          return Promise.resolve({
            data: [mine],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          });
        }
        if (
          path ===
          `/cash-advance/${requestId}/items/${itemId}/receipt`
        ) {
          return Promise.resolve({
            data: { url: "https://signed.example/receipt.pdf" },
          });
        }
        throw new Error(`Unexpected GET ${path}`);
      });

      await renderScreen();
      expect(
        await screen.findByLabelText("View receipt for Field travel float on CA-42"),
      ).toBeTruthy();
      await fireEvent.press(
        screen.getByLabelText(
          "View receipt for Field travel float on CA-42",
        ),
      );
      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          "https://signed.example/receipt.pdf",
        );
      });
    },
    15_000,
  );
});
