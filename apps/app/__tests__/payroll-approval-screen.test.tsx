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

import { PayrollApprovalScreen } from "@/features/payroll/payroll-approval-screen";

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
      <PayrollApprovalScreen />
    </QueryClientProvider>,
  );
}

describe("PayrollApprovalScreen", () => {
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
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          order: 1,
          name: "Finance lead",
          description: null,
          approverUserId: "11111111-1111-4111-8111-111111111111",
          approverUser: {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Finance Lead",
            email: "finance@manut.example",
          },
          isActive: true,
        },
      ],
    });
  });

  it(
    "lists payroll approval steps read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("1. Finance lead", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("Finance Lead")).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/payroll/approval-chain/steps",
        expect.anything(),
      );
    },
    15_000,
  );
});
