import Svg, { Path, Rect } from "react-native-svg";
import { BRAND } from "@/lib/brand";

/**
 * Manut symbol — Brand CI v1.0 canonical mark (packages/brand/assets is the
 * asset source of truth; this is the inline react-native-svg twin so it
 * renders on web and native without a network fetch).
 *
 * The mark is wider than tall (48:40); `size` sets the width.
 */
export function ManutSymbol({
  size = 32,
  color = BRAND.ink,
  accessibilityLabel = "Manut",
}: {
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Svg
      width={size}
      height={(size * 40) / 48}
      viewBox="0 0 48 40"
      fill="none"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    >
      <Path
        d="M1 6.2C1 3.3 3.3 1 6.2 1H11.8C13.4 1 14.9 1.7 15.9 2.9L18.4 6H41.8C44.7 6 47 8.3 47 11.2V34.3C47 37.2 44.7 39.5 41.8 39.5H6.2C3.3 39.5 1 37.2 1 34.3V6.2Z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={13} y={14.2} width={3.6} height={7.4} rx={1.8} fill={color} />
      <Rect x={31.1} y={14.2} width={3.6} height={7.4} rx={1.8} fill={color} />
      <Path
        d="M23.5 16.9V23.4H20.3"
        stroke={color}
        strokeWidth={2.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.3 27.3C16.5 30.4 19.9 32.2 23.6 32.2C27.3 32.2 30.7 30.4 32.9 27.3"
        stroke={color}
        strokeWidth={2.3}
        strokeLinecap="round"
      />
    </Svg>
  );
}
