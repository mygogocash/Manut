import { ApiError, parseAuthLink, resetPasswordSchema } from "@manut/app-core";
import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AuthCard } from "@/components/auth-card";
import {
  AuthButton,
  AuthField,
  AuthMessage,
} from "@/components/auth-form-controls";
import { LoadingScreen } from "@/components/loading-screen";
import { clearAuthLinkUrl, useAuthLinkUrl } from "@/platform/auth-link-source";

import { useAuth } from "./auth-provider";

export function ResetPasswordScreen() {
  const url = useAuthLinkUrl();
  const { recoverPassword } = useAuth();
  const link = useMemo(
    () => (url ? parseAuthLink(url, "recovery") : null),
    [url],
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    clearAuthLinkUrl("/reset-password");
  }, [url]);

  if (!link) return <LoadingScreen label="Checking reset link…" />;

  if (!link.ok) {
    return (
      <AuthCard
        title="Reset link unavailable"
        description="Request a new link to continue securely."
      >
        <AuthMessage>{link.message}</AuthMessage>
        <AuthRouteLinks primary="forgot-password" />
      </AuthCard>
    );
  }

  const submit = async () => {
    const parsed = resetPasswordSchema.safeParse({
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      setError(parsed.issues[0]?.message ?? "Check the password fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await recoverPassword({
        ...link.tokens,
        newPassword: parsed.data.newPassword,
      });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to reset the password. Request a new link and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Create a new password"
      description="Use at least eight characters and avoid a password used elsewhere."
    >
      <AuthField
        label="New password"
        autoComplete="new-password"
        secureTextEntry
        textContentType="newPassword"
        value={newPassword}
        editable={!submitting}
        onChangeText={setNewPassword}
      />
      <AuthField
        label="Confirm new password"
        autoComplete="new-password"
        secureTextEntry
        textContentType="newPassword"
        value={confirmPassword}
        editable={!submitting}
        onChangeText={setConfirmPassword}
        onSubmitEditing={() => void submit()}
      />
      {error ? <AuthMessage>{error}</AuthMessage> : null}
      <AuthButton
        label="Update password"
        pendingLabel="Updating password…"
        pending={submitting}
        onPress={submit}
      />
      <AuthRouteLinks primary="forgot-password" />
    </AuthCard>
  );
}

function AuthRouteLinks({ primary }: { primary: "forgot-password" }) {
  return (
    <View style={{ gap: 4, alignItems: "center" }}>
      <Link href={`/${primary}`} asChild>
        <Pressable
          accessibilityRole="link"
          style={{ paddingHorizontal: 14, paddingVertical: 10 }}
        >
          <Text selectable style={{ color: "#644d2d", fontWeight: "700" }}>
            Request a new reset link
          </Text>
        </Pressable>
      </Link>
      <Link href="/sign-in" asChild>
        <Pressable
          accessibilityRole="link"
          style={{ paddingHorizontal: 14, paddingVertical: 10 }}
        >
          <Text selectable style={{ color: "#644d2d", fontWeight: "700" }}>
            Back to sign in
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
