import { Platform } from "react-native";

/**
 * Tailwind's shadow-sm / shadow-md as web-only `boxShadow` style props.
 *
 * NativeWind's css-interop compiles `box-shadow` CSS to the deprecated RN
 * `shadowColor`/`shadowRadius` props, which react-native-web logs as a console
 * deprecation on every page. Inline `boxShadow` bypasses that pipeline; the
 * class-based shadows these replace rendered nothing on native (no
 * shadowOffset/shadowOpacity were ever set), so web-only keeps parity.
 */
export const shadowSm = Platform.select({
  web: { boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" },
});

export const shadowMd = Platform.select({
  web: {
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)",
  },
});
