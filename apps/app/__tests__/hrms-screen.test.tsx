import {
  act,
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

import { HrmsScreen } from "@/features/hrms/hrms-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
let mockPermissions = [
  "hrms:read",
  "hrms:attendance-read",
  "hrms:esop-manage",
  "hrms:onboarding-manage",
];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const grant = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
  },
  grantDate: "2026-01-15",
  grantType: "equity",
  valueType: "shares",
  shares: 1000,
  vestingMonths: 48,
  vestedToDate: 250,
  status: "vesting",
  notes: "internal",
};

const onboarding = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  employeeName: "Person",
  department: "Operations",
  startDate: "2026-07-01",
  status: "in_progress",
  tasks: [
    { key: "a", label: "Laptop", part: "Setup", done: true },
    { key: "b", label: "NDA", part: "Setup", done: false },
  ],
  entity: { id: "entity-1", name: "Manut" },
};

const today = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  attendanceDate: "2026-07-18",
  status: "present",
  workMode: "office",
  localCheckInTime: "2026-07-18 08:00",
  localCheckOutTime: null,
  totalHours: null,
  lateMinutes: 0,
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
      <HrmsScreen />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("HrmsScreen", () => {
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
    mockPost.mockReset();
    mockPermissions = [
      "hrms:read",
      "hrms:attendance-read",
      "hrms:esop-manage",
      "hrms:onboarding-manage",
    ];
    mockGet.mockImplementation((path: string) => {
      if (path === "/hrms/attendance/today") {
        return Promise.resolve({ data: null });
      }
      if (path.startsWith("/hrms/esop-grants?")) {
        return Promise.resolve({
          data: [grant],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      if (path.startsWith("/hrms/onboarding?")) {
        return Promise.resolve({
          data: [onboarding],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "shows ESOP grants, onboarding progress, and check-in when idle",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(/Equity · vesting/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Granted 2026-01-15 · 1000 shares/)).toBeTruthy();
      expect(screen.getByText("Person", { exact: true })).toBeTruthy();
      expect(screen.getByText(/tasks 1\/2/)).toBeTruthy();
      expect(
        screen.getByText("You have not checked in yet today."),
      ).toBeTruthy();
      expect(screen.getByLabelText("Check in")).toBeTruthy();
    },
    15_000,
  );

  it(
    "checks in with the selected work mode",
    async () => {
      mockPost.mockResolvedValue({
        data: { ...today, workMode: "remote", localCheckInTime: "2026-07-18 09:00" },
      });
      await renderScreen();
      await screen.findByLabelText("Check in", {}, { timeout: 10_000 });

      await fireEvent.press(screen.getByLabelText("Remote"));
      await fireEvent.press(screen.getByLabelText("Check in"));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith("/hrms/attendance/check-in", {
          workMode: "remote",
        });
      });
    },
    15_000,
  );

  it(
    "offers check-out when already checked in",
    async () => {
      mockGet.mockImplementation((path: string) => {
        if (path === "/hrms/attendance/today") {
          return Promise.resolve({ data: today });
        }
        if (path.startsWith("/hrms/esop-grants?")) {
          return Promise.resolve({
            data: [],
            meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
          });
        }
        if (path.startsWith("/hrms/onboarding?")) {
          return Promise.resolve({
            data: [],
            meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
          });
        }
        throw new Error(`Unexpected GET ${path}`);
      });
      mockPost.mockResolvedValue({
        data: { ...today, localCheckOutTime: "2026-07-18 17:00" },
      });

      await renderScreen();
      expect(
        await screen.findByLabelText("Check out", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      await fireEvent.press(screen.getByLabelText("Check out"));
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith("/hrms/attendance/check-out", {});
      });
    },
    15_000,
  );
});
