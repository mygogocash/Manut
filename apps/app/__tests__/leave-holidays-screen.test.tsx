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

import { LeaveHolidaysScreen } from "@/features/leave/leave-holidays-screen";

const mockGet = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <LeaveHolidaysScreen />
    </QueryClientProvider>,
  );
}

describe("LeaveHolidaysScreen", () => {
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
      if (path.startsWith("/holidays?")) {
        return Promise.resolve({
          data: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              entityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              date: "2026-12-25",
              name: "Christmas Day",
              notes: null,
              isActive: true,
              entity: {
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                name: "Manut",
                code: "MNT",
              },
            },
          ],
          meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists public holidays for the selected year",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Christmas Day", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/2026-12-25 · Manut/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("year="),
        expect.anything(),
      );

      await fireEvent.press(
        screen.getByRole("button", { name: "Next holiday year" }),
      );
      await screen.findByText("Christmas Day", {}, { timeout: 10_000 });
      expect(mockGet).toHaveBeenCalled();
    },
    15_000,
  );
});
