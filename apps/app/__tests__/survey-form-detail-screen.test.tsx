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

import { SurveyFormDetailScreen } from "@/features/survey-forms/survey-form-detail-screen";

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPost = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["survey:manage-wave"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({
    get: mockGet,
    put: mockPut,
    post: mockPost,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: "form1" }),
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
      <SurveyFormDetailScreen />
    </QueryClientProvider>,
  );
}

describe("SurveyFormDetailScreen", () => {
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
    mockPermissions = ["survey:manage-wave"];
    mockGet.mockResolvedValue({
      data: {
        id: "form1",
        title: "Onboarding",
        description: null,
        status: "draft",
        isAnonymous: false,
        questions: [],
        _count: { questions: 0, responses: 0 },
      },
    });
  });

  it("hides question builder without survey:manage-wave", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(await screen.findByText("Onboarding")).toBeTruthy();
    expect(screen.queryByLabelText("Add question")).toBeNull();
    expect(screen.queryByLabelText("Publish survey form")).toBeNull();
  });

  it("saves questions via PUT and publishes via POST when manage-gated", async () => {
    mockPut.mockResolvedValue({
      data: {
        id: "form1",
        title: "Onboarding",
        status: "draft",
        questions: [
          {
            id: "q1",
            order: 0,
            type: "short_text",
            prompt: "Clarity?",
            required: false,
            options: [],
          },
        ],
        _count: { questions: 1, responses: 0 },
      },
    });
    mockPost.mockResolvedValue({
      data: {
        id: "form1",
        title: "Onboarding",
        status: "published",
        publishedAt: "2026-07-18T00:00:00.000Z",
        questions: [
          {
            id: "q1",
            order: 0,
            type: "short_text",
            prompt: "Clarity?",
            required: false,
            options: [],
          },
        ],
        _count: { questions: 1, responses: 0 },
      },
    });

    await renderScreen();
    expect(await screen.findByText("Onboarding")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Add question"));
    await fireEvent.changeText(
      screen.getByLabelText("Question 1 prompt"),
      "Clarity?",
    );
    await fireEvent.press(screen.getByLabelText("Save questions"));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith("/survey-forms/form1/questions", {
        questions: [
          {
            type: "short_text",
            prompt: "Clarity?",
            helperText: null,
            required: false,
            options: [],
            settings: {},
          },
        ],
      });
    });

    await fireEvent.press(screen.getByLabelText("Publish survey form"));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/survey-forms/form1/publish", {});
    });
  });
});
