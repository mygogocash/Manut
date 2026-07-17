import { ApiError, parseAuthLink } from "@manut/app-core";
import { Link } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AuthCard } from "@/components/auth-card";
import { AuthMessage } from "@/components/auth-form-controls";
import { LoadingScreen } from "@/components/loading-screen";
import { clearAuthLinkUrl, useAuthLinkUrl } from "@/platform/auth-link-source";

import { useAuth } from "./auth-provider";

export function AuthCallbackScreen() {
  const url = useAuthLinkUrl();
  const { exchangeSession } = useAuth();
  const startedUrl = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const link = useMemo(
    () => (url ? parseAuthLink(url, "sign-in") : null),
    [url],
  );

  useEffect(() => {
    if (!url || !link || startedUrl.current === url) return;
    startedUrl.current = url;
    clearAuthLinkUrl("/auth/callback");
    if (!link.ok) return;

    void exchangeSession(link.tokens).catch((cause: unknown) => {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to sign in with this link. Request a new one.",
      );
    });
  }, [exchangeSession, link, url]);

  const visibleError = link && !link.ok ? link.message : error;
  if (!visibleError) return <LoadingScreen label="Verifying sign-in link…" />;

  return (
    <AuthCard
      title="Sign-in link unavailable"
      description="The link could not establish a verified session."
    >
      <AuthMessage>{visibleError}</AuthMessage>
      <View style={{ gap: 4, alignItems: "center" }}>
        <Link href="/magic-link" asChild>
          <Pressable
            accessibilityRole="link"
            style={{ paddingHorizontal: 14, paddingVertical: 10 }}
          >
            <Text selectable style={{ color: "#644d2d", fontWeight: "700" }}>
              Request a new sign-in link
            </Text>
          </Pressable>
        </Link>
        <Link href="/sign-in" asChild>
          <Pressable
            accessibilityRole="link"
            style={{ paddingHorizontal: 14, paddingVertical: 10 }}
          >
            <Text selectable style={{ color: "#644d2d", fontWeight: "700" }}>
              Sign in with a password
            </Text>
          </Pressable>
        </Link>
      </View>
    </AuthCard>
  );
}
