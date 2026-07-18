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
const mockPush = jest.fn();
let mockPermissions = ["projects:read", "projects:update"];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }),
}));

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost }),
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
    mockPush.mockReset();
    mockPermissions = ["projects:read", "projects:update"];
    mockGet.mockResolvedValue({ data: projectPayload });
  });

  it(
    "shows board columns and tasks from project detail",
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
        expect(screen.getByText("To do")).toBeTruthy();
        expect(screen.getByText("Done")).toBeTruthy();
        expect(screen.getByText("Ship board read")).toBeTruthy();
        expect(mockGet).toHaveBeenCalledWith(
          "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
    "creates a task when the writer has update permission",
    async () => {
      const createdTask = {
        id: "task-new",
        title: "Write create path",
        status: "todo",
        priority: "P1",
        sortOrder: 1,
        owner: null,
      };
      mockPost.mockResolvedValue({ data: createdTask });
      mockGet
        .mockResolvedValueOnce({ data: projectPayload })
        .mockResolvedValue({
          data: {
            ...projectPayload,
            _count: { tasks: 2 },
            tasks: [...projectPayload.tasks, createdTask],
          },
        });

      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Ship board read", {}, { timeout: 10_000 });

        await fireEvent.changeText(
          await screen.findByLabelText("Task title"),
          "Write create path",
        );
        await fireEvent.press(
          screen.getByRole("button", { name: "Create task" }),
        );

        await waitFor(() => {
          expect(mockPost).toHaveBeenCalledWith(
            "/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tasks",
            expect.objectContaining({
              title: "Write create path",
              status: "todo",
              priority: "P1",
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
    "hides create task when the reader lacks write permission",
    async () => {
      mockPermissions = ["projects:read"];
      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Ship board read", {}, { timeout: 10_000 });
        expect(screen.queryByLabelText("Task title")).toBeNull();
        expect(
          screen.queryByRole("button", { name: "Create task" }),
        ).toBeNull();
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );
});
