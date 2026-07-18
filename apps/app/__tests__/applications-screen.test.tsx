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

import { ApplicationsScreen } from "@/features/applications/applications-screen";

const mockGet = jest.fn();
let mockPermissions = ["application:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const applicationRecord = {
  id: "a0000000-0000-4000-8000-000000000020",
  name: "Jordan Applicant",
  email: "jordan@example.com",
  mobile: "+66123456789",
  linkedin: "https://linkedin.com/in/jordan",
  website: null,
  attachment: "r2://private/resumes/jordan.pdf",
  createdAt: "2026-02-01T12:00:00.000Z",
  job: {
    id: "a0000000-0000-4000-8000-000000000010",
    title: "Platform Engineer",
    department: "Engineering",
    location: "Bangkok",
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
      <ApplicationsScreen />
    </QueryClientProvider>,
  );
}

describe("ApplicationsScreen", () => {
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
    mockPermissions = ["application:read"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/applications?")) {
        return Promise.resolve({
          data: [applicationRecord],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists applications without exposing resume storage urls",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(
          "Jordan Applicant",
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(/Platform Engineer · Engineering · Bangkok/),
      ).toBeTruthy();
      expect(screen.getByText(/Resume on file/)).toBeTruthy();
      expect(screen.queryByText(/r2:\/\//)).toBeNull();
    },
    15_000,
  );

  it("blocks the screen when application permissions are missing", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(
        /You do not have permission to view applications/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
