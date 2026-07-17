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

import { DirectoryScreen } from "@/features/directory/directory-screen";
import { runLockedTransition } from "@/features/directory/transition-lock";

const mockGet = jest.fn();
let mockPermissions: string[] = [];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

const employee = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Person",
  email: "person@manut.example",
  avatarUrl: null,
  department: "Operations",
  jobTitle: "Coordinator",
  employeeId: "MNT-001",
  employmentType: "full_time",
  location: "Bangkok",
  country: "Thailand",
  isActive: true,
  startDate: null,
  entity: { id: "entity-1", name: "Manut", code: "MNT" },
  manager: null,
  salary: "must-not-leak",
  currency: "SECRET",
};

function directoryResponse(page = 1) {
  return {
    data: [employee],
    meta: { page, limit: 24, total: 25, totalPages: 2 },
  };
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DirectoryScreen />
    </QueryClientProvider>,
  );
}

describe("DirectoryScreen", () => {
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
    mockPermissions = ["directory:read"];
    mockGet.mockImplementation((path: string) => {
      if (path === "/directory/departments") {
        return Promise.resolve({
          data: [
            { name: "Operations", count: 3 },
            { name: "Product", count: 2 },
          ],
        });
      }
      return Promise.resolve(
        directoryResponse(path.includes("page=2") ? 2 : 1),
      );
    });
  });

  it("renders the redacted directory and filters by runtime department", async () => {
    await renderScreen();

    expect(await screen.findByText("Person")).toBeTruthy();
    expect(screen.getByText("person@manut.example")).toBeTruthy();
    expect(screen.getByText("Standard directory view")).toBeTruthy();

    await fireEvent.press(
      await screen.findByRole("button", { name: "Filter by Operations" }),
    );

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "/directory?page=1&limit=24&department=Operations",
        expect.objectContaining({ signal: expect.any(Object) }),
      ),
    );
  });

  it("moves through server pagination without exposing hidden fields", async () => {
    await renderScreen();
    expect(await screen.findByText("Page 1 of 2")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Page 2 of 2")).toBeTruthy();
    expect(
      screen.getByText("Showing 1 of 25 employees. Page 2 of 2."),
    ).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith(
      "/directory?page=2&limit=24",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(screen.queryByText("must-not-leak")).toBeNull();
  });

  it("keeps the search shell mounted while new filters are loading", async () => {
    let resolveSecondPage:
      ((value: ReturnType<typeof directoryResponse>) => void) | undefined;
    mockGet.mockImplementation((path: string) => {
      if (path === "/directory/departments") {
        return Promise.resolve({ data: [] });
      }
      if (path.includes("page=2")) {
        return new Promise((resolve) => {
          resolveSecondPage = resolve;
        });
      }
      return Promise.resolve(directoryResponse());
    });
    await renderScreen();
    expect(await screen.findByText("Person")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Updating directory results…")).toBeTruthy();
    expect(screen.getByLabelText("Search directory")).toBeTruthy();

    await act(async () => {
      resolveSecondPage?.(directoryResponse(2));
    });
    expect(await screen.findByText("Page 2 of 2")).toBeTruthy();
  });

  it("allows only one synchronous transition for a rapid interaction", () => {
    const lock = { current: false };
    const update = jest.fn();

    expect(runLockedTransition(lock, update)).toBe(true);
    expect(runLockedTransition(lock, update)).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("keeps pagination hidden while the next page request is pending", async () => {
    let resolveSecondPage:
      ((value: ReturnType<typeof directoryResponse>) => void) | undefined;
    mockGet.mockImplementation((path: string) => {
      if (path === "/directory/departments")
        return Promise.resolve({ data: [] });
      if (path.includes("page=2")) {
        return new Promise((resolve) => {
          resolveSecondPage = resolve;
        });
      }
      return Promise.resolve(directoryResponse());
    });
    await renderScreen();
    expect(await screen.findByText("Page 1 of 2")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Updating directory results…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();

    await waitFor(() =>
      expect(
        mockGet.mock.calls.filter(([path]) => String(path).includes("page=2")),
      ).toHaveLength(1),
    );
    expect(
      mockGet.mock.calls.some(([path]) => String(path).includes("page=3")),
    ).toBe(false);

    await act(async () => {
      resolveSecondPage?.(directoryResponse(2));
    });
    expect(await screen.findByText("Page 2 of 2")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Previous page" }).props
        .accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  it("keeps available filters usable while the selected filter is a no-op", async () => {
    await renderScreen();
    expect(await screen.findByText("Person")).toBeTruthy();

    expect(
      screen.getByRole("button", { name: "Filter by all departments" }).props
        .accessibilityState,
    ).toMatchObject({ selected: true, disabled: true });
    expect(
      screen.getByRole("button", { name: "Filter by Operations" }).props
        .accessibilityState,
    ).toMatchObject({ selected: false, disabled: false });
  });

  it("opens employee detail with reports and closes without leaking metadata", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/directory/departments") {
        return Promise.resolve({ data: [] });
      }
      if (path === `/directory/${employee.id}`) {
        return Promise.resolve({
          data: {
            ...employee,
            timezone: "Asia/Bangkok",
            createdAt: "2026-01-15T08:00:00.000Z",
            metadata: { secret: "must-not-render" },
            directReports: [
              {
                id: "22222222-2222-4222-8222-222222222222",
                name: "Report One",
                jobTitle: "Analyst",
                avatarUrl: null,
                department: "Operations",
              },
            ],
            userRoles: [{ role: { id: "role-1", name: "Employee" } }],
          },
        });
      }
      return Promise.resolve(directoryResponse());
    });

    await renderScreen();
    await fireEvent.press(
      await screen.findByRole("button", { name: "Open Person directory profile" }),
    );

    expect(await screen.findByText("Directory profile")).toBeTruthy();
    expect(await screen.findByText("Asia/Bangkok")).toBeTruthy();
    expect(screen.getByText("Report One · Analyst")).toBeTruthy();
    expect(screen.getByText("Role: Employee")).toBeTruthy();
    expect(screen.queryByText("must-not-render")).toBeNull();
    expect(screen.queryByText(/must-not-leak/)).toBeNull();
    expect(screen.queryByText(/Compensation/)).toBeNull();
    expect(mockGet).toHaveBeenCalledWith(
      `/directory/${employee.id}`,
      expect.objectContaining({ signal: expect.any(Object) }),
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Close directory profile" }),
    );
    expect(screen.queryByText("Directory profile")).toBeNull();
  });
});
