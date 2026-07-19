export type StatusTone =
  | "error"
  | "success"
  | "warning"
  | "info"
  | "neutral";

export function statusAccessibilityRole(tone: StatusTone): "alert" | undefined {
  return tone === "error" || tone === "warning" ? "alert" : undefined;
}
