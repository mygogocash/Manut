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

import { QaCrmDetailScreen } from "@/features/qa-crm/qa-crm-detail-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["qa-crm:read"];

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
      <QaCrmDetailScreen />
    </QueryClientProvider>,
  );
}

describe("QaCrmDetailScreen", () => {
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
    mockPermissions = ["qa-crm:read"];
    mockGet.mockResolvedValue({
      data: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Regression suite",
        slug: "regression-suite",
        status: "active",
        department: "QA",
        sortOrder: 1,
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: null,
        role: "member",
        owner: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Alex Example",
        },
      },
    });
  });

  it(
    "shows read-only QA project detail",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Regression suite", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/active · QA/)).toBeTruthy();
      expect(screen.getByText("Owner: Alex Example")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/qa-crm/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        expect.anything(),
      );
    },
    15_000,
  );
});
