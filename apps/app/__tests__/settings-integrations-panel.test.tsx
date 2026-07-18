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
import { Linking } from "react-native";

import { SettingsIntegrationsPanel } from "@/features/settings/settings-integrations-panel";

const mockGet = jest.fn();
const mockDelete = jest.fn();
const mockReplace = jest.fn();
let mockPermissions = ["integrations:use"];
let mockParams: Record<string, string | undefined> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, delete: mockDelete }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

async function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <SettingsIntegrationsPanel />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("SettingsIntegrationsPanel", () => {
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
    mockDelete.mockReset();
    mockReplace.mockReset();
    mockPermissions = ["integrations:use"];
    mockParams = {};
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it(
    "connects Google when disconnected",
    async () => {
      mockGet.mockImplementation((path: string) => {
        if (path === "/integrations/status") {
          return Promise.resolve({ data: { google: { connected: false } } });
        }
        if (path.startsWith("/integrations/google/oauth-start")) {
          return Promise.resolve({
            data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
          });
        }
        throw new Error(`Unexpected GET ${path}`);
      });

      await renderPanel();
      expect(
        await screen.findByText("Google Workspace", {}, { timeout: 10_000 }),
      ).toBeTruthy();

      await fireEvent.press(
        screen.getByRole("button", { name: "Connect Google" }),
      );
      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          "https://accounts.google.com/o/oauth2/v2/auth?x=1",
        );
      });
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining(
          "redirect=%2Fsettings%3Ftab%3Dintegrations",
        ),
      );
    },
    15_000,
  );

  it(
    "disconnects a connected account after confirm",
    async () => {
      mockGet.mockResolvedValue({
        data: {
          google: {
            connected: true,
            accountEmail: "person@manut.example",
            canSendMail: true,
          },
        },
      });
      mockDelete.mockResolvedValue({ data: { ok: true } });

      await renderPanel();
      expect(
        await screen.findByText(/Connected as person@manut.example/, {
          timeout: 10_000,
        }),
      ).toBeTruthy();

      await fireEvent.press(
        screen.getByRole("button", { name: "Disconnect Google" }),
      );
      await fireEvent.press(
        screen.getByRole("button", { name: "Confirm disconnect Google" }),
      );
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith("/integrations/google");
      });
      expect(
        await screen.findByText("Google account disconnected"),
      ).toBeTruthy();
    },
    15_000,
  );

  it(
    "hides connect actions without integrations:use",
    async () => {
      mockPermissions = [];
      await renderPanel();
      expect(
        await screen.findByText(
          /Your role cannot manage Google Workspace integrations/,
        ),
      ).toBeTruthy();
      expect(mockGet).not.toHaveBeenCalled();
    },
    15_000,
  );
});
