import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Linking } from "react-native";

import { LearningScreen } from "@/features/learning/learning-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
let mockPermissions = ["learning:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const moduleRecord = {
  id: "cllearningmod0000000000001",
  title: "Security Basics",
  description: "Required annual training",
  category: "compliance",
  duration: 45,
  url: "https://learn.manut.example/security",
  fileUrl: "r2://private/security.pdf",
  fileName: "security.pdf",
  isMandatory: true,
  isActive: true,
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
      <LearningScreen />
    </QueryClientProvider>,
  );
}

describe("LearningScreen", () => {
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
    mockPermissions = ["learning:read"];
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/learning/modules?")) {
        return Promise.resolve({
          data: [moduleRecord],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      if (path.startsWith("/learning/completions?")) {
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists learning modules without exposing storage urls",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(
          /Security Basics · Mandatory/,
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(screen.getByText(/Attachment: security.pdf/)).toBeTruthy();
      expect(screen.queryByText(/r2:\/\//)).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/learning/modules?"),
        expect.anything(),
      );
    },
    15_000,
  );

  it("blocks the screen when learning permissions are missing", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(
        /You do not have permission to view learning modules/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it(
    "shows mark complete for learning:complete and refreshes completions",
    async () => {
      mockPermissions = ["learning:complete"];
      let completions: Array<Record<string, unknown>> = [];
      mockPost.mockImplementation(async () => {
        const completion = {
          id: "cllearningcomp000000000001",
          moduleId: moduleRecord.id,
          employeeId: "cluser00000000000000000001",
          completedAt: "2026-02-01T12:00:00.000Z",
          score: null,
          module: {
            id: moduleRecord.id,
            title: moduleRecord.title,
            category: moduleRecord.category,
          },
          employee: {
            id: "cluser00000000000000000001",
            name: "Alex Learner",
            email: "alex@manut.example",
          },
        };
        completions = [completion];
        return { data: completion };
      });
      mockGet.mockImplementation((path: string) => {
        if (path.startsWith("/learning/modules?")) {
          return Promise.resolve({
            data: [moduleRecord],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          });
        }
        if (path.startsWith("/learning/completions?")) {
          return Promise.resolve({
            data: completions,
            meta: {
              page: 1,
              limit: 100,
              total: completions.length,
              totalPages: completions.length > 0 ? 1 : 0,
            },
          });
        }
        throw new Error(`Unexpected GET ${path}`);
      });

      await renderScreen();
      const markButton = await screen.findByRole(
        "button",
        { name: /Mark complete: Security Basics/ },
        { timeout: 10_000 },
      );
      expect(markButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(markButton);
      });

      expect(mockPost).toHaveBeenCalledWith("/learning/completions", {
        moduleId: moduleRecord.id,
      });
      expect(
        await screen.findByText(
          /Security Basics · Mandatory · Completed/,
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: /Mark complete: Security Basics/ }),
      ).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/learning/completions?"),
        expect.anything(),
      );
    },
    15_000,
  );

  it(
    "hides mark complete without learning:complete permission",
    async () => {
      mockPermissions = ["learning:read"];
      await renderScreen();
      expect(
        await screen.findByText(
          /Security Basics · Mandatory/,
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: /Mark complete:/ }),
      ).toBeNull();
      expect(mockGet).not.toHaveBeenCalledWith(
        expect.stringContaining("/learning/completions?"),
        expect.anything(),
      );
    },
    15_000,
  );
});
