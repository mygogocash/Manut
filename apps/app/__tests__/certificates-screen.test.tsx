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

import { CertificatesScreen } from "@/features/certificates/certificates-screen";

const mockGet = jest.fn();
let mockPermissions = ["certificate:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <CertificatesScreen />
    </QueryClientProvider>,
  );
}

describe("CertificatesScreen", () => {
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
    mockPermissions = ["certificate:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "cert1",
          title: "Ship award",
          type: "achievement",
          status: "issued",
          recipientName: "Alex Example",
          recipientEmail: "alex@manut.example",
          message: "Great work",
          fileUrl: "https://storage.example/cert.pdf",
          issuedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });

  it("lists certificates without message or email", async () => {
    await renderScreen();
    expect(
      await screen.findByText(/Ship award/, {}, { timeout: 10_000 }),
    ).toBeTruthy();
    expect(screen.getByText(/Alex Example · achievement · issued/)).toBeTruthy();
    expect(screen.queryByText(/Great work/)).toBeNull();
    expect(screen.queryByText(/alex@manut\.example/)).toBeNull();
  }, 15_000);
});
