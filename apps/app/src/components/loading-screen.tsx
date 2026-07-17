import { LoadingState } from "@manut/ui";

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return <LoadingState label={label} />;
}
