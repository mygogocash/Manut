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

import { CareersScreen } from "@/features/careers/careers-screen";

const mockGet = jest.fn();
let mockPermissions = ["career:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const jobRecord = {
  id: "a0000000-0000-4000-8000-000000000010",
  title: "Platform Engineer",
  slug: "platform-engineer",
  type: "full_time",
  location: "Bangkok",
  department: "Engineering",
  description: "Build the intranet platform.",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  _count: { applications: 3 },
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
      <CareersScreen />
    </QueryClientProvider>,
  );
}

describe("CareersScreen", () => {
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
    mockPermissions = ["career:read"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/career?")) {
        return Promise.resolve({
          data: [jobRecord],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists active job postings",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(
          "Platform Engineer",
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(screen.getByText(/Engineering · Bangkok · Full time/)).toBeTruthy();
      expect(screen.getByText(/3 application\(s\)/)).toBeTruthy();
      expect(screen.queryByText(/platform-engineer/)).toBeNull();
    },
    15_000,
  );

  it("blocks the screen when career permissions are missing", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(
        /You do not have permission to view job postings/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
