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

import { LeaveScreen } from "@/features/leave/leave-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
let mockPermissions = ["leave:read", "leave:request"];
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

const leaveType = {
  id: "annual-leave",
  entityId: null,
  entity: null,
  name: "Annual leave",
  code: "AL",
  description: null,
  category: "earned",
  daysPerYear: 12,
  requiresApproval: true,
  isPaid: true,
  isActive: true,
};

const balance = {
  id: "11111111-1111-4111-8111-111111111111",
  leaveType: {
    id: leaveType.id,
    name: leaveType.name,
    code: leaveType.code,
    category: leaveType.category,
  },
  year: 2026,
  entitled: 12,
  used: 2.5,
  carried: 1,
  carriedUsed: 0,
  carriedExpiry: "2026-12-31",
  carriedExpired: false,
  carriedRemaining: 1,
  adjustment: 0,
  remaining: 9.5,
};

const pendingRequest = {
  id: "22222222-2222-4222-8222-222222222222",
  leaveType: {
    id: leaveType.id,
    name: leaveType.name,
    code: leaveType.code,
    category: leaveType.category,
    daysPerYear: 12,
    requiresApproval: true,
  },
  startDate: "2026-07-20T00:00:00.000Z",
  endDate: "2026-07-20T00:00:00.000Z",
  durationType: "full_day",
  halfDayPeriod: null,
  days: "1.0",
  reason: "Personal appointment",
  status: "pending",
  createdAt: "2026-07-01T10:00:00.000Z",
  employee: { id: mockUserId, email: "private@manut.example" },
};

const cancelledRequest = {
  ...pendingRequest,
  id: "33333333-3333-4333-8333-333333333333",
  startDate: "2026-06-01T00:00:00.000Z",
  endDate: "2026-06-02T00:00:00.000Z",
  days: "2.0",
  status: "cancelled",
  reason: "Old trip",
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
      <LeaveScreen />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("LeaveScreen", () => {
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
    mockPermissions = ["leave:read", "leave:request"];
    mockGet.mockImplementation((path: string) => {
      if (path === "/leave/types")
        return Promise.resolve({ data: [leaveType] });
      if (path === "/leave/balances")
        return Promise.resolve({ data: [balance] });
      if (path.startsWith("/leave/requests?"))
        return Promise.resolve({
          data: [pendingRequest, cancelledRequest],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        });
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "renders exact balances and opens a preselected request dialog",
    async () => {
      await renderScreen();

      expect(
        await screen.findByText("Annual leave", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("9.5 / 12 days remaining")).toBeTruthy();
      expect(screen.getByText("2.5 used · 1 carried available")).toBeTruthy();

      await act(async () => {
        fireEvent.press(
          screen.getByRole("button", { name: "Apply for Annual leave" }),
        );
      });
      expect(
        await screen.findByRole(
          "header",
          { name: "Request leave" },
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(
        screen.getByRole("radio", { name: "Annual leave" }).props
          .accessibilityState,
      ).toMatchObject({ selected: true });
    },
    15_000,
  );

  it("blocks an invalid calendar date before sending a request", async () => {
    await renderScreen();
    await screen.findByText("Annual leave");
    await fireEvent.press(
      screen.getByRole("button", { name: "Apply for Annual leave" }),
    );
    await fireEvent.changeText(
      screen.getByLabelText("Start date (YYYY-MM-DD)"),
      "2026-02-30",
    );
    await fireEvent.changeText(
      screen.getByLabelText("End date (YYYY-MM-DD)"),
      "2026-02-30",
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Submit request" }),
    );

    expect(await screen.findByText("Enter a valid calendar date")).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("submits a validated request and refreshes the balance", async () => {
    mockPost.mockResolvedValue({
      data: {
        id: "request-1",
        status: "pending",
        employee: { id: "private", email: "private@manut.example" },
      },
    });
    await renderScreen();
    await screen.findByText("Annual leave");
    await fireEvent.press(
      screen.getByRole("button", { name: "Apply for Annual leave" }),
    );
    await fireEvent.changeText(
      screen.getByLabelText("Start date (YYYY-MM-DD)"),
      "2026-07-20",
    );
    await fireEvent.changeText(
      screen.getByLabelText("End date (YYYY-MM-DD)"),
      "2026-07-20",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Reason (optional)"),
      "  Personal appointment  ",
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Submit request" }),
    );

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("/leave/requests", {
        leaveTypeId: leaveType.id,
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        durationType: "full_day",
        reason: "Personal appointment",
        source: "entitled",
      }),
    );
    expect(await screen.findByText("Leave request submitted.")).toBeTruthy();
    expect(
      mockGet.mock.calls.filter(([path]) => path === "/leave/balances"),
    ).toHaveLength(2);
    expect(screen.queryByRole("header", { name: "Request leave" })).toBeNull();
  });

  it("lists my leave history and cancels a pending request", async () => {
    mockPut.mockResolvedValue({
      data: {
        id: pendingRequest.id,
        status: "cancelled",
        employee: { id: mockUserId, email: "private@manut.example" },
      },
    });
    await renderScreen();

    expect(await screen.findByText("My leave requests")).toBeTruthy();
    expect(screen.getByText("Annual leave · pending")).toBeTruthy();
    expect(screen.getByText("2026-07-20 · 1.0 day")).toBeTruthy();
    expect(screen.getByText("Annual leave · cancelled")).toBeTruthy();
    expect(screen.getByText("2026-06-01 – 2026-06-02 · 2.0 days")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Cancel Old trip leave request",
      }),
    ).toBeNull();

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Cancel Personal appointment leave request",
      }),
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Confirm cancel Personal appointment leave request",
      }),
    );

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith(
        `/leave/requests/${pendingRequest.id}/cancel`,
      ),
    );
    expect(
      await screen.findByText("Leave request cancelled."),
    ).toBeTruthy();
    expect(
      mockGet.mock.calls.filter(([path]) => path === "/leave/balances").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      mockGet.mock.calls.filter(([path]) =>
        String(path).startsWith("/leave/requests?"),
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("keeps balances when history fails and hides cancel without leave:request", async () => {
    mockPermissions = ["leave:read"];
    mockGet.mockImplementation((path: string) => {
      if (path === "/leave/types")
        return Promise.resolve({ data: [leaveType] });
      if (path === "/leave/balances")
        return Promise.resolve({ data: [balance] });
      if (path.startsWith("/leave/requests?"))
        return Promise.reject(new Error("history unavailable"));
      throw new Error(`Unexpected GET ${path}`);
    });

    await renderScreen();

    expect(await screen.findByText("Annual leave")).toBeTruthy();
    expect(screen.getByText("9.5 / 12 days remaining")).toBeTruthy();
    expect(
      await screen.findByText("We could not load your leave requests."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Cancel Personal appointment leave request",
      }),
    ).toBeNull();
  });

  it("paginates leave request history", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/leave/types")
        return Promise.resolve({ data: [leaveType] });
      if (path === "/leave/balances")
        return Promise.resolve({ data: [balance] });
      if (path.includes("page=2")) {
        return Promise.resolve({
          data: [
            {
              ...cancelledRequest,
              id: "44444444-4444-4444-8444-444444444444",
              reason: "Second page trip",
              status: "approved",
            },
          ],
          meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
        });
      }
      if (path.startsWith("/leave/requests?")) {
        return Promise.resolve({
          data: [pendingRequest, cancelledRequest],
          meta: { page: 1, limit: 20, total: 21, totalPages: 2 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });

    await renderScreen();
    await screen.findByText("My leave requests");
    expect(
      screen.getByRole("button", { name: "Next leave history page" }),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.press(
        screen.getByRole("button", { name: "Next leave history page" }),
      );
    });

    expect(
      await screen.findByText("Annual leave · approved", {}, { timeout: 10_000 }),
    ).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
      expect.anything(),
    );
  });

  it("surfaces cancel failures without a success message", async () => {
    mockPut.mockRejectedValue(new Error("cancel failed"));
    await renderScreen();
    await screen.findByText("My leave requests");

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Cancel Personal appointment leave request",
      }),
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Confirm cancel Personal appointment leave request",
      }),
    );

    expect(
      await screen.findByText("The leave request could not be cancelled."),
    ).toBeTruthy();
    expect(screen.queryByText("Leave request cancelled.")).toBeNull();
  });
});
