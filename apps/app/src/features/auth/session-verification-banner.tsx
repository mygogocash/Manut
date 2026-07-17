import { useState } from "react";
import { View } from "react-native";

import { RetryPanel } from "@/components/retry-panel";

import { useAuth } from "./auth-provider";

export function SessionVerificationBanner() {
  const { sessionVerificationError, refreshUser } = useAuth();
  const [retrying, setRetrying] = useState(false);
  if (!sessionVerificationError) return null;

  const retry = async () => {
    setRetrying(true);
    try {
      await refreshUser();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 18 }}>
      <RetryPanel
        compact
        message={sessionVerificationError.message}
        retrying={retrying}
        onRetry={retry}
      />
    </View>
  );
}
