import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { OfficeScreen } from "@/features/office/office-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
let mockPermissions = ["office:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost, delete: mockDelete }),
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

const bookingRecord = {
  id: "a0000000-0000-4000-8000-000000000010",
  roomId: roomRecord.id,
  date: "2026-07-21",
  timeSlot: "10:00",
  endTime: "11:00",
  title: "Team sync",
  description: "Weekly planning",
  attendeesCount: 4,
  room: {
    id: roomRecord.id,
    name: "Meeting A",
    floor: "3",
    office: { id: officeRecord.id, name: "Bangkok HQ", city: "Bangkok" },
  },
  employee: {
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

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    cleanup();
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
    mockPermissions = ["office:read"];
    mockGet.mockImplementation((path: string) => {
      if (path === "/office/offices") {
        return Promise.resolve({ data: [officeRecord] });
      }
      if (path === "/office/rooms") {
        return Promise.resolve({ data: [roomRecord] });
      }
      if (path === "/office/rooms/my-bookings") {
        return Promise.resolve({ data: [bookingRecord] });
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

  afterEach(() => {
    cleanup();
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

  it(
    "hides self-booking when office:book is missing",
    async () => {
      mockPermissions = ["office:read"];
      await renderScreen();
      expect(
        await screen.findByText("Locations", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(await screen.findByText("Bangkok HQ")).toBeTruthy();
      expect(screen.queryByText("Book a room")).toBeNull();
      expect(screen.queryByText("My bookings")).toBeNull();
      expect(mockGet).not.toHaveBeenCalledWith(
        "/office/rooms/my-bookings",
        expect.anything(),
      );
    },
    15_000,
  );

  it(
    "books a room and cancels an upcoming booking when office:book is granted",
    async () => {
      mockPermissions = ["office:read", "office:book"];
      mockPost.mockResolvedValue({ data: bookingRecord });
      mockDelete.mockResolvedValue({ data: { success: true } });

      await renderScreen();
      expect(await screen.findByText("Book a room")).toBeTruthy();
      expect(screen.getByText(/Meeting A · 2026-07-21 · 10:00–11:00/)).toBeTruthy();

      fireEvent.press(screen.getByRole("radio", { name: "Meeting A" }));
      await act(async () => {
        fireEvent.changeText(screen.getByLabelText("Date"), "2026-07-22");
        fireEvent.changeText(screen.getByLabelText("Start time"), "14:00");
        fireEvent.changeText(screen.getByLabelText("End time"), "15:00");
      });
      fireEvent.press(screen.getByRole("button", { name: "Book room" }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith("/office/rooms/book", {
          roomId: roomRecord.id,
          date: "2026-07-22",
          timeSlot: "14:00",
          endTime: "15:00",
        });
      });
      expect(await screen.findByText("Room booked.")).toBeTruthy();

      fireEvent.press(
        screen.getByRole("button", { name: "Cancel booking Meeting A" }),
      );
      fireEvent.press(
        await screen.findByRole("button", {
          name: "Confirm cancel Meeting A booking",
        }),
      );

      await screen.findByText("Booking cancelled.");
      expect(mockDelete).toHaveBeenCalledWith(
        `/office/rooms/bookings/${bookingRecord.id}`,
      );
    },
    15_000,
  );
});
