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

import { SurveyScreen } from "@/features/survey/survey-screen";

const mockGet = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: () => false,
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
      <SurveyScreen />
    </QueryClientProvider>,
  );
}

describe("SurveyScreen", () => {
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
          id: "surv1",
          title: "Pulse",
          description: "Weekly pulse",
          status: "published",
          isAnonymous: true,
          targetUserIds: ["u1"],
          createdBy: {
            id: "u1",
            name: "Alex",
            email: "alex@manut.example",
          },
          _count: { questions: 3, responses: 10 },
          alreadyResponded: false,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });

  it("lists surveys without creator email or target ids", async () => {
    await renderScreen();
    expect(
      await screen.findByText(/^Pulse$/, {}, { timeout: 10_000 }),
    ).toBeTruthy();
    expect(screen.getByText(/published · 3 questions/)).toBeTruthy();
    expect(screen.queryByText(/alex@manut\.example/)).toBeNull();
    expect(mockGet).toHaveBeenCalledWith(
      "/survey?page=1&limit=20",
      expect.anything(),
    );
  }, 15_000);
});
