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

import { OfficeScreen } from "@/features/office/office-screen";

const mockGet = jest.fn();
let mockPermissions = ["office:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const officeRecord = {
  id: "cloffice000000000000000001",
  name: "Bangkok HQ",
  address: "1 Example Road",
  city: "Bangkok",
  country: "Thailand",
  timezone: "Asia/Bangkok",
  capacity: 120,
  isActive: true,
};

const roomRecord = {
  id: "a0000000-0000-4000-8000-000000000001",
  name: "Meeting A",
  capacity: 8,
  amenities: ["tv"],
  imageUrl: "https://cdn.example/room-a.jpg",
  office: { id: officeRecord.id, name: "Bangkok HQ", city: "Bangkok" },
  timeSlots: [],
};

const assetRecord = {
  id: "a0000000-0000-4000-8000-000000000002",
  name: "MacBook Pro",
  type: "laptop",
  serialNo: "SN-123",
  status: "assigned",
  purchaseCost: "1999.00",
  manufacturer: "Apple",
  model: "M3",
  office: { id: officeRecord.id, name: "Bangkok HQ" },
  assignee: {
    id: "a0000000-0000-4000-8000-000000000099",
    name: "Alex Example",
    email: "alex@example.com",
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
      <OfficeScreen />
    </QueryClientProvider>,
  );
}

describe("OfficeScreen", () => {
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
    mockPermissions = ["office:read"];
    mockGet.mockImplementation((path: string) => {
      if (path === "/office/offices") {
        return Promise.resolve({ data: [officeRecord] });
      }
      if (path === "/office/rooms") {
        return Promise.resolve({ data: [roomRecord] });
      }
      if (path.startsWith("/office/assets?")) {
        return Promise.resolve({
          data: [assetRecord],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists offices, rooms, and assets without finance or booking detail",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Bangkok HQ", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Meeting A/)).toBeTruthy();
      expect(screen.getByText(/MacBook Pro/)).toBeTruthy();
      expect(screen.queryByText(/1 Example Road/)).toBeNull();
      expect(screen.queryByText(/1999/)).toBeNull();
      expect(screen.queryByText(/alex@example.com/)).toBeNull();
    },
    15_000,
  );

  it("blocks the screen when office permissions are missing", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(
        /You do not have permission to view office rooms and assets/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
