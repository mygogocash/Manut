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

import { CashAdvanceScreen } from "@/features/cash-advance/cash-advance-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
let mockPermissions = ["cash-advance:read", "cash-advance:create"];

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

const draft = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  requestNumber: 42,
  requestDate: "2026-07-18",
  payoutMode: "cash",
  currency: "THB",
  status: "draft",
  requestedTotal: 1500,
  approvedTotal: 0,
  rejectReason: null,
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
  },
  entity: { id: "entity-1", name: "Manut" },
  items: [{ id: "item-1", description: "Field travel float" }],
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

describe("CashAdvanceScreen", () => {
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
    mockPermissions = ["cash-advance:read", "cash-advance:create"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/cash-advance?")) {
        return Promise.resolve({
          data: [draft],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists my cash advances and supports submit",
    async () => {
      mockPost.mockResolvedValue({
        data: { ...draft, status: "submitted", items: draft.items },
      });
      await renderScreen();
      expect(
        await screen.findByText(/CA-42 · Draft/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/1500 THB|1,500 THB/)).toBeTruthy();
      expect(
        screen.queryByLabelText("Pending cash-advance approvals"),
      ).toBeNull();

      await fireEvent.press(screen.getByLabelText("Submit CA-42"));
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          `/cash-advance/${draft.id}/submit`,
          {},
        );
      });
    },
    15_000,
  );

  it(
    "approves a submitted cash advance from the pending inbox",
    async () => {
      mockPermissions = ["cash-advance:read", "cash-advance:approve"];
      const submitted = {
        ...draft,
        status: "submitted",
        employee: {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Alex",
          email: "alex@manut.example",
        },
      };
      mockGet.mockImplementation((path: string) => {
        if (path.includes("status=submitted") && path.includes("scope=all")) {
          return Promise.resolve({
            data: [submitted],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
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
      mockPost.mockResolvedValue({
        data: { ...submitted, status: "approved", approvedTotal: 1500 },
      });

      await renderScreen();
      expect(await screen.findByText(/Alex · CA-42/)).toBeTruthy();
      await fireEvent.press(
        screen.getByLabelText("Approve cash advance for Alex"),
      );
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          `/cash-advance/${submitted.id}/approve`,
          {},
        );
      });
      expect(await screen.findByText("Cash advance approved.")).toBeTruthy();
    },
    15_000,
  );

  it(
    "creates a cash draft from the form",
    async () => {
      mockPost.mockResolvedValue({ data: { ...draft, items: draft.items } });
      await renderScreen();
      await screen.findByLabelText("New cash advance request", {}, {
        timeout: 10_000,
      });
      await fireEvent.press(screen.getByLabelText("New cash advance request"));
      await fireEvent.changeText(
        screen.getByLabelText("Line description"),
        "Field travel float",
      );
      await fireEvent.changeText(screen.getByLabelText("Amount"), "1500");
      await fireEvent.press(screen.getByLabelText("Create cash advance draft"));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          "/cash-advance",
          expect.objectContaining({
            payoutMode: "cash",
            currency: "THB",
            items: [
              {
                description: "Field travel float",
                requestedAmount: 1500,
              },
            ],
          }),
        );
      });
    },
    15_000,
  );
});
