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

import { SurveyNewScreen } from "@/features/survey/survey-new-screen";

const mockPost = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["survey:manage"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({
    post: mockPost,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
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
      <SurveyNewScreen />
    </QueryClientProvider>,
  );
}

describe("SurveyNewScreen", () => {
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
    mockPost.mockReset();
    mockPush.mockReset();
    mockPermissions = ["survey:manage"];
  });

  it("blocks create without survey:manage", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(/do not have permission to create surveys/i),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("creates a draft survey and navigates to detail", async () => {
    mockPost.mockResolvedValue({
      data: {
        id: "surv-new",
        title: "Q3 pulse",
        description: "Notes",
        status: "draft",
        isAnonymous: false,
        questions: [],
      },
    });
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText("Title"), "Q3 pulse");
    await fireEvent.changeText(
      screen.getByLabelText("Description"),
      "Notes",
    );
    await fireEvent.press(screen.getByLabelText("Create survey"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/survey", {
        title: "Q3 pulse",
        description: "Notes",
        isAnonymous: false,
        targetAll: true,
        targetEntityIds: [],
        targetDepartments: [],
        targetUserIds: [],
        questions: [],
      });
      expect(mockPush).toHaveBeenCalledWith("/survey/surv-new");
    });
  }, 15_000);
});
