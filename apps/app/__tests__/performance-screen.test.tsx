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

import { PerformanceScreen } from "@/features/performance/performance-screen";

const mockGet = jest.fn();
let mockPermissions = ["performance:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

const appraisal = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  cycleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  employeeId: "11111111-1111-4111-8111-111111111111",
  managerId: "22222222-2222-4222-8222-222222222222",
  status: "self_review",
  selfRating: 4,
  selfComment: "On track",
  managerRating: null,
  managerComment: null,
  finalRating: null,
  completedAt: null,
  cycle: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "H1 2026",
    status: "active",
  },
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
  },
  manager: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Manager",
    email: "manager@manut.example",
  },
  goals: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      appraisalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "Ship Expo parity",
      description: null,
      weight: 40,
      selfScore: 4,
      managerScore: null,
      status: "in_progress",
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-02T10:00:00.000Z",
    },
  ],
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-02T09:00:00.000Z",
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
      <PerformanceScreen />
    </QueryClientProvider>,
  );
}

describe("PerformanceScreen", () => {
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
    mockPermissions = ["performance:read"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/performance/appraisals?")) {
        return Promise.resolve({
          data: [appraisal],
          meta: { page: 1, limit: 20, total: 21, totalPages: 2 },
        });
      }
      if (path === `/performance/appraisals/${appraisal.id}`) {
        return Promise.resolve({ data: appraisal });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it("renders appraisal list rows from the API", async () => {
    await renderScreen();
    expect(
      await screen.findByText("Person", {}, { timeout: 10_000 }),
    ).toBeTruthy();
    expect(screen.getByText("H1 2026")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Open Person appraisal for H1 2026",
      }),
    ).toBeTruthy();
  });

  it(
    "opens a read-only appraisal detail with goals",
    async () => {
      await renderScreen();
      await screen.findByText("Person", {}, { timeout: 10_000 });
      await act(async () => {
        fireEvent.press(
          screen.getByRole("button", {
            name: "Open Person appraisal for H1 2026",
          }),
        );
      });
      expect(
        await screen.findByText(/Ship Expo parity/i, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Self rating:\s*4/i)).toBeTruthy();
    },
    15_000,
  );

  it("paginates to the next page of appraisals", async () => {
    await renderScreen();
    await screen.findByText("Person", {}, { timeout: 10_000 });
    mockGet.mockImplementation((path: string) => {
      if (path.includes("page=2")) {
        return Promise.resolve({
          data: [
            {
              ...appraisal,
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              employee: {
                ...appraisal.employee,
                name: "Page Two",
              },
            },
          ],
          meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
        });
      }
      if (path.startsWith("/performance/appraisals?")) {
        return Promise.resolve({
          data: [appraisal],
          meta: { page: 1, limit: 20, total: 21, totalPages: 2 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Next page" }));
    });

    await waitFor(
      () => {
        expect(screen.getByText("Page Two")).toBeTruthy();
      },
      { timeout: 10_000 },
    );
  });
});
