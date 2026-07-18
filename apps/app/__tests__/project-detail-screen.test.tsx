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

import { ProjectDetailScreen } from "@/features/projects/project-detail-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["projects:read"];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }),
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
      <ProjectDetailScreen />
    </QueryClientProvider>,
  );
}

describe("ProjectDetailScreen", () => {
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
        startDate: "2026-01-01T00:00:00.000Z",
        goLiveDate: "2026-08-01T00:00:00.000Z",
        workstream: "Hardening",
      },
    });
  });

  it(
    "shows read-only project detail",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Intranet hardening", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/in_progress · general · Engineering/)).toBeTruthy();
      expect(screen.getByText("Owner: Alex Example")).toBeTruthy();
      expect(screen.getByText("Workstream: Hardening")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        expect.anything(),
      );
    },
    15_000,
  );
});
