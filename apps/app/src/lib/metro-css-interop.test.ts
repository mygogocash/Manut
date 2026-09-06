import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("react-native-css-interop jsx-runtime", () => {
  it("resolves the nested jsx-runtime entry that Metro cannot follow on its own", () => {
    const filePath = require.resolve("react-native-css-interop/jsx-runtime");
    expect(filePath).toMatch(/jsx-runtime\.js$/);
  });

  it("resolves the nested jsx-dev-runtime entry", () => {
    const filePath = require.resolve("react-native-css-interop/jsx-dev-runtime");
    expect(filePath).toMatch(/jsx-dev-runtime\.js$/);
  });
});
