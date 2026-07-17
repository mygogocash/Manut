import { useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

function browserSnapshot(): string {
  return window.location.hash;
}

function serverSnapshot(): string {
  return "";
}

export function useCurrentHash(): string {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}
