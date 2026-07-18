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

import { EmployeesScreen } from "@/features/employees/employees-screen";

const mockGet = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@manut.example",
  name: "Person Example",
  phone: null,
  department: "Operations",
  jobTitle: "Coordinator",
  employeeId: "E-100",
  employmentType: "full_time",
  location: null,
  country: null,
  isActive: true,
  entity: { id: "entity-1", name: "Manut Ops" },
  manager: null,
  roles: [{ id: "33333333-3333-4333-8333-333333333333", name: "Employee" }],
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
      <EmployeesScreen />
    </QueryClientProvider>,
  );
}

describe("EmployeesScreen", () => {
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
      if (path.startsWith("/admin/users?")) {
        return Promise.resolve({
          data: [user],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists employees from the admin users API",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Person Example", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/person@manut\.example · E-100/)).toBeTruthy();
      expect(screen.getByText(/Active · Full-time/)).toBeTruthy();
      expect(screen.getByText("Roles: Employee")).toBeTruthy();
    },
    15_000,
  );

  it(
    "searches and filters inactive employees",
    async () => {
      await renderScreen();
      await screen.findByText("Person Example", {}, { timeout: 10_000 });

      await fireEvent.changeText(screen.getByLabelText("Search"), "Person");
      await fireEvent.press(
        screen.getByRole("button", { name: "Search employees" }),
      );

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining("search=Person"),
          expect.anything(),
        );
      });

      await fireEvent.press(
        screen.getByRole("button", { name: "Filter by Inactive" }),
      );

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining("isActive=false"),
          expect.anything(),
        );
      });
    },
    15_000,
  );
});
