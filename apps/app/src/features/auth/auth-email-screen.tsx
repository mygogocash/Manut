import { ApiError, authEmailSchema } from "@manut/app-core";
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

type AuthEmailMode = "forgot-password" | "magic-link";

const copy = {
  "forgot-password": {
    title: "Reset password",
    description: "Enter your account email to receive a secure reset link.",
    button: "Send reset link",
    pending: "Sending reset link…",
    success: "If the account is eligible, a reset link will arrive shortly.",
  },
  "magic-link": {
    title: "Email sign-in link",
    description: "Request a one-time link if email sign-in is enabled for you.",
    button: "Send sign-in link",
    pending: "Sending sign-in link…",
    success: "If the account is eligible, a sign-in link will arrive shortly.",
  },
} satisfies Record<AuthEmailMode, Record<string, string>>;

export function AuthEmailScreen({ mode }: { mode: AuthEmailMode }) {
  const { requestMagicLink, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const content = copy[mode];

  const submit = async () => {
    const parsed = authEmailSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result =
        mode === "forgot-password"
          ? await requestPasswordReset(parsed.data.email)
          : await requestMagicLink(parsed.data.email);
      setSuccess(result.message || content.success);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to send the email right now. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title={content.title} description={content.description}>
      <AuthField
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        inputMode="email"
        textContentType="emailAddress"
        value={email}
        editable={!submitting}
        onChangeText={setEmail}
        onSubmitEditing={() => void submit()}
      />
      {error ? <AuthMessage>{error}</AuthMessage> : null}
      {success ? <AuthMessage tone="success">{success}</AuthMessage> : null}
      <AuthButton
        label={content.button}
        pendingLabel={content.pending}
        pending={submitting}
        onPress={submit}
      />
      <View style={{ alignItems: "center" }}>
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
    </AuthCard>
  );
}
