export type StatusTone = "error" | "success" | "warning";

export function statusAccessibilityRole(tone: StatusTone): "alert" | undefined {
  return tone === "success" ? undefined : "alert";
}
