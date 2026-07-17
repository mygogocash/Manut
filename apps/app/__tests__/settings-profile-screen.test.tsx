import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { directoryListQueryKey } from "@manut/app-core";
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";

import { SettingsProfileScreen } from "@/features/settings/settings-profile-screen";

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, patch: mockPatch }),
}));

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@manut.example",
  name: "Person",
  avatarUrl: null,
  isActive: true,
  mustChangePassword: false,
  phone: null,
  phonePublic: false,
  department: "Operations",
  jobTitle: "Coordinator",
  employeeId: "MNT-001",
  employmentType: "full_time",
  startDate: null,
  endDate: null,
  location: null,
  country: null,
  timezone: "Asia/Bangkok",
  entity: { id: "entity-1", name: "Manut", code: "MNT" },
  roles: [{ id: "role-1", name: "Employee" }],
};

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <SettingsProfileScreen />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("SettingsProfileScreen", () => {
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
    mockPatch.mockReset();
    mockPush.mockReset();
  });

  it("loads the profile and saves only the directory privacy choice", async () => {
    mockGet.mockResolvedValue({ data: { profile } });
    mockPatch.mockResolvedValue({
      data: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: null,
        phone: "+66 80 000 0000",
        phonePublic: true,
        location: "Bangkok",
        country: "Thailand",
        timezone: "Asia/Bangkok",
      },
    });
    await renderScreen();

    expect(await screen.findByText("Person")).toBeTruthy();
    fireEvent(
      screen.getByRole("switch", {
        name: "Show my phone number in the directory",
      }),
      "valueChange",
      true,
    );

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith("/auth/me/profile", {
        phonePublic: true,
      }),
    );
    expect(
      await screen.findByText(
        "Your phone number is now visible in the directory.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("switch", {
        name: "Show my phone number in the directory",
      }).props.accessibilityState,
    ).toMatchObject({ checked: true });
  });

  it("shows a retry boundary and routes password changes without web globals", async () => {
    mockGet
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: { profile } });
    await renderScreen();
    const user = userEvent.setup();

    expect(
      await screen.findByText("We could not load your profile."),
    ).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Retry profile" }));
    expect(await screen.findByText("Person")).toBeTruthy();

    await user.press(screen.getByRole("button", { name: "Change password" }));
    expect(mockPush).toHaveBeenCalledWith("/change-password");
  });

  it("preserves the prior privacy state when the update fails", async () => {
    mockGet.mockResolvedValue({ data: { profile } });
    mockPatch.mockRejectedValue(new Error("offline"));
    await renderScreen();

    expect(await screen.findByText("Person")).toBeTruthy();
    fireEvent(
      screen.getByRole("switch", {
        name: "Show my phone number in the directory",
      }),
      "valueChange",
      true,
    );

    expect(
      await screen.findByText("Privacy setting was not saved."),
    ).toBeTruthy();
    expect(
      screen.getByRole("switch", {
        name: "Show my phone number in the directory",
      }).props.accessibilityState,
    ).toMatchObject({ checked: false });
  });

  it("redacts a hidden phone from cached standard directory results immediately", async () => {
    const publicProfile = {
      ...profile,
      phone: "+66 80 000 0000",
      phonePublic: true,
    };
    mockGet.mockResolvedValue({ data: { profile: publicProfile } });
    mockPatch.mockResolvedValue({
      data: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: null,
        phone: publicProfile.phone,
        phonePublic: false,
        location: null,
        country: null,
        timezone: "Asia/Bangkok",
      },
    });
    const queryClient = await renderScreen();
    const directoryKey = directoryListQueryKey({}, "standard");
    queryClient.setQueryData(directoryKey, {
      data: [
        {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatarUrl: null,
          phone: publicProfile.phone,
          department: profile.department,
          jobTitle: profile.jobTitle,
          employeeId: profile.employeeId,
          employmentType: profile.employmentType,
          location: null,
          country: null,
          isActive: true,
          startDate: null,
          entity: profile.entity,
          manager: null,
        },
      ],
      meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
    });

    expect(await screen.findByText("Person")).toBeTruthy();
    fireEvent(
      screen.getByRole("switch", {
        name: "Show my phone number in the directory",
      }),
      "valueChange",
      false,
    );

    await waitFor(() => {
      const cached = queryClient.getQueryData<{
        data: Array<Record<string, unknown>>;
      }>(directoryKey);
      expect(cached?.data[0]).not.toHaveProperty("phone");
    });
  });
});
