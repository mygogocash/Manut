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

import { LeaveApprovalScreen } from "@/features/leave/leave-approval-screen";

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
      <LeaveApprovalScreen />
    </QueryClientProvider>,
  );
}

describe("LeaveApprovalScreen", () => {
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
          order: 1,
          name: "Manager",
          description: null,
          approverType: "manager",
          approverUserId: null,
          approverUser: null,
          isActive: true,
        },
      ],
    });
  });

  it(
    "lists leave approval steps read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("1. Manager", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("Direct manager")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/leave/approval-steps",
        expect.anything(),
      );
    },
    15_000,
  );
});
