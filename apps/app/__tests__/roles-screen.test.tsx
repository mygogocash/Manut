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

import { RolesScreen } from "@/features/roles/roles-screen";

const mockGet = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

const role = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Employee",
  description: "Default employee role",
  isSystem: true,
  permissionCount: 12,
  userCount: 40,
  createdAt: "2026-01-01T00:00:00.000Z",
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
      <RolesScreen />
    </QueryClientProvider>,
  );
}

describe("RolesScreen", () => {
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
    mockGet.mockImplementation((path: string) => {
      if (path === "/roles") {
        return Promise.resolve({ data: [role] });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists roles without exposing permission codes",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(/Employee · System/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("Default employee role")).toBeTruthy();
      expect(screen.getByText("12 permissions · 40 members")).toBeTruthy();
      expect(screen.queryByText("home:read")).toBeNull();
    },
    15_000,
  );
});
