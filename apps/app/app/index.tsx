import { type Href, Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { LoadingScreen } from "@/components/loading-screen";
import { RetryPanel } from "@/components/retry-panel";
import { useAuth } from "@/features/auth/auth-provider";

export default function IndexRoute() {
  const {
    status,
    user,
    isEmployeeOnly,
    sessionVerificationError,
    refreshUser,
  } = useAuth();
  const [retrying, setRetrying] = useState(false);

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

  const destination =
    status === "anonymous"
      ? "/sign-in"
      : user?.mustChangePassword
        ? "/change-password"
        : isEmployeeOnly
          ? "/my-portal"
          : "/dashboard";
  return <Redirect href={destination as Href} />;
}
