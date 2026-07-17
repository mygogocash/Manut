import { ApiError, changePasswordSchema } from "@manut/app-core";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AuthCard } from "@/components/auth-card";
import {
  AuthButton,
  AuthField,
  AuthMessage,
} from "@/components/auth-form-controls";

import { useAuth } from "./auth-provider";

export function ChangePasswordScreen() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword,
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
      await changePassword(
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to change the password. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Change password"
      description={
        user?.mustChangePassword
          ? "Update your password before continuing to protected tools."
          : "Choose a strong password you have not used elsewhere."
      }
    >
      {user?.mustChangePassword ? (
        <AuthMessage tone="success">
          A new password is required for this account.
        </AuthMessage>
      ) : null}
      <AuthField
        label="Current password"
        autoComplete="current-password"
        secureTextEntry
        textContentType="password"
        value={currentPassword}
        editable={!submitting}
        onChangeText={setCurrentPassword}
      />
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
      {!user?.mustChangePassword ? (
        <View style={{ alignItems: "center" }}>
          <Link href="/dashboard" asChild>
            <Pressable
              accessibilityRole="link"
              style={{ paddingHorizontal: 14, paddingVertical: 10 }}
            >
              <Text selectable style={{ color: "#644d2d", fontWeight: "700" }}>
                Cancel
              </Text>
            </Pressable>
          </Link>
        </View>
      ) : null}
    </AuthCard>
  );
}
