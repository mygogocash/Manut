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
let mockPermissions = ["deals:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost }),
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
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
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
    mockPermissions = ["deals:read"];
    mockGet.mockResolvedValue(listPayload);
  });

  it(
    "lists deals read-only",
    async () => {
      const { queryClient, unmount } = await renderScreen();
      try {
        expect(
          await screen.findByText("Acme", {}, { timeout: 10_000 }),
        ).toBeTruthy();
        expect(screen.getByText(/proposal · 15000 · Jane Doe/)).toBeTruthy();
        expect(mockGet).toHaveBeenCalledWith(
          "/deals?page=1&limit=20",
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
      mockGet
        .mockResolvedValueOnce(listPayload)
        .mockResolvedValue({
          data: [
            ...listPayload.data,
            {
              id: created.id,
              company: created.company,
              contact: created.contact,
              value: created.value,
              stage: created.stage,
              probability: created.probability,
              type: created.type,
              country: created.country,
              closeDate: created.closeDate,
              owner: { id: created.owner.id, name: created.owner.name },
            },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        });

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
    "hides create form when the reader lacks deals:create",
    async () => {
      mockPermissions = ["deals:read"];
      const { queryClient, unmount } = await renderScreen();
      try {
        await screen.findByText("Acme", {}, { timeout: 10_000 });
        expect(screen.queryByLabelText("Company")).toBeNull();
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
});
