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

import { SurveyDetailScreen } from "@/features/survey/survey-detail-screen";

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPost = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["survey:manage"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({
    get: mockGet,
    put: mockPut,
    post: mockPost,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: "surv1" }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <SurveyDetailScreen />
    </QueryClientProvider>,
  );
}

describe("SurveyDetailScreen", () => {
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
    mockPut.mockReset();
    mockPost.mockReset();
    mockPush.mockReset();
    mockPermissions = ["survey:manage"];
    mockGet.mockResolvedValue({
      data: {
        id: "surv1",
        title: "Pulse",
        description: "Weekly",
        status: "draft",
        isAnonymous: false,
        questions: [],
        _count: { questions: 0, responses: 0 },
      },
    });
  });

  it("hides question builder without survey:manage", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(await screen.findByText("Pulse")).toBeTruthy();
    expect(screen.queryByLabelText("Add question")).toBeNull();
    expect(screen.queryByLabelText("Save questions")).toBeNull();
    expect(screen.queryByLabelText("Publish survey")).toBeNull();
  });

  it("saves questions via PUT and publishes via POST when manage-gated", async () => {
    mockPut.mockResolvedValue({
      data: {
        id: "surv1",
        title: "Pulse",
        status: "draft",
        questions: [
          {
            id: "q1",
            order: 0,
            type: "short_text",
            prompt: "Team?",
            required: false,
            options: [],
          },
        ],
        _count: { questions: 1, responses: 0 },
      },
    });
    mockPost.mockResolvedValue({
      data: {
        id: "surv1",
        title: "Pulse",
        status: "published",
        publishedAt: "2026-07-18T00:00:00.000Z",
        questions: [
          {
            id: "q1",
            order: 0,
            type: "short_text",
            prompt: "Team?",
            required: false,
            options: [],
          },
        ],
        _count: { questions: 1, responses: 0 },
      },
    });

    await renderScreen();
    expect(await screen.findByText("Pulse")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Add question"));
    await fireEvent.changeText(
      screen.getByLabelText("Question 1 prompt"),
      "Team?",
    );
    await fireEvent.press(screen.getByLabelText("Save questions"));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith("/survey/surv1/questions", {
        questions: [
          {
            type: "short_text",
            prompt: "Team?",
            helperText: null,
            required: false,
            options: [],
            settings: {},
          },
        ],
      });
    });

    await fireEvent.press(screen.getByLabelText("Publish survey"));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/survey/surv1/publish", {});
    });
    expect(await screen.findByText("Survey published.")).toBeTruthy();
  });

  it("announces, schedules, archives, and shows analytics for published surveys", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/survey/surv1") {
        return Promise.resolve({
          data: {
            id: "surv1",
            title: "Pulse",
            status: "published",
            questions: [],
            _count: { questions: 0, responses: 2 },
          },
        });
      }
      if (path === "/survey/surv1/analytics") {
        return Promise.resolve({
          data: {
            totalResponses: 2,
            questions: [
              {
                id: "q1",
                prompt: "Score?",
                type: "rating",
                responses: 2,
                kind: "numeric",
                average: 4,
                min: 3,
                max: 5,
              },
            ],
          },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
    mockPost.mockImplementation((path: string) => {
      if (path === "/survey/surv1/announce") {
        return Promise.resolve({ data: { posted: ["wall"] } });
      }
      if (path === "/survey/surv1/archive") {
        return Promise.resolve({
          data: {
            id: "surv1",
            title: "Pulse",
            status: "closed",
            questions: [],
            _count: { questions: 0, responses: 2 },
          },
        });
      }
      throw new Error(`Unexpected POST ${path}`);
    });
    mockPut.mockResolvedValue({
      data: {
        id: "surv1",
        title: "Pulse",
        status: "published",
        questions: [],
        _count: { questions: 0, responses: 2 },
      },
    });

    await renderScreen();
    expect(await screen.findByText("Pulse")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Announce survey"));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/survey/surv1/announce", {
        announce: { wall: true, news: false, companyDate: false },
      });
    });

    await fireEvent.changeText(
      screen.getByLabelText("Start date (YYYY-MM-DD)"),
      "2026-07-01",
    );
    await fireEvent.changeText(
      screen.getByLabelText("End date (YYYY-MM-DD)"),
      "2026-07-31",
    );
    await fireEvent.press(screen.getByLabelText("Save survey schedule"));
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith("/survey/surv1/schedule", {
        startDate: "2026-07-01",
        endDate: "2026-07-31",
      });
    });

    await fireEvent.press(screen.getByLabelText("Toggle survey analytics"));
    expect(await screen.findByText("Total responses: 2")).toBeTruthy();
    expect(await screen.findByText(/Score\?: 2 answers/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Archive survey"));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/survey/surv1/archive", {});
    });
  });
});
