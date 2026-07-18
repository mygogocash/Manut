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

import { VisaScreen } from "@/features/visa/visa-screen";

const mockGet = jest.fn();
let mockPermissions = ["visa:read"];

jest.mock("@/providers/api-client-provider", () => ({
  useApiClient: () => ({ get: mockGet }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      mockPermissions.includes(permission),
  }),
}));

const record = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  employeeId: "11111111-1111-4111-8111-111111111111",
  holderType: "employee",
  holderName: null,
  holderRelationship: null,
  visaType: "work_visa",
  country: "Thailand",
  nationality: "Thai",
  issueDate: "2025-01-15",
  expiryDate: "2027-01-14",
  workPermitExpiryDate: "2027-01-14",
  status: "active",
  documentUrl: null,
  documents: [
    {
      name: "Passport",
      url: "r2://private/passport.pdf",
      category: "passport_front",
    },
  ],
  notes: "internal",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
  },
  entity: { id: "entity-1", name: "Manut" },
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
      <VisaScreen />
    </QueryClientProvider>,
  );
}

describe("VisaScreen", () => {
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
    mockPermissions = ["visa:read"];
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith("/visa?")) {
        return Promise.resolve({
          data: [record],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      if (path === `/visa/${record.id}`) {
        return Promise.resolve({ data: record });
      }
      if (path.startsWith(`/visa/${record.id}/download`)) {
        return Promise.resolve({
          data: {
            url: "https://signed.example/passport.pdf",
            name: "Passport",
          },
        });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it(
    "lists visa records from the tracker API",
    async () => {
      await renderScreen();
      expect(
        await screen.findByText(/Work visa · Active/, {}, { timeout: 10_000 }),
      ).toBeTruthy();
      expect(screen.getByText(/Thailand · expires 2027-01-14/)).toBeTruthy();
      expect(screen.getByText(/Person · Manut/)).toBeTruthy();
    },
    15_000,
  );

  it(
    "opens detail and signed document download",
    async () => {
      await renderScreen();
      await screen.findByText(/Work visa · Active/, {}, { timeout: 10_000 });
      await fireEvent.press(
        screen.getByLabelText("Open Work visa for Person"),
      );
      expect(
        await screen.findByLabelText("Open document Passport", {}, {
          timeout: 10_000,
        }),
      ).toBeTruthy();
      await fireEvent.press(screen.getByLabelText("Open document Passport"));
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          `/visa/${record.id}/download?docIndex=0`,
          undefined,
        );
        expect(Linking.openURL).toHaveBeenCalledWith(
          "https://signed.example/passport.pdf",
        );
      });
    },
    15_000,
  );
});
