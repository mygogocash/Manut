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

import { SurveyFormRespondScreen } from "@/features/survey-forms/survey-form-respond-screen";

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
  useLocalSearchParams: () => ({ id: "form1" }),
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
      <SurveyFormRespondScreen />
    </QueryClientProvider>,
  );
}

describe("SurveyFormRespondScreen", () => {
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
      if (path === "/survey-forms/form1") {
        return Promise.resolve({
          data: {
            id: "form1",
            title: "Onboarding",
            status: "published",
            alreadyResponded: false,
            questions: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                order: 0,
                type: "short_text",
                prompt: "Team?",
                required: true,
                options: [],
              },
            ],
          },
        });
      }
      if (path === "/survey-forms/form1/my-response") {
        return Promise.resolve({ data: null });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it("submits answers for unanswered survey form questions", async () => {
    mockPost.mockResolvedValue({
      data: {
        id: "resp1",
        answers: [{ questionId: "11111111-1111-4111-8111-111111111111" }],
      },
    });

    await renderScreen();
    expect(await screen.findByText("Onboarding")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Team? *"), "Platform");
    await fireEvent.press(screen.getByLabelText("Submit survey form response"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/survey-forms/form1/responses", {
        answers: [
          {
            questionId: "11111111-1111-4111-8111-111111111111",
            value: "Platform",
          },
        ],
      });
    });
    expect(await screen.findByText(/Response recorded/)).toBeTruthy();
  });
});
