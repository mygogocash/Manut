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

import { SurveyFormNewScreen } from "@/features/survey-forms/survey-form-new-screen";

const mockPost = jest.fn();
const mockPush = jest.fn();
let mockPermissions = ["survey:manage-wave"];

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
      <SurveyFormNewScreen />
    </QueryClientProvider>,
  );
}

describe("SurveyFormNewScreen", () => {
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
    mockPermissions = ["survey:manage-wave"];
  });

  it("blocks create without survey:manage-wave", async () => {
    mockPermissions = [];
    await renderScreen();
    expect(
      await screen.findByText(/do not have permission to create survey forms/i),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("creates a draft survey form and navigates to detail", async () => {
    mockPost.mockResolvedValue({
      data: {
        id: "form-new",
        title: "Exit interview",
        description: null,
        status: "draft",
        isAnonymous: true,
        questions: [],
      },
    });
    await renderScreen();

    await fireEvent.changeText(
      screen.getByLabelText("Title"),
      "Exit interview",
    );
    await fireEvent.press(screen.getByLabelText("Anonymous responses"));
    await fireEvent.press(screen.getByLabelText("Create survey form"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/survey-forms", {
        title: "Exit interview",
        description: null,
        isAnonymous: true,
        targetAll: true,
        targetEntityIds: [],
        targetDepartments: [],
        targetUserIds: [],
        questions: [],
      });
      expect(mockPush).toHaveBeenCalledWith("/survey-forms/form-new");
    });
  }, 15_000);
});
