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

import { DocsScreen } from "@/features/docs/docs-screen";

const mockGet = jest.fn();
let mockPermissions = ["docs:read"];

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
      <DocsScreen />
    </QueryClientProvider>,
  );
}

describe("DocsScreen", () => {
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
    mockPermissions = ["docs:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "clwiki00000000000000000001",
          title: "Onboarding guide",
          body: "# Full markdown body",
          slug: "onboarding-guide",
          folder: "hr",
          parentId: null,
          isPublished: true,
          isRestricted: false,
          createdBy: {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Alex Example",
            email: "alex@manut.example",
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists wiki pages read-only without body or email",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Onboarding guide", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(
        screen.getByText(/onboarding-guide · hr · Published/),
      ).toBeTruthy();
      expect(screen.getByText("Alex Example")).toBeTruthy();
      expect(screen.queryByText(/Full markdown body/)).toBeNull();
      expect(screen.queryByText(/alex@manut.example/)).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(
        "/docs?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );
});
