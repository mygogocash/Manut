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

import { ProjectsScreen } from "@/features/projects/projects-screen";

const mockGet = jest.fn();
let mockPermissions = ["projects:read"];

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
      <ProjectsScreen />
    </QueryClientProvider>,
  );
}

describe("ProjectsScreen", () => {
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
    mockPermissions = ["projects:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Intranet hardening",
          slug: "intranet-hardening",
          status: "in_progress",
          team: "general",
          department: "Engineering",
          owner: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Alex Example",
          },
          _count: { tasks: 12 },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists projects read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(
          "Intranet hardening",
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(screen.getByText(/in_progress · general · Engineering/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/projects?page=1&limit=20&team=general",
        expect.anything(),
      );
    },
    15_000,
  );
});
