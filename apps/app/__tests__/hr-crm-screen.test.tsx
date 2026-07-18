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

import { HrCrmScreen } from "@/features/hr-crm/hr-crm-screen";

const mockGet = jest.fn();
let mockPermissions = ["hr-crm:read"];

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
      <HrCrmScreen />
    </QueryClientProvider>,
  );
}

describe("HrCrmScreen", () => {
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
    mockPermissions = ["hr-crm:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Onboarding track",
          slug: "onboarding-track",
          status: "in_progress",
          team: "hr",
          department: "People",
          owner: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
          },
          _count: { tasks: 4 },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists HR team projects read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Onboarding track", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/in_progress · hr · People/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/projects?page=1&limit=20&team=hr",
        expect.anything(),
      );
    },
    15_000,
  );
});
