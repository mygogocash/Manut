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

import { PartnerDetailScreen } from "@/features/partners/partner-detail-screen";

const mockGet = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["partners:read"];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({
    partnerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
      <PartnerDetailScreen />
    </QueryClientProvider>,
  );
}

describe("PartnerDetailScreen", () => {
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
    mockPermissions = ["partners:read"];
    mockGet.mockResolvedValue({
      data: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        slug: "acme-corp",
        company: "Acme Corp",
        type: "reseller",
        status: "prospect",
        department: "Marketing",
        region: "APAC",
        country: "TH",
        description: "Channel partner",
        productionLiveDate: "2026-03-01T00:00:00.000Z",
        goLiveDate: "2026-04-01T00:00:00.000Z",
        dependency: "Legal review",
        owner: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Alex Example",
        },
        _count: { projects: 2 },
      },
    });
  });

  it(
    "shows read-only partner detail",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Acme Corp", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/reseller · prospect · APAC · TH/)).toBeTruthy();
      expect(screen.getByText("Owner: Alex Example")).toBeTruthy();
      expect(screen.getByText("Channel partner")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/partners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        expect.anything(),
      );
    },
    15_000,
  );
});
