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

import { ProjectDetailScreen } from "@/features/projects/project-detail-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["projects:read", "projects:update"];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }),
}));

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

const projectPayload = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Intranet hardening",
  slug: "intranet-hardening",
  status: "in_progress",
  team: "general",
  department: "Engineering",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
  },
  _count: { tasks: 1 },
  startDate: "2026-01-01T00:00:00.000Z",
  goLiveDate: "2026-08-01T00:00:00.000Z",
  workstream: "Hardening",
  columns: [
    {
      id: "col-1",
      key: "todo",
      label: "To do",
      sortOrder: 0,
    },
    {
      id: "col-2",
      key: "done",
      label: "Done",
      sortOrder: 1,
    },
  ],
  tasks: [
    {
      id: "task-1",
      title: "Ship board read",
      status: "todo",
      priority: "P1",
      sortOrder: 0,
      owner: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Alex Example",
      },
    },
  ],
};

const membersPayload = {
  data: [
    {
      id: "member-1",
      role: "member",
      user: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        name: "Sam",
        email: "sam@example.com",
      },
    },
  ],
};

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <ProjectDetailScreen />
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
}

describe("ProjectDetailScreen", () => {
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
    mockPut.mockReset();
    mockDelete.mockReset();
    mockPush.mockReset();
    mockPermissions = ["projects:read", "projects:update"];
    mockGet.mockImplementation(async (path: string) => {
      if (path.endsWith("/members")) return membersPayload;
      return { data: projectPayload };
    });
  });

  it(
    "shows board columns, tasks, and members from project detail",
    async () => {
      const { queryClient, unmount } = await renderScreen();
      try {
        expect(
          await screen.findByText(
            "Intranet hardening",
            {},
            { timeout: 10_000 },
          ),
        ).toBeTruthy();
        expect(screen.getAllByText("To do").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
        expect(screen.getByText("Ship board read")).toBeTruthy();
        expect(screen.getByLabelText("Project members")).toBeTruthy();
        expect(screen.getByText(/Sam · member/)).toBeTruthy();
        expect(mockGet).toHaveBeenCalledWith(
          "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          expect.anything(),
        );
        expect(mockGet).toHaveBeenCalledWith(
          "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/members",
          expect.anything(),
        );
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );

  it(
    "creates a task with column and priority when the writer has update permission",
    async () => {
      const createdTask = {
        id: "task-new",
        title: "Write create path",
        status: "done",
        priority: "P0",
        sortOrder: 1,
        owner: null,
      };
      mockPost.mockResolvedValue({ data: createdTask });

      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Ship board read", {}, { timeout: 10_000 });

        await fireEvent.changeText(
          await screen.findByLabelText("Task title"),
          "Write create path",
        );
        await fireEvent.press(screen.getByRole("button", { name: "Done" }));
        await fireEvent.press(screen.getByRole("button", { name: "P0" }));
        await fireEvent.press(
          screen.getByRole("button", { name: "Create task" }),
        );

        await waitFor(() => {
          expect(mockPost).toHaveBeenCalledWith(
            "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tasks",
            expect.objectContaining({
              title: "Write create path",
              status: "done",
              priority: "P0",
            }),
          );
        });
        expect(
          await screen.findByText(
            'Created "Write create path".',
            {},
            { timeout: 10_000 },
          ),
        ).toBeTruthy();
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );

  it(
    "moves a task to another column via reorder",
    async () => {
      mockPost.mockResolvedValue({ data: { updated: 1 } });
      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Ship board read", {}, { timeout: 10_000 });
        await fireEvent.press(
          screen.getByRole("button", {
            name: "Move Ship board read to Done",
          }),
        );
        await waitFor(() => {
          expect(mockPost).toHaveBeenCalledWith(
            "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tasks/reorder",
            {
              orderedIds: ["task-1"],
              status: "done",
            },
          );
        });
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );

  it(
    "edits a task title",
    async () => {
      mockPut.mockResolvedValue({
        data: {
          ...projectPayload.tasks[0],
          title: "Renamed task",
        },
      });

      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Ship board read", {}, { timeout: 10_000 });
        await fireEvent.press(
          screen.getByRole("button", {
            name: "Edit title for Ship board read",
          }),
        );
        await fireEvent.changeText(
          screen.getByLabelText("Edit task title"),
          "Renamed task",
        );
        await fireEvent.press(
          screen.getByRole("button", {
            name: "Save title for Ship board read",
          }),
        );
        await waitFor(() => {
          expect(mockPut).toHaveBeenCalledWith(
            "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tasks/task-1",
            { title: "Renamed task" },
          );
        });
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );

  it(
    "deletes a task",
    async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });

      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Ship board read", {}, { timeout: 10_000 });
        await fireEvent.press(
          screen.getByRole("button", {
            name: "Delete Ship board read",
          }),
        );
        await waitFor(() => {
          expect(mockDelete).toHaveBeenCalledWith(
            "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tasks/task-1",
          );
        });
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );

  it(
    "hides create and task write actions when the reader lacks write permission",
    async () => {
      mockPermissions = ["projects:read"];
      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Ship board read", {}, { timeout: 10_000 });
        expect(screen.queryByLabelText("Task title")).toBeNull();
        expect(
          screen.queryByRole("button", { name: "Create task" }),
        ).toBeNull();
        expect(
          screen.queryByRole("button", {
            name: "Move Ship board read to Done",
          }),
        ).toBeNull();
        expect(
          screen.queryByRole("button", {
            name: "Delete Ship board read",
          }),
        ).toBeNull();
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );
});
