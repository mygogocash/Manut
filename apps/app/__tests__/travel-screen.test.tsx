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

import { TravelScreen } from "@/features/travel/travel-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
let mockPermissions = ["travel:read", "travel:request"];
const mockUserId = "11111111-1111-4111-8111-111111111111";

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost, put: mockPut }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { id: mockUserId },
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

const pendingRequest = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  requestCode: "TRV-2026-001",
  origin: "Bangkok",
  destination: "Singapore",
  purpose: "Client workshop",
  departureDate: "2026-08-10",
  returnDate: "2026-08-12",
  estimatedBudget: "1200",
  cashAdvance: null,
  currency: "USD",
  category: "general",
  status: "pending",
  createdAt: "2026-07-01T10:00:00.000Z",
  viewerCanAct: false,
  employee: {
    id: mockUserId,
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
  },
};

const approvedRequest = {
  ...pendingRequest,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  requestCode: "TRV-2026-002",
  status: "approved",
  destination: "Tokyo",
  viewerCanAct: false,
};

const actionableRequest = {
  ...pendingRequest,
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  requestCode: "TRV-2026-003",
  viewerCanAct: true,
  employee: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Report",
    email: "report@manut.example",
    department: "Ops",
  },
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
      <TravelScreen />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("TravelScreen", () => {
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
    mockPut.mockReset();
    mockPermissions = ["travel:read", "travel:request"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/travel/requests?")) {
        return Promise.resolve({
          data: [pendingRequest, approvedRequest],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists self travel requests and opens the create dialog",
    async () => {
      await renderScreen();

      expect(
        await screen.findByText("TRV-2026-001", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByLabelText("TRV-2026-001 travel request")).toBeTruthy();
      expect(screen.getByText("TRV-2026-002")).toBeTruthy();

      await fireEvent.press(
        screen.getByRole("button", { name: "Request travel" }),
      );
      expect(
        await screen.findByRole(
          "header",
          { name: "Request travel" },
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
    },
    15_000,
  );

  it(
    "blocks invalid dates before posting a request",
    async () => {
      await renderScreen();
      await screen.findByText("TRV-2026-001", {}, { timeout: 10_000 });

      await fireEvent.press(
        screen.getByRole("button", { name: "Request travel" }),
      );
      await screen.findByRole(
        "header",
        { name: "Request travel" },
        { timeout: 10_000 },
      );

      await fireEvent.changeText(screen.getByLabelText("Origin"), "Bangkok");
      await fireEvent.changeText(
        screen.getByLabelText("Destination"),
        "Singapore",
      );
      await fireEvent.changeText(screen.getByLabelText("Purpose"), "Workshop");
      await fireEvent.changeText(
        screen.getByLabelText("Departure date"),
        "2026-08-12",
      );
      await fireEvent.changeText(
        screen.getByLabelText("Return date"),
        "2026-08-10",
      );

      await fireEvent.press(
        screen.getByRole("button", { name: "Submit request" }),
      );

      expect(
        await screen.findByText(
          "Return date must not be before departure date",
        ),
      ).toBeTruthy();
      expect(mockPost).not.toHaveBeenCalled();
    },
    15_000,
  );

  it(
    "submits a valid travel request",
    async () => {
      mockPost.mockResolvedValue({ data: pendingRequest });
      await renderScreen();
      await screen.findByText("TRV-2026-001", {}, { timeout: 10_000 });

      await fireEvent.press(
        screen.getByRole("button", { name: "Request travel" }),
      );
      await screen.findByRole(
        "header",
        { name: "Request travel" },
        { timeout: 10_000 },
      );

      await fireEvent.changeText(screen.getByLabelText("Origin"), "Bangkok");
      await fireEvent.changeText(
        screen.getByLabelText("Destination"),
        "Singapore",
      );
      await fireEvent.changeText(screen.getByLabelText("Purpose"), "Workshop");
      await fireEvent.changeText(
        screen.getByLabelText("Departure date"),
        "2026-08-10",
      );
      await fireEvent.changeText(
        screen.getByLabelText("Return date"),
        "2026-08-12",
      );

      await fireEvent.press(
        screen.getByRole("button", { name: "Submit request" }),
      );

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith("/travel/requests", {
          origin: "Bangkok",
          destination: "Singapore",
          purpose: "Workshop",
          departureDate: "2026-08-10",
          returnDate: "2026-08-12",
          category: "general",
          currency: "USD",
        });
      });
      expect(
        await screen.findByText("Travel request submitted."),
      ).toBeTruthy();
    },
    15_000,
  );

  it(
    "cancels only pending requests",
    async () => {
      mockPut.mockResolvedValue({
        data: { ...pendingRequest, status: "cancelled" },
      });
      await renderScreen();
      await screen.findByText("TRV-2026-001", {}, { timeout: 10_000 });

      expect(
        screen.queryByRole("button", { name: "Cancel TRV-2026-002" }),
      ).toBeNull();

      await fireEvent.press(
        screen.getByRole("button", { name: "Cancel TRV-2026-001" }),
      );
      await fireEvent.press(
        screen.getByRole("button", { name: "Confirm cancel TRV-2026-001" }),
      );

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith(
          `/travel/requests/${pendingRequest.id}/cancel`,
        );
      });
      expect(
        await screen.findByText("Travel request cancelled."),
      ).toBeTruthy();
    },
    15_000,
  );

  it(
    "hides request actions without travel:request",
    async () => {
      mockPermissions = ["travel:read"];
      await renderScreen();
      await screen.findByText("TRV-2026-001", {}, { timeout: 10_000 });

      expect(
        screen.queryByRole("button", { name: "Request travel" }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Cancel TRV-2026-001" }),
      ).toBeNull();
      expect(
        screen.getByText(
          /Your role can view travel information but cannot submit/,
        ),
      ).toBeTruthy();
    },
    15_000,
  );

  it(
    "approves actionable inbox requests and attaches a URL",
    async () => {
      mockPermissions = ["travel:read", "travel:request", "travel:approve"];
      mockGet.mockImplementation((path: string) => {
        if (path.includes("status=pending") && !path.includes("employeeId=")) {
          return Promise.resolve({
            data: [actionableRequest],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          });
        }
        if (path.startsWith("/travel/requests?")) {
          return Promise.resolve({
            data: [pendingRequest],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          });
        }
        throw new Error(`Unexpected GET ${path}`);
      });
      mockPut.mockResolvedValue({
        data: { ...actionableRequest, status: "approved", viewerCanAct: false },
      });
      mockPost.mockResolvedValue({ data: pendingRequest });

      await renderScreen();
      await screen.findByText("TRV-2026-001", {}, { timeout: 10_000 });

      await fireEvent.press(screen.getByRole("radio", { name: "Pending inbox" }));
      expect(
        await screen.findByText("TRV-2026-003", {}, { timeout: 10_000 }),
      ).toBeTruthy();

      await fireEvent.press(
        screen.getByRole("button", { name: "Approve TRV-2026-003" }),
      );
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith(
          `/travel/requests/${actionableRequest.id}/approve`,
        );
      });

      await fireEvent.press(screen.getByRole("radio", { name: "My requests" }));
      await screen.findByText("TRV-2026-001", {}, { timeout: 10_000 });
      await fireEvent.press(
        screen.getByRole("button", { name: "Add attachment TRV-2026-001" }),
      );
      await fireEvent.changeText(screen.getByLabelText("Name"), "Itinerary");
      await fireEvent.changeText(
        screen.getByLabelText("URL"),
        "https://files.example/itinerary.pdf",
      );
      await fireEvent.press(
        screen.getByRole("button", { name: "Save attachment" }),
      );
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          `/travel/requests/${pendingRequest.id}/attachments`,
          {
            attachments: [
              {
                name: "Itinerary",
                url: "https://files.example/itinerary.pdf",
              },
            ],
          },
        );
      });
    },
    20_000,
  );
});
