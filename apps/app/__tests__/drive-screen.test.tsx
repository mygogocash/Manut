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

import { DriveScreen } from "@/features/drive/drive-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockHasPermission = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet, post: mockPost }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockHasPermission(code),
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
      <DriveScreen />
    </QueryClientProvider>,
  );
}

describe("DriveScreen", () => {
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
    mockHasPermission.mockReset();
    mockHasPermission.mockImplementation(
      (code: string) => code === "integrations:use",
    );
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it(
    "shows a not-connected state without inventing Drive files",
    async () => {
      mockGet.mockResolvedValue({
        data: { google: { connected: false } },
      });

      await renderScreen();
      expect(
        await screen.findByText("Google not connected", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.queryByLabelText("Drive files")).toBeNull();
      expect(mockPost).not.toHaveBeenCalled();
    },
    15_000,
  );

  it(
    "lists Drive files when Google is connected",
    async () => {
      mockGet.mockResolvedValue({
        data: {
          google: {
            connected: true,
            accountEmail: "person@manut.example",
          },
        },
      });
      mockPost.mockResolvedValue({
        data: [
          {
            id: "drive-file-1",
            name: "Roadmap.gdoc",
            mimeType: "application/vnd.google-apps.document",
            modifiedTime: "2026-07-01T12:00:00.000Z",
            webViewLink: "https://drive.google.com/file/d/drive-file-1/view",
            shared: false,
          },
        ],
        nextPageToken: null,
      });

      await renderScreen();
      expect(
        await screen.findByText("Roadmap.gdoc", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      await fireEvent.press(
        screen.getByLabelText("Open Roadmap.gdoc in Google Drive"),
      );
      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          "https://drive.google.com/file/d/drive-file-1/view",
        );
      });
      expect(mockPost).toHaveBeenCalledWith("/integrations/drive/list", {
        pageSize: 25,
      });
    },
    15_000,
  );
});
