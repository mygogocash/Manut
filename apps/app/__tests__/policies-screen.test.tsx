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

import { PoliciesScreen } from "@/features/policies/policies-screen";

const mockGet = jest.fn();
let mockPermissions = ["policy:read"];

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
      <PoliciesScreen />
    </QueryClientProvider>,
  );
}

describe("PoliciesScreen", () => {
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
    mockPermissions = ["policy:read"];
    mockGet.mockResolvedValue({
      data: [
        {
          id: "pol1",
          title: "Code of Conduct",
          category: "code_of_conduct",
          description: "Expected behavior",
          fileUrl: "https://storage.example/coc.pdf",
          fileName: "coc.pdf",
          version: "1.0",
          effectiveDate: "2026-01-01",
          isActive: true,
          uploadedBy: { id: "u1", name: "Alex", email: "alex@manut.example" },
        },
      ],
    });
  });

  it("lists policies without file URLs or uploader email", async () => {
    await renderScreen();
    expect(
      await screen.findByText(/Code of Conduct/, {}, { timeout: 10_000 }),
    ).toBeTruthy();
    expect(screen.getByText(/code_of_conduct · coc\.pdf/)).toBeTruthy();
    expect(screen.queryByText(/storage\.example/)).toBeNull();
    expect(screen.queryByText(/alex@manut\.example/)).toBeNull();
    expect(mockGet).toHaveBeenCalledWith("/policies", expect.anything());
  }, 15_000);
});
