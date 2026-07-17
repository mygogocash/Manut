import {
  ApiError,
  directoryListQueryKey,
  MY_PROFILE_QUERY_KEY,
  type AuthSession,
} from "@manut/app-core";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { Pressable, Text, View } from "react-native";

import { AuthProvider, useAuth } from "@/features/auth/auth-provider";

const mockGetMe = jest.fn();
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockReplace = jest.fn();
const authorizationCacheRenders: string[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/platform/app-visibility", () => ({
  useAppBecameActive: () => undefined,
}));

jest.mock("@/platform/auth-gateway", () => ({
  createPlatformAuthGateway: () => ({
    getMe: mockGetMe,
    login: mockLogin,
    logout: mockLogout,
    requestPasswordReset: jest.fn(),
    requestMagicLink: jest.fn(),
    recoverPassword: jest.fn(),
    exchangeSession: jest.fn(),
    changePassword: jest.fn(),
  }),
}));

const sessionA: AuthSession = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "a@manut.example",
    name: "User A",
    avatarUrl: null,
    department: "Operations",
    jobTitle: "Lead",
    entity: { id: "entity-1", name: "Manut", code: "MNT" },
    mustChangePassword: false,
  },
  roles: [],
  permissions: ["directory:view-sensitive"],
};

const sessionB: AuthSession = {
  user: {
    ...sessionA.user,
    id: "22222222-2222-4222-8222-222222222222",
    email: "b@manut.example",
    name: "User B",
  },
  roles: [],
  permissions: ["directory:read"],
};

function Harness() {
  const { user, login, logout, refreshUser, hasPermission } = useAuth();
  const profileQuery = useQuery<{ name: string }>({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn: () =>
      Promise.reject(new Error("Profile query must stay disabled")),
    enabled: false,
  });
  const directoryQuery = useQuery<{ data: { phone?: string }[] }>({
    queryKey: directoryKey,
    queryFn: () =>
      Promise.reject(new Error("Directory query must stay disabled")),
    enabled: false,
  });
  const authorizationCacheRender = [
    user?.name ?? "Anonymous",
    hasPermission("directory:view-sensitive") ? "sensitive" : "standard",
    profileQuery.data?.name ?? "no-profile",
    directoryQuery.data?.data[0]?.phone ?? "no-phone",
  ].join("|");
  authorizationCacheRenders.push(authorizationCacheRender);

  return (
    <View>
      <Text>{user?.name ?? "Anonymous"}</Text>
      <Text testID="authorization-cache-render">
        {authorizationCacheRender}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch account"
        onPress={() => void login("b@manut.example", "password")}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => void logout()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Verify session"
        onPress={() => void refreshUser()}
      />
    </View>
  );
}

function renderHarness(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const directoryKey = directoryListQueryKey({ page: 1, limit: 24 }, "sensitive");

describe("authenticated query cache boundary", () => {
  beforeEach(() => {
    authorizationCacheRenders.length = 0;
    mockGetMe.mockReset().mockResolvedValue(sessionA);
    mockLogin.mockReset().mockResolvedValue(sessionB);
    mockLogout.mockReset().mockResolvedValue(undefined);
    mockReplace.mockReset();
  });

  it("never renders a previous principal's cached data after session verification switches users", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await renderHarness(queryClient);
    const user = userEvent.setup();
    expect(await screen.findByText("User A")).toBeTruthy();

    queryClient.setQueryData(MY_PROFILE_QUERY_KEY, { name: "User A profile" });
    await waitFor(() =>
      expect(
        screen.getByTestId("authorization-cache-render").props.children,
      ).toContain("User A profile"),
    );
    mockGetMe.mockResolvedValueOnce(sessionB);
    await user.press(screen.getByRole("button", { name: "Verify session" }));

    expect(await screen.findByText("User B")).toBeTruthy();
    expect(authorizationCacheRenders).not.toContain(
      "User B|standard|User A profile|no-phone",
    );
  });

  it("keeps the cache available across steady-state verification", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await renderHarness(queryClient);
    const user = userEvent.setup();
    expect(await screen.findByText("User A")).toBeTruthy();

    queryClient.setQueryData(MY_PROFILE_QUERY_KEY, { name: "User A profile" });
    await waitFor(() =>
      expect(
        screen.getByTestId("authorization-cache-render").props.children,
      ).toContain("User A profile"),
    );
    mockGetMe.mockResolvedValueOnce(sessionA);
    await user.press(screen.getByRole("button", { name: "Verify session" }));

    await waitFor(() => expect(mockGetMe).toHaveBeenCalledTimes(2));
    expect(queryClient.getQueryData(MY_PROFILE_QUERY_KEY)).toEqual({
      name: "User A profile",
    });
    expect(
      screen.getByTestId("authorization-cache-render").props.children,
    ).toContain("User A profile");
  });

  it("does not let a stale verification response overwrite the winning account's cache binding", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await renderHarness(queryClient);
    const user = userEvent.setup();
    expect(await screen.findByText("User A")).toBeTruthy();

    const staleVerification = deferred<AuthSession>();
    mockGetMe.mockReturnValueOnce(staleVerification.promise);
    await user.press(screen.getByRole("button", { name: "Verify session" }));
    await waitFor(() => expect(mockGetMe).toHaveBeenCalledTimes(2));

    await user.press(screen.getByRole("button", { name: "Switch account" }));
    expect(await screen.findByText("User B")).toBeTruthy();
    queryClient.setQueryData(MY_PROFILE_QUERY_KEY, { name: "User B profile" });
    await waitFor(() =>
      expect(
        screen.getByTestId("authorization-cache-render").props.children,
      ).toContain("User B profile"),
    );

    await act(async () => {
      staleVerification.resolve(sessionA);
      await staleVerification.promise;
      await Promise.resolve();
    });

    expect(screen.getByText("User B")).toBeTruthy();
    expect(queryClient.getQueryData(MY_PROFILE_QUERY_KEY)).toEqual({
      name: "User B profile",
    });
  });

  it("clears profile and sensitive directory data before switching principals", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    queryClient.setQueryData(MY_PROFILE_QUERY_KEY, {
      id: sessionA.user.id,
      name: sessionA.user.name,
    });
    queryClient.setQueryData(directoryKey, {
      data: [{ id: sessionA.user.id, phone: "+66 private" }],
    });
    await renderHarness(queryClient);
    const user = userEvent.setup();

    expect(await screen.findByText("User A")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Switch account" }));
    expect(await screen.findByText("User B")).toBeTruthy();

    expect(queryClient.getQueryData(MY_PROFILE_QUERY_KEY)).toBeUndefined();
    expect(queryClient.getQueryData(directoryKey)).toBeUndefined();

    queryClient.setQueryData(MY_PROFILE_QUERY_KEY, { name: "User B" });
    await user.press(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Anonymous")).toBeTruthy();
    expect(queryClient.getQueryData(MY_PROFILE_QUERY_KEY)).toBeUndefined();
  });

  it("clears user-scoped data when session verification becomes terminal", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await renderHarness(queryClient);
    const user = userEvent.setup();
    expect(await screen.findByText("User A")).toBeTruthy();

    queryClient.setQueryData(MY_PROFILE_QUERY_KEY, { name: "User A" });
    queryClient.setQueryData(directoryKey, {
      data: [{ phone: "+66 private" }],
    });
    mockGetMe.mockRejectedValueOnce(
      new ApiError(401, "UNAUTHORIZED", "Session expired"),
    );
    await user.press(screen.getByRole("button", { name: "Verify session" }));

    await waitFor(() => expect(screen.getByText("Anonymous")).toBeTruthy());
    expect(queryClient.getQueryData(MY_PROFILE_QUERY_KEY)).toBeUndefined();
    expect(queryClient.getQueryData(directoryKey)).toBeUndefined();
  });

  it("clears sensitive data when the same principal loses a permission", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await renderHarness(queryClient);
    const user = userEvent.setup();
    expect(await screen.findByText("User A")).toBeTruthy();

    queryClient.setQueryData(directoryKey, {
      data: [{ phone: "+66 private" }],
    });
    mockGetMe.mockResolvedValueOnce({
      ...sessionA,
      permissions: ["directory:read"],
    });
    await user.press(screen.getByRole("button", { name: "Verify session" }));

    await waitFor(() =>
      expect(queryClient.getQueryData(directoryKey)).toBeUndefined(),
    );
    expect(authorizationCacheRenders).not.toContain(
      "User A|standard|no-profile|+66 private",
    );
  });
});
