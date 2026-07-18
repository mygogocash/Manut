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

import { BlogManagementScreen } from "@/features/blogs/blog-management-screen";

const mockGet = jest.fn();
let mockPermissions = ["blog:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <BlogManagementScreen />
    </QueryClientProvider>,
  );
}

describe("BlogManagementScreen", () => {
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
    mockPermissions = ["blog:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "clblog00000000000000000001",
          title: "Intranet update",
          content: "<p>secret body</p>",
          slug: "intranet-update",
          active: true,
          author: {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Alex Example",
            email: "alex@manut.example",
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it(
    "lists blogs read-only without HTML body",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Intranet update", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(
        screen.getByText(/intranet-update · Active · Alex Example/),
      ).toBeTruthy();
      expect(screen.queryByText(/secret body/)).toBeNull();
      expect(screen.queryByText(/alex@manut.example/)).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(
        "/blogs?page=1&limit=20",
        expect.anything(),
      );
    },
    15_000,
  );

  it("blocks the screen when blog permissions are missing", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(
        /You do not have permission to view blogs/,
        {},
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
