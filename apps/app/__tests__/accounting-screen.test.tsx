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

import { AccountingScreen } from "@/features/accounting/accounting-screen";

const mockGet = jest.fn();
let mockPermissions = ["accounting:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const account = {
  id: "claccount00000000000000001",
  code: "1000",
  name: "Cash",
  nameTh: "เงินสด",
  type: "asset",
  isActive: true,
  balance: "12500.50",
  entityId: "clentity00000000000000001",
  createdAt: "2026-01-01T00:00:00.000Z",
  entity: {
    id: "clentity00000000000000001",
    name: "Manut Ops",
    currency: "THB",
  },
  parent: null,
};

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <AccountingScreen />
    </QueryClientProvider>,
  );
}

describe("AccountingScreen", () => {
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
    mockPermissions = ["accounting:read"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/accounting/accounts")) {
        return Promise.resolve({ data: [account] });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists chart-of-accounts rows from the accounts API",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(/1000 · Cash/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Manut Ops · Balance/)).toBeTruthy();
      expect(screen.getAllByText(/^Asset$/).length).toBeGreaterThan(0);
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/accounting/accounts?"),
        expect.anything(),
      );
    },
    15_000,
  );

  it("blocks the screen when accounting permissions are missing", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(
        /You do not have permission to view the chart of accounts/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
