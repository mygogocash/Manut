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

import { FilesScreen } from "@/features/files/files-screen";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const mockGetDocumentAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({
    get: mockGet,
    post: mockPost,
    delete: mockDelete,
  }),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

const listedUpload = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  originalName: "Report.pdf",
  mimeType: "application/pdf",
  size: 2048,
  purpose: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  bucket: "uploads",
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
      <FilesScreen />
    </QueryClientProvider>,
  );
}

describe("FilesScreen", () => {
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
    mockDelete.mockReset();
    mockGetDocumentAsync.mockReset();
    mockReadAsStringAsync.mockReset();
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/uploads?")) {
        return Promise.resolve({
          data: [listedUpload],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      if (path.endsWith("/signed-url")) {
        return Promise.resolve({
          data: { url: "https://signed.example/report.pdf" },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it(
    "lists uploads and opens a signed download URL",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText("Report.pdf", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/application\/pdf · 2\.0 KB/)).toBeTruthy();

      await fireEvent.press(screen.getByLabelText("Open Report.pdf"));
      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          "https://signed.example/report.pdf",
        );
      });
    },
    15_000,
  );

  it(
    "uploads a picked file via base64",
    async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            name: "Notes.txt",
            mimeType: "text/plain",
            uri: "file:///cache/Notes.txt",
            lastModified: 0,
          },
        ],
      });
      mockReadAsStringAsync.mockResolvedValue("SGVsbG8=");
      mockPost.mockResolvedValue({
        data: {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          originalName: "Notes.txt",
          mimeType: "text/plain",
          size: 5,
          purpose: null,
          createdAt: "2026-07-02T00:00:00.000Z",
          bucket: "uploads",
        },
      });

      await renderScreen();
      expect(
        await screen.findByText("Report.pdf", {}, { timeout: 10_000 }),
      ).toBeTruthy();

      await fireEvent.press(screen.getByLabelText("Upload file"));
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith("/uploads", {
          base64: "SGVsbG8=",
          originalName: "Notes.txt",
          mimeType: "text/plain",
        });
      });
      expect(mockGetDocumentAsync).toHaveBeenCalled();
      expect(mockReadAsStringAsync).toHaveBeenCalledWith(
        "file:///cache/Notes.txt",
        { encoding: "base64" },
      );
    },
    15_000,
  );

  it(
    "deletes an upload after confirm",
    async () => {
      mockDelete.mockResolvedValue({ message: "File deleted" });

      await renderScreen();
      expect(
        await screen.findByText("Report.pdf", {}, { timeout: 10_000 }),
      ).toBeTruthy();

      await fireEvent.press(screen.getByLabelText("Delete Report.pdf"));
      expect(
        await screen.findByText(
          "Delete Report.pdf? This cannot be undone.",
          {},
          { timeout: 5_000 },
        ),
      ).toBeTruthy();

      await fireEvent.press(screen.getByLabelText("Confirm delete Report.pdf"));
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith(
          `/uploads/${listedUpload.id}`,
        );
      });
    },
    15_000,
  );
});
