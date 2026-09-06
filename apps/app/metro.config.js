const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = withNativeWind(getDefaultConfig(projectRoot), {
  input: "./global.css",
  inlineRem: 16,
});

config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "react-native-css-interop": path.resolve(projectRoot, "node_modules/react-native-css-interop"),
};

// pnpm + Metro cannot follow css-interop's nested jsx-runtime/package.json
// (`main: "../dist/runtime/jsx-runtime"`). NativeWind babel injects that
// specifier into every JSX file.
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react-native-css-interop/jsx-runtime" ||
    moduleName === "react-native-css-interop/jsx-dev-runtime"
  ) {
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
    };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
