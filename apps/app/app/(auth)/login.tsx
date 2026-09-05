import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/store/auth";

export default function LoginScreen() {
  const router = useRouter();
  const refreshUser = useAuth((s) => s.refreshUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.signIn.email({ email: email.trim(), password });
      if (res.error) {
        setError(res.error.message ?? "Sign-in failed");
        return;
      }
      await refreshUser();
      router.replace("/(dashboard)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Intranet</Text>
      <Text style={styles.sub}>Sign in with your work email</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={busy} onPress={onSubmit} style={[styles.button, busy && styles.buttonDisabled]}>
        {busy ? <ActivityIndicator color="#F7F3EB" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
      <Link href="/(auth)/magic-link" style={styles.link}>
        Magic link
      </Link>
      <Link href="/(auth)/reset" style={styles.link}>
        Reset password
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F7F3EB", gap: 12 },
  brand: { fontSize: 36, fontWeight: "700", color: "#3D2B1F" },
  sub: { color: "#8B7355", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#D4C4B0",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFDF8",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#8B6914",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#F7F3EB", fontWeight: "600", fontSize: 16 },
  error: { color: "#B42318" },
  link: { color: "#8B6914", marginTop: 8 },
});
