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

import { SurveyRespondScreen } from "@/features/survey/survey-respond-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPush = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({
    get: mockGet,
    post: mockPost,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: "surv1" }),
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
      <SurveyRespondScreen />
    </QueryClientProvider>,
  );
}

describe("SurveyRespondScreen", () => {
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
    mockGet.mockImplementation((path: string) => {
      if (path === "/survey/surv1") {
        return Promise.resolve({
          data: {
            id: "surv1",
            title: "Pulse",
            status: "published",
            alreadyResponded: false,
            questions: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                order: 0,
                type: "short_text",
                prompt: "How was your week?",
                required: true,
                options: [],
              },
              {
                id: "22222222-2222-4222-8222-222222222222",
                order: 1,
                type: "rating",
                prompt: "Score",
                required: false,
                options: [],
              },
            ],
          },
        });
      }
      if (path === "/survey/surv1/my-response") {
        return Promise.resolve({ data: null });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it("submits answers for unanswered questions", async () => {
    mockPost.mockResolvedValue({
      data: {
        id: "resp1",
        answers: [
          {
            questionId: "11111111-1111-4111-8111-111111111111",
            value: "Good",
          },
          {
            questionId: "22222222-2222-4222-8222-222222222222",
            value: 4,
          },
        ],
      },
    });
    mockGet.mockImplementation((path: string) => {
      if (path === "/survey/surv1") {
        return Promise.resolve({
          data: {
            id: "surv1",
            title: "Pulse",
            status: "published",
            alreadyResponded: mockPost.mock.calls.length > 0,
            questions: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                order: 0,
                type: "short_text",
                prompt: "How was your week?",
                required: true,
                options: [],
              },
              {
                id: "22222222-2222-4222-8222-222222222222",
                order: 1,
                type: "rating",
                prompt: "Score",
                required: false,
                options: [],
              },
            ],
          },
        });
      }
      if (path === "/survey/surv1/my-response") {
        if (mockPost.mock.calls.length > 0) {
          return Promise.resolve({
            data: {
              id: "resp1",
              answers: [
                {
                  questionId: "11111111-1111-4111-8111-111111111111",
                  value: "Good",
                },
                {
                  questionId: "22222222-2222-4222-8222-222222222222",
                  value: 4,
                },
              ],
            },
          });
        }
        return Promise.resolve({ data: null });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
    await renderScreen();

    expect(
      await screen.findByText(/^Pulse$/, {}, { timeout: 10_000 }),
    ).toBeTruthy();
    await fireEvent.changeText(
      screen.getByLabelText("How was your week? *"),
      "Good",
    );
    await fireEvent.changeText(screen.getByLabelText("Score"), "4");
    await fireEvent.press(screen.getByLabelText("Submit response"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/survey/surv1/responses", {
        answers: [
          {
            questionId: "11111111-1111-4111-8111-111111111111",
            value: "Good",
          },
          {
            questionId: "22222222-2222-4222-8222-222222222222",
            value: 4,
          },
        ],
      });
    });
    expect(
      await screen.findByText(/Response recorded \(2 answers\)/, {}, {
        timeout: 10_000,
      }),
    ).toBeTruthy();
  }, 15_000);
});
