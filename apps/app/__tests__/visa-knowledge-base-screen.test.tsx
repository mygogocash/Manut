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

import { VisaKnowledgeBaseScreen } from "@/features/visa/visa-knowledge-base-screen";

const mockGet = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <VisaKnowledgeBaseScreen />
    </QueryClientProvider>,
  );
}

describe("VisaKnowledgeBaseScreen", () => {
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
    mockGet.mockResolvedValue({
      data: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          title: "Non-immigrant B overview",
          slug: "non-immigrant-b-overview",
          country: "TH",
          visaType: "non_immigrant_b",
          tags: ["work"],
          isActive: true,
          updatedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists visa knowledge-base articles read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(
          "Non-immigrant B overview",
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(screen.getByText("TH · non_immigrant_b")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/visa-kb?"),
        expect.anything(),
      );
    },
    15_000,
  );
});
