import { ApiError } from "@manut/app-core";
import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "./auth-provider";

export function SignInScreen({ returnTo }: { returnTo?: string }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password, returnTo);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#f7f4ed",
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 440,
          gap: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: "#ded8ca",
          borderRadius: 18,
          backgroundColor: "#fffdf8",
          boxShadow: "0 12px 32px rgba(58, 47, 34, 0.10)",
        }}
      >
        <View style={{ gap: 5 }}>
          <Text selectable style={{ fontSize: 25, fontWeight: "700" }}>
            Sign in to Manut
          </Text>
          <Text selectable style={{ color: "#665f52" }}>
            Use your Manut Intranet account.
          </Text>
        </View>

        <View style={{ gap: 7 }}>
          <Text selectable style={{ fontWeight: "600" }}>
            Email
          </Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            editable={!submitting}
            style={{
              minHeight: 48,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: "#cfc6b5",
              borderRadius: 10,
              backgroundColor: "#ffffff",
            }}
          />
        </View>

        <View style={{ gap: 7 }}>
          <Text selectable style={{ fontWeight: "600" }}>
            Password
          </Text>
          <TextInput
            accessibilityLabel="Password"
            autoComplete="current-password"
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            editable={!submitting}
            style={{
              minHeight: 48,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: "#cfc6b5",
              borderRadius: 10,
              backgroundColor: "#ffffff",
            }}
          />
        </View>

        {error ? (
          <Text
            selectable
            accessibilityRole="alert"
            style={{ color: "#a42828" }}
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => void submit()}
          style={({ pressed }) => ({
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 10,
            backgroundColor: pressed ? "#644d2d" : "#785f37",
            opacity: submitting ? 0.65 : 1,
          })}
        >
          {submitting ? <ActivityIndicator color="#ffffff" /> : null}
          <Text selectable style={{ color: "#ffffff", fontWeight: "700" }}>
            {submitting ? "Signing in…" : "Sign in"}
          </Text>
        </Pressable>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <Link href="/forgot-password" asChild>
            <Pressable
              accessibilityRole="link"
              style={{ paddingHorizontal: 10, paddingVertical: 8 }}
            >
              <Text selectable style={{ color: "#644d2d", fontWeight: "700" }}>
                Forgot password?
              </Text>
            </Pressable>
          </Link>
          <Link href="/magic-link" asChild>
            <Pressable
              accessibilityRole="link"
              style={{ paddingHorizontal: 10, paddingVertical: 8 }}
            >
              <Text selectable style={{ color: "#644d2d", fontWeight: "700" }}>
                Email sign-in link
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
