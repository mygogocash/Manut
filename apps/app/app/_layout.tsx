import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

/** Auth screens + dashboard shell; NativeWind tokens land with the UI package wave. */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
