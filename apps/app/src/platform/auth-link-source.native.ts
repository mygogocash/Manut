import * as Linking from "expo-linking";

export function useAuthLinkUrl(): string | null {
  return Linking.useLinkingURL();
}

export function clearAuthLinkUrl(_pathname: string): void {
  Linking.clearInitialURL();
}
