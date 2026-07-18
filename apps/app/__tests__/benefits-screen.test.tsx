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

import { BenefitsScreen } from "@/features/benefits/benefits-screen";

const mockGet = jest.fn();
let mockPermissions = ["benefits:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const benefit = {
  id: "clbenefit00000000000000001",
  name: "Health Plus",
  category: "health",
  description: "Core medical plan",
  provider: "Manut Care",
  cost: "1200.00",
  currency: "THB",
  isActive: true,
  entity: { id: "clentity00000000000000001", name: "Manut Ops" },
  _count: { enrollments: 12 },
};

const enrollment = {
  id: "clenroll000000000000000001",
  benefitId: benefit.id,
  employeeId: "11111111-1111-4111-8111-111111111111",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
  },
  startDate: "2026-01-15T00:00:00.000Z",
  endDate: null,
  status: "active",
  benefit: {
    id: benefit.id,
    name: "Health Plus",
    category: "health",
    provider: "Manut Care",
    cost: "1200.00",
    currency: "THB",
  },
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
      <BenefitsScreen />
    </QueryClientProvider>,
  );
}

describe("BenefitsScreen", () => {
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
    mockPermissions = ["benefits:read"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/benefits?")) {
        return Promise.resolve({
          data: [benefit],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      if (path === "/benefits/my-enrollments") {
        return Promise.resolve({ data: [enrollment] });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "shows catalog and my enrollments",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(/Health Plus · Health/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Health Plus · active/)).toBeTruthy();
      expect(screen.queryByText(/person@manut.example/)).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/benefits?"),
        expect.anything(),
      );
      expect(mockGet).toHaveBeenCalledWith(
        "/benefits/my-enrollments",
        expect.anything(),
      );
    },
    15_000,
  );

  it("blocks the screen when benefits permissions are missing", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(
        /You do not have permission to view benefits/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
