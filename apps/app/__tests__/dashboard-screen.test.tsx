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

import { DashboardScreen } from "@/features/dashboard/dashboard-screen";

const mockGet = jest.fn();
let mockPermissions = ["home:read", "leave:read", "projects:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { name: "Admin" },
    roles: [{ name: "Admin" }],
    permissions: mockPermissions,
    hasPermission: (code: string) => mockPermissions.includes(code),
    logout: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardScreen />
    </QueryClientProvider>,
  );
}

describe("DashboardScreen", () => {
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
    mockPermissions = ["home:read", "leave:read", "projects:read"];
    mockGet.mockResolvedValue({
      data: {
        kpis: {
          totalEmployees: 12,
          activeProjects: 3,
          pendingLeaves: 2,
          pendingTravels: 0,
          pendingExpenses: 1,
          expensesThisMonth: 100,
        },
        pendingActions: [
          {
            kind: "leave",
            id: "leave-1",
            title: "Approve leave",
            subtitle: "Person · Annual leave",
            href: "/leave",
            createdAt: "2026-07-01T10:00:00.000Z",
          },
        ],
        recentNews: [],
      },
    });
  });

  it("renders permission-gated KPI widgets from dashboard stats", async () => {
    await renderScreen();
    expect(
      await screen.findByText("Pending leave", {}, { timeout: 10_000 }),
    ).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Active projects")).toBeTruthy();
    expect(screen.getByText("Approve leave")).toBeTruthy();
    expect(screen.queryByText("Pending expenses")).toBeNull();
  });
});
