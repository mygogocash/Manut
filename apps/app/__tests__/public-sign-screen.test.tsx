import {
  act,
  render,
  screen,
} from "@testing-library/react-native";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { PublicSignScreen } from "@/features/sign/public-sign-screen";

const mockGetPublic = jest.fn();

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ getPublic: mockGetPublic }),
}));

async function renderScreen(token = "token-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <PublicSignScreen token={token} />
    </QueryClientProvider>,
  );
}

describe("PublicSignScreen", () => {
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
    mockGetPublic.mockReset();
  });

  it(
    "loads a public signing request by token",
    async () => {
      mockGetPublic.mockResolvedValue({
        data: {
          signature: {
            id: "sig-1",
            documentId: "doc-1",
            signerEmail: "signer@example.com",
            signerName: "Signer",
            status: "sent",
            inviteMessage: "Please review",
            signedAt: null,
            declinedAt: null,
            declineReason: null,
            expiresAt: "2026-08-01T00:00:00.000Z",
          },
          document: {
            id: "doc-1",
            title: "Offer letter",
            kind: "contract",
            fileUrl: "https://files.example/doc.pdf",
            fileName: "offer.pdf",
            status: "active",
          },
        },
      });

      await renderScreen();
      expect(
        await screen.findByText("Offer letter", {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Signer/)).toBeTruthy();
      expect(mockGetPublic).toHaveBeenCalledWith(
        "/legal-public/sign/token-1",
        expect.anything(),
      );
    },
    15_000,
  );
});
