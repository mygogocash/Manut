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

import { DealsScreen } from "@/features/deals/deals-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
let mockPermissions = ["deals:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost, put: mockPut }),
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
      mutations: { retry: false },
    },
  });
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <DealsScreen />
    </QueryClientProvider>,
  );
  return { queryClient, unmount: view.unmount };
}

const listPayload = {
  data: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      company: "Acme",
      contact: "Jane Doe",
      value: 15000,
      stage: "proposal",
      probability: 40,
      type: "new",
      country: "TH",
      closeDate: null,
      owner: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Alex Example",
      },
    },
  ],
  meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
};

const pipelinePayload = {
  data: [{ stage: "proposal", count: 1, totalValue: 15000 }],
};

describe("DealsScreen", () => {
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
    mockPermissions = ["deals:read"];
    mockGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/deals/pipeline")) return pipelinePayload;
      if (path.startsWith("/deals?")) return listPayload;
      return listPayload;
    });
  });

  it(
    "lists deals in the pipeline board with summary",
    async () => {
      const { queryClient, unmount } = await renderScreen();
      try {
        expect(
          await screen.findByText("Acme", {}, { timeout: 10_000 }),
        ).toBeTruthy();
        expect(screen.getByLabelText("Pipeline summary")).toBeTruthy();
        expect(screen.getByText(/proposal: 1 · 15000/)).toBeTruthy();
        expect(screen.getByLabelText("Deal pipeline board")).toBeTruthy();
        expect(mockGet).toHaveBeenCalledWith(
          "/deals?page=1&limit=100",
          expect.anything(),
        );
        expect(mockGet).toHaveBeenCalledWith(
          "/deals/pipeline",
          expect.anything(),
        );
        expect(
          screen.queryByRole("button", { name: "Create deal" }),
        ).toBeNull();
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );

  it(
    "creates a deal when the writer has deals:create",
    async () => {
      mockPermissions = ["deals:read", "deals:create"];
      const created = {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        company: "New Co",
        contact: null,
        value: 2500,
        stage: "lead",
        probability: 10,
        type: null,
        country: null,
        closeDate: null,
        notes: "secret note",
        owner: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Alex Example",
          email: "alex@example.com",
        },
        partner: null,
      };
      mockPost.mockResolvedValue({ data: created });

      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Acme", {}, { timeout: 10_000 });

        await fireEvent.changeText(
          await screen.findByLabelText("Company"),
          "New Co",
        );
        await fireEvent.changeText(
          await screen.findByLabelText("Value"),
          "2500",
        );
        await fireEvent.press(
          screen.getByRole("button", { name: "Create deal" }),
        );

        await waitFor(() => {
          expect(mockPost).toHaveBeenCalledWith(
            "/deals",
            expect.objectContaining({
              company: "New Co",
              value: 2500,
              stage: "lead",
              probability: 10,
            }),
          );
        });
        expect(
          await screen.findByText(
            'Created "New Co".',
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
    "moves a deal stage when the writer has deals:update",
    async () => {
      mockPermissions = ["deals:read", "deals:update"];
      mockPut.mockResolvedValue({
        data: {
          ...listPayload.data[0],
          stage: "negotiation",
          notes: null,
        },
      });

      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Acme", {}, { timeout: 10_000 });
        await fireEvent.press(
          screen.getByRole("button", {
            name: "Move Acme to negotiation",
          }),
        );
        await waitFor(() => {
          expect(mockPut).toHaveBeenCalledWith(
            "/deals/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            { stage: "negotiation" },
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
    "edits deal notes via get + put",
    async () => {
      mockPermissions = ["deals:read", "deals:update"];
      mockGet.mockImplementation(async (path: string) => {
        if (path.startsWith("/deals/pipeline")) return pipelinePayload;
        if (path.startsWith("/deals?")) return listPayload;
        if (path === "/deals/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") {
          return {
            data: {
              ...listPayload.data[0],
              notes: "Existing note",
            },
          };
        }
        return listPayload;
      });
      mockPut.mockResolvedValue({
        data: {
          ...listPayload.data[0],
          notes: "Updated note",
        },
      });

      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Acme", {}, { timeout: 10_000 });
        await fireEvent.press(
          screen.getByRole("button", { name: "Edit notes for Acme" }),
        );
        await screen.findByLabelText("Notes", {}, { timeout: 10_000 });
        await fireEvent.changeText(screen.getByLabelText("Notes"), "Updated note");
        await fireEvent.press(
          screen.getByRole("button", { name: "Save notes" }),
        );
        await waitFor(() => {
          expect(mockPut).toHaveBeenCalledWith(
            "/deals/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            { notes: "Updated note" },
          );
        });
        expect(await screen.findByText("Notes saved.")).toBeTruthy();
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );

  it(
    "hides create and stage actions when the reader lacks write permission",
    async () => {
      mockPermissions = ["deals:read"];
      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Acme", {}, { timeout: 10_000 });
        expect(screen.queryByLabelText("Company")).toBeNull();
        expect(
          screen.queryByRole("button", { name: "Create deal" }),
        ).toBeNull();
        expect(
          screen.queryByRole("button", { name: "Move Acme to negotiation" }),
        ).toBeNull();
        expect(
          screen.queryByRole("button", { name: "Edit notes for Acme" }),
        ).toBeNull();
      } finally {
        unmount();
        queryClient.clear();
      }
    },
    15_000,
  );
});
