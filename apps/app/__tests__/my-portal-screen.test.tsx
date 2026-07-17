import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { MyPortalScreen } from "@/features/my-portal/my-portal-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["leave:read", "performance:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@manut.example",
  name: "Portal Person",
  avatarUrl: null,
  isActive: true,
  mustChangePassword: false,
  phone: "+66 80 000 0000",
  phonePublic: false,
  department: "Operations",
  jobTitle: "Coordinator",
  employeeId: "MNT-001",
  employmentType: "full_time",
  startDate: "2024-01-15",
  endDate: null,
  location: "Bangkok",
  country: "Thailand",
  timezone: "Asia/Bangkok",
  entity: { id: "entity-1", name: "Manut", code: "MNT" },
  roles: [{ id: "role-1", name: "Employee" }],
};

const balance = {
  id: "11111111-1111-4111-8111-111111111111",
  leaveType: {
    id: "annual-leave",
    name: "Annual leave",
    code: "AL",
    category: "earned",
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

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MyPortalScreen />
    </QueryClientProvider>,
  );
}

describe("MyPortalScreen", () => {
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
    mockPermissions = ["leave:read", "performance:read"];
    mockGet.mockImplementation((path: string) => {
      if (path === "/auth/me/profile") {
        return Promise.resolve({ data: { profile } });
      }
      if (path === "/leave/balances") {
        return Promise.resolve({ data: [balance] });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it("renders the profile header and leave balance widgets", async () => {
    await renderScreen();
    expect(
      await screen.findByText("Portal Person", {}, { timeout: 10_000 }),
    ).toBeTruthy();
    expect(screen.getByText("Operations")).toBeTruthy();
    expect(screen.getByText("Coordinator")).toBeTruthy();
    expect(screen.getByText("Annual leave")).toBeTruthy();
    expect(screen.getByText(/9\.5/)).toBeTruthy();
  });

  it("shows permission-gated deep links and navigates", async () => {
    await renderScreen();
    await screen.findByText("Portal Person", {}, { timeout: 10_000 });

    expect(
      screen.getByRole("button", { name: "Open Leave" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open Performance" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open Settings" }),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Open Leave" }));
    });
    expect(mockPush).toHaveBeenCalledWith("/leave");
  });

  it("hides leave widgets without leave:read", async () => {
    mockPermissions = ["performance:read"];
    await renderScreen();
    await screen.findByText("Portal Person", {}, { timeout: 10_000 });
    expect(screen.queryByText("Annual leave")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open Leave" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open Performance" }),
    ).toBeTruthy();
  });
});
