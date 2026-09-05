import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { authClient } from "@/lib/auth-client";

export default function MagicLinkScreen() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authClient.signIn.magicLink({ email: email.trim() });
      if (res.error) {
        setError(res.error.message ?? "Could not send magic link");
        return;
      }
      setMessage("If that email is eligible, a sign-in link is on its way.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send magic link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Magic link</Text>
      <Text style={styles.sub}>Available only for roles listed in MAGIC_LINK_ALLOWED_ROLES.</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <Pressable disabled={busy} onPress={onSubmit} style={styles.button}>
        {busy ? <ActivityIndicator color="#F7F3EB" /> : <Text style={styles.buttonText}>Send link</Text>}
      </Pressable>
      <Link href="/(auth)/login" style={styles.link}>
        Back to password sign-in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F7F3EB", gap: 12 },
  brand: { fontSize: 32, fontWeight: "700", color: "#3D2B1F" },
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
  button: { backgroundColor: "#8B6914", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#F7F3EB", fontWeight: "600", fontSize: 16 },
  error: { color: "#B42318" },
  ok: { color: "#3D6B4F" },
  link: { color: "#8B6914", marginTop: 8 },
});
