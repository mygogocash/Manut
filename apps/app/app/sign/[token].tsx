import { useLocalSearchParams } from "expo-router";

import { PublicSignScreen } from "@/features/sign/public-sign-screen";

export default function PublicSignRoute() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const raw = params.token;
  const token = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return <PublicSignScreen token={token} />;
}
