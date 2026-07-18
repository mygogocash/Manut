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

import { VisaChecklistTemplatesScreen } from "@/features/visa/visa-checklist-templates-screen";

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
      <VisaChecklistTemplatesScreen />
    </QueryClientProvider>,
  );
}

describe("VisaChecklistTemplatesScreen", () => {
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
    mockGet.mockResolvedValue({
      data: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          visaType: "non_immigrant_b",
          country: "TH",
          name: "Standard B checklist",
          items: [{ id: "i1" }],
          isActive: true,
        },
      ],
    });
  });

  it(
    "lists checklist templates read-only",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(
          "Standard B checklist",
          {},
          { timeout: 10_000 },
        ),
      ).toBeTruthy();
      expect(screen.getByText(/1 item/)).toBeTruthy();
      expect(mockGet).toHaveBeenCalledWith(
        "/visa-checklist/templates",
        expect.anything(),
      );
    },
    15_000,
  );
});
