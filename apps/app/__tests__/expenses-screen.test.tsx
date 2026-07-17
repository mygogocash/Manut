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

import { ExpensesScreen } from "@/features/expenses/expenses-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockUserId = "11111111-1111-4111-8111-111111111111";
let mockPermissions = ["expense:read", "expense:create"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { id: mockUserId },
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const report = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  period: "2026-07",
  title: "July travel meals",
  category: "general",
  status: "submitted",
  submittedAt: "2026-07-10T10:00:00.000Z",
  approvedAt: null,
  rejectReason: null,
  reimbursedAt: null,
  totalAmount: 1250.5,
  totalCurrency: "USD",
  converted: true,
  missingRates: [],
  approvedTotal: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-10T10:00:00.000Z",
  employee: {
    id: mockUserId,
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
  },
  entity: { id: "entity-1", name: "Manut Ops" },
  _count: { expenses: 3 },
};

const draftReport = {
  ...report,
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  title: "July drafts",
  status: "draft",
  submittedAt: null,
  totalAmount: 40,
  _count: { expenses: 1 },
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
      <ExpensesScreen />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("ExpensesScreen", () => {
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
    mockPermissions = ["expense:read", "expense:create"];
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/expenses/reports?")) {
        return Promise.resolve({
          data: [report],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      if (path === `/expenses/reports/${report.id}`) {
        return Promise.resolve({
          data: {
            ...report,
            notes: "internal",
            canApprove: false,
            expenses: [],
          },
        });
      }
      if (path === `/expenses/reports/${draftReport.id}`) {
        return Promise.resolve({
          data: {
            ...draftReport,
            notes: null,
            canApprove: false,
            expenses: [],
          },
        });
      }
      if (path === "/expenses/meta/entities") {
        return Promise.resolve({
          data: [{ id: "entity-1", name: "Manut Ops" }],
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists self expense reports scoped by employeeId",
    async () => {
      await renderScreen();

      expect(
        await screen.findByText("July travel meals", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Submitted · 1250\.5 USD/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining(`employeeId=${mockUserId}`),
        expect.anything(),
      );
    },
    15_000,
  );

  it(
    "opens a detail sheet without exposing line receipts",
    async () => {
      await renderScreen();
      await screen.findByText("July travel meals", {}, { timeout: 10_000 });

      await fireEvent.press(
        screen.getByRole("button", {
          name: "Open expense report July travel meals",
        }),
      );

      expect(
        await screen.findByText("Line items: 3", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText("Entity: Manut Ops")).toBeTruthy();
      expect(screen.queryByText("internal")).toBeNull();
    },
    15_000,
  );

  it(
    "filters by status and resets to page 1",
    async () => {
      await renderScreen();
      await screen.findByText("July travel meals", {}, { timeout: 10_000 });

      await fireEvent.press(
        screen.getByRole("button", { name: "Filter by Approved" }),
      );

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining("status=approved"),
          expect.anything(),
        );
      });
    },
    15_000,
  );

  it(
    "creates a draft, adds a line with receipt URL, and submits",
    async () => {
      mockGet.mockImplementation((path: string) => {
        if (path.startsWith("/expenses/reports?")) {
          return Promise.resolve({
            data: [draftReport],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          });
        }
        if (path === `/expenses/reports/${draftReport.id}`) {
          return Promise.resolve({
            data: {
              ...draftReport,
              notes: null,
              canApprove: false,
              expenses: [],
            },
          });
        }
        if (path === "/expenses/meta/entities") {
          return Promise.resolve({
            data: [{ id: "entity-1", name: "Manut Ops" }],
          });
        }
        throw new Error(`Unexpected GET ${path}`);
      });
      mockPost
        .mockResolvedValueOnce({ data: draftReport })
        .mockResolvedValueOnce({
          data: {
            id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            description: "Taxi",
            amount: "40",
            currency: "USD",
            date: "2026-07-05",
            status: "draft",
          },
        })
        .mockResolvedValueOnce({
          data: { ...draftReport, status: "submitted", _count: { expenses: 1 } },
        });

      await renderScreen();
      await screen.findByText("July drafts", {}, { timeout: 10_000 });

      await fireEvent.press(
        screen.getByRole("button", { name: "New expense report" }),
      );
      expect(
        await screen.findByRole(
          "header",
          { name: "New expense report" },
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      await fireEvent.press(
        await screen.findByRole(
          "radio",
          { name: "Entity Manut Ops" },
          { timeout: 10_000 },
        ),
      );
      await fireEvent.changeText(
        await screen.findByLabelText("Period"),
        "2026-07",
      );
      await fireEvent.changeText(
        await screen.findByLabelText("Title"),
        "July drafts",
      );
      await fireEvent.press(screen.getByRole("button", { name: "Create draft" }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          "/expenses/reports",
          expect.objectContaining({
            entityId: "entity-1",
            period: "2026-07",
            title: "July drafts",
          }),
        );
      });

      expect(
        await screen.findByText("Line items: 1", {}, { timeout: 10_000 }),
      ).toBeTruthy();

      await fireEvent.press(
        screen.getByRole("button", { name: "Add line to July drafts" }),
      );
      await screen.findByRole(
        "header",
        { name: "Add expense line" },
        { timeout: 10_000 },
      );
      await fireEvent.changeText(
        await screen.findByLabelText("Description"),
        "Taxi",
      );
      await fireEvent.changeText(await screen.findByLabelText("Amount"), "40");
      await fireEvent.changeText(
        await screen.findByLabelText("Date"),
        "2026-07-05",
      );
      await fireEvent.changeText(
        await screen.findByLabelText("Receipt URL (optional)"),
        "https://files.example/taxi.pdf",
      );
      await fireEvent.press(screen.getByRole("button", { name: "Save line" }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          `/expenses/reports/${draftReport.id}/expenses`,
          expect.objectContaining({
            description: "Taxi",
            amount: 40,
            currency: "USD",
            date: "2026-07-05",
            receiptUrl: "https://files.example/taxi.pdf",
          }),
        );
      });

      await fireEvent.press(
        screen.getByRole("button", { name: "Submit July drafts" }),
      );
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          `/expenses/reports/${draftReport.id}/submit`,
          {},
        );
      });
    },
    25_000,
  );

  it(
    "hides create actions without expense:create",
    async () => {
      mockPermissions = ["expense:read"];
      await renderScreen();
      await screen.findByText("July travel meals", {}, { timeout: 10_000 });

      expect(
        screen.queryByRole("button", { name: "New expense report" }),
      ).toBeNull();
      expect(
        screen.getByText(
          /Your role can view expense reports but cannot create/,
        ),
      ).toBeTruthy();
    },
    15_000,
  );
});
