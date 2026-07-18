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

import { LeavePoliciesScreen } from "@/features/leave/leave-policies-screen";

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
      <LeavePoliciesScreen />
    </QueryClientProvider>,
  );
}

describe("LeavePoliciesScreen", () => {
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
          id: "annual-leave",
          entityId: null,
          entity: null,
          name: "Annual leave",
          code: "AL",
          description: "Paid annual leave",
          category: "earned",
          daysPerYear: 12,
          requiresApproval: true,
          isPaid: true,
          isActive: true,
        },
      ],
    });
  });

  it(
    "lists leave policies read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Annual leave", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("AL · Earned")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/leave/types/all",
        expect.anything(),
      );
    },
    15_000,
  );
});
