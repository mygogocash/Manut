import * as Linking from "expo-linking";

export function useAuthLinkUrl(): string | null {
  return Linking.useLinkingURL();
}

export function clearAuthLinkUrl(pathname: string): void {
  window.history.replaceState(null, "", pathname);
}
