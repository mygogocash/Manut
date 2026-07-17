import { evaluateRouteAccess } from "@manut/app-core";
import {
  type Href,
  Redirect,
  Slot,
  useGlobalSearchParams,
  usePathname,
  useSegments,
} from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AccessDenied } from "@/components/access-denied";
import { LoadingScreen } from "@/components/loading-screen";
import { RetryPanel } from "@/components/retry-panel";
import { useAuth } from "@/features/auth/auth-provider";
import { SessionVerificationBanner } from "@/features/auth/session-verification-banner";
import {
  buildReturnPath,
  type SearchParameter,
} from "@/navigation/current-return-path";
import { AppShell } from "@/platform/app-shell";
import { useCurrentHash } from "@/platform/current-hash";

export default function ProtectedLayout() {
  const pathname = usePathname();
  const hash = useCurrentHash();
  const segments = useSegments();
  const parameters = useGlobalSearchParams() as Record<string, SearchParameter>;
  const {
    status,
    user,
    permissions,
    isEmployeeOnly,
    sessionVerificationError,
    refreshUser,
  } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const returnPath = buildReturnPath(
    pathname,
    parameters,
    segments as readonly string[],
    hash,
  );

  if (status === "checking")
    return <LoadingScreen label="Verifying session…" />;

  if (status === "anonymous" && sessionVerificationError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#f7f4ed",
        }}
      >
        <RetryPanel
          message={sessionVerificationError.message}
          retrying={retrying}
          onRetry={async () => {
            setRetrying(true);
            try {
              await refreshUser();
            } finally {
              setRetrying(false);
            }
          }}
        />
      </View>
    );
  }

  if (status === "anonymous") {
    return (
      <Redirect
        href={`/sign-in?returnTo=${encodeURIComponent(returnPath)}` as Href}
      />
    );
  }

  if (user?.mustChangePassword && pathname !== "/change-password") {
    return <Redirect href="/change-password" />;
  }

  const access = evaluateRouteAccess({
    pathname,
    permissions,
    employeeOnly: isEmployeeOnly,
  });
  if (!access.allowed && access.reason === "employee-boundary") {
    return <Redirect href="/my-portal" />;
  }
  if (!access.allowed) {
    return (
      <AccessDenied
        reason={
          access.reason === "unknown-route"
            ? "This route has not been registered for the universal app."
            : "Your account does not have a permission required by this route."
        }
      />
    );
  }

  return (
    <AppShell>
      <View style={{ flex: 1 }}>
        <SessionVerificationBanner />
        <Slot />
      </View>
    </AppShell>
  );
}
