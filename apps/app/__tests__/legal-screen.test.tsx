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

import { LegalScreen } from "@/features/legal/legal-screen";

const mockGet = jest.fn();
let mockPermissions = ["legal:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <LegalScreen />
    </QueryClientProvider>,
  );
}

describe("LegalScreen", () => {
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
    mockPermissions = ["legal:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "leg1",
          title: "Master NDA",
          kind: "nda",
          status: "active",
          reference: "NDA-1",
          notes: "internal only",
          fileUrl: "https://storage.example/nda.pdf",
          owner: { id: "u1", name: "Alex", email: "alex@manut.example" },
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });

  it("lists legal documents without notes or owner email", async () => {
    await renderScreen();
    expect(
      await screen.findByText(/Master NDA/, {}, { timeout: 10_000 }),
    ).toBeTruthy();
    expect(screen.getByText(/nda · active · NDA-1/)).toBeTruthy();
    expect(screen.queryByText(/internal only/)).toBeNull();
    expect(screen.queryByText(/alex@manut\.example/)).toBeNull();
  }, 15_000);
});
