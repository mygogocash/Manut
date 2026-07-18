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

import { ProjectsDashboardScreen } from "@/features/projects/projects-dashboard-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["projects:read"];

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
      <ProjectsDashboardScreen />
    </QueryClientProvider>,
  );
}

describe("ProjectsDashboardScreen", () => {
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
    mockPermissions = ["projects:read"];
    mockGet.mockResolvedValue({
      data: {
        total: 4,
        productionLive: 1,
        atRisk: 1,
        inProgress: 2,
        byStatus: [{ status: "in_progress", count: 2 }],
        byDepartment: [{ department: "Engineering", count: 3 }],
        upcomingGoLives: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            name: "Intranet hardening",
            slug: "intranet-hardening",
            status: "in_progress",
            department: "Engineering",
            goLiveDate: "2026-08-01T00:00:00.000Z",
            revisedGoLiveDate: null,
            owner: {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              name: "Alex Example",
            },
          },
        ],
        recentUpdates: [],
      },
    });
  });

  it(
    "shows read-only projects dashboard rollup",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Projects dashboard", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("Total: 4")).toBeTruthy();
      expect(screen.getByText("At risk: 1")).toBeTruthy();
      expect(screen.getByText("in_progress: 2")).toBeTruthy();
      expect(screen.getByText("Intranet hardening")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/projects/dashboard?team=general",
        expect.anything(),
      );
    },
    15_000,
  );
});
