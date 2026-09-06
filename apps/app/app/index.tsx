import { Redirect } from "expo-router";
import { getAccessToken } from "@/lib/session";

export default function Index() {
  return <Redirect href={getAccessToken() ? "/dashboard" : "/(auth)/login"} />;
}
