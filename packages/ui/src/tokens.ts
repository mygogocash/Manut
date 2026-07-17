export const colors = {
  canvas: "#f7f4ed",
  surface: "#fffdf8",
  surfaceRaised: "#ffffff",
  border: "#ded8ca",
  borderStrong: "#97866c",
  text: "#30271d",
  textStrong: "#392f22",
  textMuted: "#665f52",
  accent: "#785f37",
  accentPressed: "#644d2d",
  onAccent: "#ffffff",
  errorBorder: "#d7a3a3",
  errorBackground: "#fff1f1",
  errorText: "#8e2525",
  successBorder: "#a8c6a1",
  successBackground: "#eff8ed",
  successText: "#315e2b",
  warningBorder: "#d7b66f",
  warningBackground: "#fff8e8",
  warningText: "#47371f",
  warningBody: "#66553a",
} as const;

export const radii = {
  control: 10,
  panel: 16,
  card: 18,
} as const;

export const spacing = {
  xs: 5,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  xxl: 24,
} as const;

export type ColorToken = keyof typeof colors;
export type RadiusToken = keyof typeof radii;
export type SpacingToken = keyof typeof spacing;
